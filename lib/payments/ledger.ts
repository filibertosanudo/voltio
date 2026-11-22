import type { Prisma } from "@/lib/generated/prisma/client";
import { computeBalance, type Balance } from "./balance";

/** Reads the order's balance inside the caller's transaction, after its lock. */
export async function loadBalance(tx: Prisma.TransactionClient, orderId: string): Promise<Balance> {
  const [approved, payments] = await Promise.all([
    tx.quote.findFirst({ where: { orderId, status: "APPROVED" }, select: { totalCents: true } }),
    tx.payment.findMany({ where: { orderId }, select: { kind: true, amountCents: true } }),
  ]);
  return computeBalance(approved?.totalCents ?? null, payments);
}
