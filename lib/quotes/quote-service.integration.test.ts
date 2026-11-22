import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/lib/orders/create-order";
import { transitionOrder } from "@/lib/orders/transition";
import { LABOR, makeStaff, orderAwaitingApproval, orderInput, QUOTE_TOTAL_CENTS, SCREEN } from "@/test/factories";
import { decideQuote, saveQuoteDraft, sendQuote, withdrawQuote } from "./quote-service";

const customer = (publicToken: string) => ({ kind: "customer" as const, publicToken, ip: "203.0.113.9", userAgent: "Vitest" });

describe("drafting and sending a quote", () => {
  it("computes totals on the server from the shop's tax rate", async () => {
    const tech = await makeStaff("TECHNICIAN");
    const order = await createOrder(orderInput(), tech);
    await transitionOrder({ orderId: order.id, to: "DIAGNOSING", note: "" }, tech);
    const quoteId = await saveQuoteDraft({ orderId: order.id, items: [SCREEN, LABOR], notes: "Pantalla original" }, tech);

    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { items: { orderBy: { position: "asc" } } } });
    expect(quote).toMatchObject({ status: "DRAFT", version: 1, subtotalCents: 225_000, taxCents: 36_000, totalCents: QUOTE_TOTAL_CENTS, taxRateBps: 1600 });
    expect(quote.items.map((i) => i.description)).toEqual(["Pantalla", "Mano de obra"]);
  });

  it("keeps one draft per order: saving again replaces its lines", async () => {
    const tech = await makeStaff("TECHNICIAN");
    const order = await createOrder(orderInput(), tech);
    await transitionOrder({ orderId: order.id, to: "DIAGNOSING", note: "" }, tech);
    const first = await saveQuoteDraft({ orderId: order.id, items: [SCREEN, LABOR], notes: "" }, tech);
    const second = await saveQuoteDraft({ orderId: order.id, items: [LABOR], notes: "" }, tech);

    expect(second).toBe(first);
    expect(await prisma.quote.count()).toBe(1);
    expect(await prisma.quoteItem.count()).toBe(1);
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: first } })).totalCents).toBe(52_200);
  });

  it("refuses to draft where no quote can be sent, or by someone off the bench", async () => {
    const desk = await makeStaff("FRONT_DESK");
    const tech = await makeStaff("TECHNICIAN");
    const order = await createOrder(orderInput(), desk);
    await expect(saveQuoteDraft({ orderId: order.id, items: [LABOR], notes: "" }, tech)).rejects.toMatchObject({ code: "QUOTE_NOT_EDITABLE" });
    await transitionOrder({ orderId: order.id, to: "DIAGNOSING", note: "" }, tech);
    await expect(saveQuoteDraft({ orderId: order.id, items: [LABOR], notes: "" }, desk)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      saveQuoteDraft({ orderId: order.id, items: [{ ...SCREEN, quantity: 999, unitPriceCents: 900_000_000 }], notes: "" }, tech)
    ).rejects.toMatchObject({ code: "QUOTE_TOO_LARGE" });
  });

  it("will not send an empty or missing quote", async () => {
    const tech = await makeStaff("TECHNICIAN");
    const order = await createOrder(orderInput(), tech);
    await transitionOrder({ orderId: order.id, to: "DIAGNOSING", note: "" }, tech);
    await expect(sendQuote(order.id, tech)).rejects.toMatchObject({ code: "QUOTE_EMPTY" });
    await saveQuoteDraft({ orderId: order.id, items: [], notes: "" }, tech);
    await expect(sendQuote(order.id, tech)).rejects.toMatchObject({ code: "QUOTE_EMPTY" });
  });

  it("moves the order to AWAITING_APPROVAL and queues the email", async () => {
    const tech = await makeStaff("TECHNICIAN");
    const order = await orderAwaitingApproval(tech);
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { quotes: true, notifications: true } });
    expect(saved.status).toBe("AWAITING_APPROVAL");
    expect(saved.quotes[0]).toMatchObject({ status: "SENT" });
    const email = saved.notifications.find((n) => n.template === "QUOTE_READY");
    expect((email?.payload as { totalCents: number }).totalCents).toBe(QUOTE_TOTAL_CENTS);
  });

  it("can be withdrawn for correction: the lines carry over into a new draft", async () => {
    const tech = await makeStaff("TECHNICIAN");
    const order = await orderAwaitingApproval(tech);
    await withdrawQuote(order.id, tech);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("DIAGNOSING");

    const quotes = await prisma.quote.findMany({ where: { orderId: order.id }, orderBy: { version: "asc" }, include: { items: true } });
    expect(quotes.map((q) => [q.version, q.status, q.items.length, q.totalCents])).toEqual([
      [1, "SUPERSEDED", 2, QUOTE_TOTAL_CENTS],
      [2, "DRAFT", 2, QUOTE_TOTAL_CENTS],
    ]);

    await sendQuote(order.id, tech);
    await expect(withdrawQuote(order.id, await makeStaff("FRONT_DESK"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(sendQuote(order.id, tech)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});

describe("the customer's decision", () => {
  it("approves through the tracking link and records the evidence", async () => {
    const tech = await makeStaff("TECHNICIAN");
    const order = await orderAwaitingApproval(tech);
    const at = new Date("2026-11-15T20:00:00Z");
    await decideQuote({ quoteId: order.quoteId, approve: true, reason: "", by: customer(order.publicToken) }, at);

    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: order.quoteId } });
    expect(quote).toMatchObject({
      status: "APPROVED",
      decidedAt: at,
      decidedVia: "CUSTOMER_LINK",
      decidedById: null,
      decisionIp: "203.0.113.9",
      decisionUserAgent: "Vitest",
    });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("APPROVED");
    const event = await prisma.orderEvent.findFirstOrThrow({ where: { orderId: order.id, type: "QUOTE_APPROVED" } });
    expect(event).toMatchObject({ isPublic: true, actorId: null, toStatus: "APPROVED" });
  });

  it("rejects with a reason", async () => {
    const tech = await makeStaff("TECHNICIAN");
    const order = await orderAwaitingApproval(tech);
    await decideQuote({ quoteId: order.quoteId, approve: false, reason: "Prefiero comprar otro", by: customer(order.publicToken) });
    expect(await prisma.quote.findUniqueOrThrow({ where: { id: order.quoteId } })).toMatchObject({
      status: "REJECTED",
      rejectionReason: "Prefiero comprar otro",
    });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("QUOTE_REJECTED");
  });

  it("answers a wrong token exactly like a quote that does not exist", async () => {
    const tech = await makeStaff("TECHNICIAN");
    const order = await orderAwaitingApproval(tech);
    await expect(decideQuote({ quoteId: order.quoteId, approve: true, reason: "", by: customer("not-the-token") })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(decideQuote({ quoteId: "missing", approve: true, reason: "", by: customer(order.publicToken) })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: order.quoteId } })).status).toBe("SENT");
  });

  it("counts a double click once", async () => {
    const tech = await makeStaff("TECHNICIAN");
    const order = await orderAwaitingApproval(tech);
    const decide = () => decideQuote({ quoteId: order.quoteId, approve: true, reason: "", by: customer(order.publicToken) });
    const results = await Promise.allSettled([decide(), decide(), decide()]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) if (r.status === "rejected") expect(r.reason).toMatchObject({ code: "QUOTE_NOT_PENDING" });
    expect(await prisma.orderEvent.count({ where: { orderId: order.id, type: "QUOTE_APPROVED" } })).toBe(1);
  });

  it("lets approve and reject race to exactly one outcome", async () => {
    const tech = await makeStaff("TECHNICIAN");
    const order = await orderAwaitingApproval(tech);
    const results = await Promise.allSettled([
      decideQuote({ quoteId: order.quoteId, approve: true, reason: "", by: customer(order.publicToken) }),
      decideQuote({ quoteId: order.quoteId, approve: false, reason: "", by: { kind: "staff", actor: tech, channel: "PHONE" } }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { quotes: true } });
    expect([saved.status, saved.quotes[0]?.status]).toSatisfy(
      ([o, q]: string[]) => (o === "APPROVED" && q === "APPROVED") || (o === "QUOTE_REJECTED" && q === "REJECTED")
    );
  });

  it("refuses a yes to a price that was replaced a moment ago", async () => {
    const tech = await makeStaff("TECHNICIAN");
    const order = await orderAwaitingApproval(tech);
    // The customer has version 1 open. The shop withdraws it and sends a higher one.
    await withdrawQuote(order.id, tech);
    await saveQuoteDraft({ orderId: order.id, items: [SCREEN, LABOR, { kind: "PART", description: "Batería", quantity: 1, unitPriceCents: 60_000 }], notes: "" }, tech);
    await sendQuote(order.id, tech);

    // The customer taps "approve" on the page they still have open.
    await expect(decideQuote({ quoteId: order.quoteId, approve: true, reason: "", by: customer(order.publicToken) })).rejects.toMatchObject({ code: "QUOTE_NOT_PENDING" });

    const current = await prisma.quote.findFirstOrThrow({ where: { orderId: order.id, status: "SENT" } });
    expect(current.id).not.toBe(order.quoteId);
    expect(current.totalCents).toBeGreaterThan(QUOTE_TOTAL_CENTS);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("AWAITING_APPROVAL");
  });

  it("supersedes an approved quote when extra damage needs a new one", async () => {
    const owner = await makeStaff("OWNER");
    const order = await orderAwaitingApproval(owner);
    await decideQuote({ quoteId: order.quoteId, approve: true, reason: "", by: customer(order.publicToken) });
    await transitionOrder({ orderId: order.id, to: "IN_REPAIR", note: "" }, owner);

    const secondId = await saveQuoteDraft({ orderId: order.id, items: [SCREEN, LABOR, LABOR], notes: "Conector dañado" }, owner);
    await sendQuote(order.id, owner);

    const quotes = await prisma.quote.findMany({ where: { orderId: order.id }, orderBy: { version: "asc" } });
    expect(quotes.map((q) => [q.version, q.status])).toEqual([[1, "SUPERSEDED"], [2, "SENT"]]);
    // The old approval can no longer be acted on.
    await expect(decideQuote({ quoteId: order.quoteId, approve: true, reason: "", by: customer(order.publicToken) })).rejects.toMatchObject({ code: "QUOTE_NOT_PENDING" });
    await decideQuote({ quoteId: secondId, approve: true, reason: "", by: { kind: "staff", actor: owner, channel: "IN_PERSON" } });
    expect(await prisma.quote.findUniqueOrThrow({ where: { id: secondId } })).toMatchObject({ status: "APPROVED", decidedVia: "IN_PERSON", decidedById: owner.id, decisionIp: null });
  });

  it("is backed by the database: two live quotes for one order cannot exist", async () => {
    const tech = await makeStaff("TECHNICIAN");
    const order = await orderAwaitingApproval(tech);
    await expect(
      prisma.quote.create({
        data: { orderId: order.id, version: 2, status: "SENT", taxRateBps: 1600, subtotalCents: 100, taxCents: 16, totalCents: 116 },
      })
    ).rejects.toThrow();
    await expect(
      prisma.quote.create({
        data: { orderId: order.id, version: 3, status: "DRAFT", taxRateBps: 1600, subtotalCents: 100, taxCents: 16, totalCents: 999 },
      })
    ).rejects.toThrow();
  });
});
