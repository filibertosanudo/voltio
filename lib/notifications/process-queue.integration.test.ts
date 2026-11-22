import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/lib/orders/create-order";
import { makeStaff, orderInput } from "@/test/factories";
import type { Mailer, OutgoingEmail } from "./mailer";
import { MAX_ATTEMPTS, processQueue } from "./process-queue";

function fakeMailer(fail = false): Mailer & { sent: OutgoingEmail[] } {
  const sent: OutgoingEmail[] = [];
  return {
    sent,
    async send(email) {
      if (fail) throw new Error("connection refused");
      sent.push(email);
    },
  };
}

async function queueOne() {
  const actor = await makeStaff();
  await createOrder(orderInput(), actor);
  return prisma.notification.findFirstOrThrow();
}

describe("processQueue", () => {
  it("sends a queued email and marks it sent", async () => {
    const row = await queueOne();
    const mailer = fakeMailer();
    expect(await processQueue({ mailer })).toEqual({ sent: 1, retried: 0, failed: 0 });

    expect(mailer.sent[0]).toMatchObject({ to: "ana@example.com", fromName: "Taller de pruebas" });
    expect(mailer.sent[0]?.subject).toContain("VT-");
    expect(await prisma.notification.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "SENT", attempts: 1, lockedUntil: null });
    expect(await processQueue({ mailer })).toEqual({ sent: 0, retried: 0, failed: 0 });
  });

  it("is not queued at all when the change it announces rolls back", async () => {
    const actor = await makeStaff();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.notification.create({ data: { template: "ORDER_RECEIVED", toEmail: "x@example.com", payload: {} } });
        throw new Error("the order failed");
      })
    ).rejects.toThrow();
    expect(await prisma.notification.count()).toBe(0);
    expect(actor.id).toBeTruthy();
  });

  it("does not send the same email from two workers at once", async () => {
    const actor = await makeStaff();
    for (let i = 0; i < 6; i++) {
      await createOrder(orderInput({ customer: { name: `C${i}`, phone: `5266711100${i}0`, email: `c${i}@example.com` } }), actor);
    }
    const a = fakeMailer();
    const b = fakeMailer();
    const [first, second] = await Promise.all([processQueue({ mailer: a, limit: 4 }), processQueue({ mailer: b, limit: 4 })]);

    expect(first.sent + second.sent).toBe(6);
    const recipients = [...a.sent, ...b.sent].map((e) => e.to);
    expect(new Set(recipients).size).toBe(6);
  });

  it("retries with backoff, then gives up and says why", async () => {
    const row = await queueOne();
    const start = new Date();
    let now = start;

    expect(await processQueue({ mailer: fakeMailer(true), now })).toEqual({ sent: 0, retried: 1, failed: 0 });
    const afterFirst = await prisma.notification.findUniqueOrThrow({ where: { id: row.id } });
    expect(afterFirst).toMatchObject({ status: "PENDING", attempts: 1, lastError: "connection refused", lockedUntil: null });
    expect(afterFirst.nextAttemptAt.getTime()).toBe(start.getTime() + 60_000);

    // Not due yet: nothing is claimed.
    expect(await processQueue({ mailer: fakeMailer(true), now: new Date(start.getTime() + 30_000) })).toEqual({ sent: 0, retried: 0, failed: 0 });

    for (let attempt = 2; attempt <= MAX_ATTEMPTS; attempt++) {
      now = new Date(now.getTime() + 2 * 60 * 60_000);
      await processQueue({ mailer: fakeMailer(true), now });
    }
    expect(await prisma.notification.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "FAILED", attempts: MAX_ATTEMPTS });
    expect(await processQueue({ mailer: fakeMailer(), now: new Date(now.getTime() + 24 * 60 * 60_000) })).toEqual({ sent: 0, retried: 0, failed: 0 });
  });

  it("recovers an email whose worker died mid-send", async () => {
    const row = await queueOne();
    const now = new Date();
    // A worker claimed it and never came back.
    await prisma.notification.update({ where: { id: row.id }, data: { lockedUntil: new Date(now.getTime() + 60_000), attempts: 1 } });

    const mailer = fakeMailer();
    expect((await processQueue({ mailer, now })).sent).toBe(0);
    expect((await processQueue({ mailer, now: new Date(now.getTime() + 5 * 60_000) })).sent).toBe(1);
  });
});
