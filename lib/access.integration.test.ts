// Who can get in, and what a stranger can learn: sign-in, rate limits, the
// public lookup, the public view of an order, staff accounts and photos.
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { authenticate, currentStaff } from "@/lib/auth/authenticate";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createOrder } from "@/lib/orders/create-order";
import { addNote } from "@/lib/orders/transition";
import { addPhoto } from "@/lib/photos/photo-service";
import { decideQuote } from "@/lib/quotes/quote-service";
import type { PhotoStorage } from "@/lib/photos/storage";
import { consumeRateLimit, purgeRateLimits, RATE_LIMITS } from "@/lib/security/rate-limit";
import { createStaff, resetStaffPassword, setStaffActive } from "@/lib/team/team-service";
import { findTrackingToken, getPublicOrder } from "@/lib/track/public-order";
import { makeStaff, orderAwaitingApproval, orderInput, QUOTE_TOTAL_CENTS } from "@/test/factories";

const TZ = "America/Mexico_City";

describe("sign-in", () => {
  it("accepts the right password and nothing else, with one answer for every failure", async () => {
    await prisma.user.create({
      data: { name: "Dueña", email: "owner@voltio.test", role: "OWNER", passwordHash: await hashPassword("correct horse") },
    });
    expect(await authenticate("Owner@Voltio.test ", "correct horse", null)).toMatchObject({ email: "owner@voltio.test", role: "OWNER" });
    expect(await authenticate("owner@voltio.test", "wrong", null)).toBeNull();
    expect(await authenticate("nobody@voltio.test", "correct horse", null)).toBeNull();
  });

  it("locks out guessing against one account, even with the right password at the end", async () => {
    await prisma.user.create({
      data: { name: "Dueña", email: "owner@voltio.test", role: "OWNER", passwordHash: await hashPassword("correct horse") },
    });
    for (let i = 0; i < RATE_LIMITS.signIn.limit; i++) await authenticate("owner@voltio.test", `guess-${i}`, "198.51.100.7");
    expect(await authenticate("owner@voltio.test", "correct horse", "198.51.100.7")).toBeNull();
  });

  it("ends a deactivated account's session and refuses its sign-in", async () => {
    const password = await createStaff({ name: "Beto", email: "Beto@voltio.test", role: "TECHNICIAN" });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "beto@voltio.test" } });
    expect(await verifyPassword(user.passwordHash, password)).toBe(true);
    expect(await currentStaff(user.id)).toEqual({ name: "Beto", role: "TECHNICIAN" });

    await setStaffActive(user.id, false);
    expect(await currentStaff(user.id)).toBeNull();
    expect(await authenticate("beto@voltio.test", password, null)).toBeNull();
  });
});

