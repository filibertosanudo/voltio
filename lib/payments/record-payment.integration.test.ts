import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { transitionOrder } from "@/lib/orders/transition";
import { decideQuote } from "@/lib/quotes/quote-service";
import { makeStaff, orderAwaitingApproval, QUOTE_TOTAL_CENTS } from "@/test/factories";
import { loadBalance } from "./ledger";
import { recordPayment } from "./record-payment";

async function approvedOrder() {
  const owner = await makeStaff("OWNER");
  const order = await orderAwaitingApproval(owner);
  await decideQuote({ quoteId: order.quoteId, approve: true, reason: "", by: { kind: "staff", actor: owner, channel: "IN_PERSON" } });
  return { owner, order };
}

const pay = (orderId: string, amountCents: number) => ({ orderId, kind: "PAYMENT" as const, method: "CASH" as const, amountCents, note: "" });
const balanceOf = (orderId: string) => prisma.$transaction((tx) => loadBalance(tx, orderId));

describe("recordPayment", () => {
  it("records a deposit and the rest, and leaves a public event for each", async () => {
    const { owner, order } = await approvedOrder();
    await recordPayment(pay(order.id, 100_000), owner);
    await recordPayment({ ...pay(order.id, 161_000), method: "TRANSFER" }, owner);

    expect(await balanceOf(order.id)).toEqual({ dueCents: QUOTE_TOTAL_CENTS, paidCents: QUOTE_TOTAL_CENTS, balanceCents: 0 });
    const events = await prisma.orderEvent.findMany({ where: { orderId: order.id, type: "PAYMENT_RECORDED" }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.message)).toEqual([
      "Pago recibido: $1,000.00 en efectivo.",
      "Pago recibido: $1,610.00 en transferencia.",
    ]);
  });

  it("refuses to take more than is owed, or anything before a quote is approved", async () => {
    const owner = await makeStaff("OWNER");
    const pending = await orderAwaitingApproval(owner);
    await expect(recordPayment(pay(pending.id, 10_000), owner)).rejects.toMatchObject({ code: "NO_APPROVED_QUOTE" });

    const { order } = await approvedOrder();
    await expect(recordPayment(pay(order.id, QUOTE_TOTAL_CENTS + 1), owner)).rejects.toMatchObject({ code: "OVERPAYMENT" });
    expect(await prisma.payment.count()).toBe(0);
  });

  it("adds up simultaneous payments one after the other", async () => {
    const { owner, order } = await approvedOrder();
    // Two terminals each try to collect the full amount at the same instant.
    const results = await Promise.allSettled([
      recordPayment(pay(order.id, QUOTE_TOTAL_CENTS), owner),
      recordPayment(pay(order.id, QUOTE_TOTAL_CENTS), owner),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await balanceOf(order.id)).balanceCents).toBe(0);
  });

  it("refunds no more than came in", async () => {
    const { owner, order } = await approvedOrder();
    await recordPayment(pay(order.id, 50_000), owner);
    await expect(recordPayment({ ...pay(order.id, 50_001), kind: "REFUND" }, owner)).rejects.toMatchObject({ code: "OVER_REFUND" });
    await recordPayment({ ...pay(order.id, 20_000), kind: "REFUND" }, owner);
    expect((await balanceOf(order.id)).paidCents).toBe(30_000);
  });

  it("belongs to the counter, and stops on a cancelled order", async () => {
    const { owner, order } = await approvedOrder();
    await expect(recordPayment(pay(order.id, 1_000), await makeStaff("TECHNICIAN"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await transitionOrder({ orderId: order.id, to: "CANCELLED", note: "Sin refacción" }, owner);
    await expect(recordPayment(pay(order.id, 1_000), owner)).rejects.toMatchObject({ code: "ORDER_CLOSED" });
  });

  it("is backed by the database: an amount of zero cannot be stored", async () => {
    const { owner, order } = await approvedOrder();
    await expect(
      prisma.payment.create({ data: { orderId: order.id, method: "CASH", amountCents: 0, receivedById: owner.id } })
    ).rejects.toThrow();
  });
});
