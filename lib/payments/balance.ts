export type LedgerEntry = { kind: "PAYMENT" | "REFUND"; amountCents: number };
export type Balance = { dueCents: number; paidCents: number; balanceCents: number };

/**
 * What the customer owes: the approved quote's total, minus what came in,
 * plus what went back out. No approved quote means nothing is owed yet.
 */
export function computeBalance(approvedTotalCents: number | null, entries: readonly LedgerEntry[]): Balance {
  const paidCents = entries.reduce(
    (sum, entry) => sum + (entry.kind === "PAYMENT" ? entry.amountCents : -entry.amountCents),
    0
  );
  const dueCents = approvedTotalCents ?? 0;
  return { dueCents, paidCents, balanceCents: dueCents - paidCents };
}