describe("staff accounts", () => {
  it("refuses a duplicate email and replaces a password on reset", async () => {
    const first = await createStaff({ name: "Beto", email: "beto@voltio.test", role: "TECHNICIAN" });
    await expect(createStaff({ name: "Otro", email: "BETO@voltio.test", role: "FRONT_DESK" })).rejects.toMatchObject({ code: "EMAIL_TAKEN" });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "beto@voltio.test" } });
    const second = await resetStaffPassword(user.id);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(updated.passwordHash, first)).toBe(false);
    expect(await verifyPassword(updated.passwordHash, second)).toBe(true);
  });

  it("never leaves the shop without an active owner", async () => {
    const a = await makeStaff("OWNER");
    const b = await makeStaff("OWNER");
    const results = await Promise.allSettled([setStaffActive(a.id, false), setStaffActive(b.id, false)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.user.count({ where: { role: "OWNER", active: true } })).toBe(1);
    await expect(setStaffActive("missing", false)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("rate limit", () => {
  it("allows up to the limit inside a window and starts over in the next", async () => {
    const rule = { scope: "test", limit: 3, windowSeconds: 60 };
    const t0 = new Date("2026-11-15T12:00:10Z");
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await consumeRateLimit(rule, "k", t0));
    expect(results).toEqual([true, true, true, false, false]);
    expect(await consumeRateLimit(rule, "other", t0)).toBe(true);
    expect(await consumeRateLimit(rule, "k", new Date("2026-11-15T12:01:05Z"))).toBe(true);
  });

  it("counts simultaneous attempts without losing any", async () => {
    const rule = { scope: "burst", limit: 5, windowSeconds: 60 };
    const now = new Date();
    const results = await Promise.all(Array.from({ length: 12 }, () => consumeRateLimit(rule, "k", now)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });

  it("purges windows that no longer matter", async () => {
    const rule = { scope: "old", limit: 1, windowSeconds: 60 };
    await consumeRateLimit(rule, "k", new Date("2026-11-01T00:00:00Z"));
    await consumeRateLimit(rule, "k", new Date("2026-11-15T12:00:00Z"));
    expect(await purgeRateLimits(new Date("2026-11-15T12:30:00Z"))).toBe(1);
  });
});

describe("the customer's view", () => {
  it("finds an order by folio and the phone's last four digits, and gives nothing away otherwise", async () => {
    const actor = await makeStaff();
    const order = await createOrder(orderInput(), actor);
    expect(await findTrackingToken(` ${order.folio.toLowerCase()} `, "4567")).toBe(order.publicToken);
    expect(await findTrackingToken(order.folio, "0000")).toBeNull();
    expect(await findTrackingToken("VT-000000-999", "4567")).toBeNull();
    expect(await findTrackingToken(order.folio, "")).toBeNull();
  });

  it("shows the quote and the public history, and none of the internal record", async () => {
    const actor = await makeStaff();
    const order = await orderAwaitingApproval(actor);
    await addNote({ orderId: order.id, message: "Cliente difícil, cobrar por adelantado", isPublic: false }, actor);
    await addNote({ orderId: order.id, message: "Ya revisamos tu equipo", isPublic: true }, actor);

    const view = await getPublicOrder(order.publicToken, TZ);
    expect(view).toMatchObject({ folio: order.folio, status: "AWAITING_APPROVAL", customerFirstName: "Ana", deviceLabel: "Samsung Galaxy S23", balanceCents: 0 });
    expect(view?.quote).toMatchObject({ id: order.quoteId, status: "SENT", totalCents: QUOTE_TOTAL_CENTS });
    expect(view?.quote?.items).toHaveLength(2);

    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("Cliente difícil");
    expect(serialized).not.toContain("526671234567");
    expect(serialized).not.toContain("ana@example.com");
    expect(serialized).not.toContain(actor.id);
    expect(await getPublicOrder("not-a-token", TZ)).toBeNull();
  });

  it("celebrates an approval made on the link only right after it happened", async () => {
    const actor = await makeStaff();
    const order = await orderAwaitingApproval(actor);
    expect((await getPublicOrder(order.publicToken, TZ))?.justDecided).toBeNull();

    const at = new Date("2026-11-15T20:00:00Z");
    await decideQuote({ quoteId: order.quoteId, approve: true, reason: "", by: { kind: "customer", publicToken: order.publicToken, ip: null, userAgent: null } }, at);
    expect((await getPublicOrder(order.publicToken, TZ, new Date(at.getTime() + 60_000)))?.justDecided).toBe("APPROVED");
    expect((await getPublicOrder(order.publicToken, TZ, new Date(at.getTime() + 11 * 60_000)))?.justDecided).toBeNull();
  });

  it("does not celebrate a decision staff recorded for the customer", async () => {
    const actor = await makeStaff();
    const order = await orderAwaitingApproval(actor);
    const at = new Date("2026-11-15T20:00:00Z");
    await decideQuote({ quoteId: order.quoteId, approve: false, reason: "", by: { kind: "staff", actor, channel: "PHONE" } }, at);
    expect((await getPublicOrder(order.publicToken, TZ, new Date(at.getTime() + 60_000)))?.justDecided).toBeNull();
  });
});

describe("photos", () => {
  const memory = (): PhotoStorage & { files: Map<string, Uint8Array> } => {
    const files = new Map<string, Uint8Array>();
    return {
      files,
      put: async (key, bytes) => void files.set(key, bytes),
      get: async (key) => (files.has(key) ? Buffer.from(files.get(key)!) : null),
    };
  };
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

  it("stores the bytes under a server-made key with the type it found for itself", async () => {
    const actor = await makeStaff();
    const order = await createOrder(orderInput(), actor);
    const storage = memory();
    const id = await addPhoto({ orderId: order.id, bytes: PNG, caption: "Pantalla estrellada", isPublic: true }, actor, storage);

    const photo = await prisma.orderPhoto.findUniqueOrThrow({ where: { id } });
    expect(photo).toMatchObject({ contentType: "image/png", sizeBytes: PNG.byteLength, isPublic: true });
    expect(photo.storageKey).toMatch(new RegExp(`^${order.id}/[a-z0-9]+\\.png$`));
    expect(storage.files.has(photo.storageKey)).toBe(true);
    expect((await getPublicOrder(order.publicToken, TZ))?.photoIds).toEqual([id]);
  });

  it("refuses what is not an image, and stores nothing", async () => {
    const actor = await makeStaff();
    const order = await createOrder(orderInput(), actor);
    const storage = memory();
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    await expect(addPhoto({ orderId: order.id, bytes: html, caption: "", isPublic: false }, actor, storage)).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    await expect(addPhoto({ orderId: "missing", bytes: PNG, caption: "", isPublic: false }, actor, storage)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(storage.files.size).toBe(0);
    expect(await prisma.orderPhoto.count()).toBe(0);
  });
});
