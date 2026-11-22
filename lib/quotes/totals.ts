export type QuoteLine = { quantity: number; unitPriceCents: number };
export type QuoteTotals = { subtotalCents: number; taxCents: number; totalCents: number };

/** Ten million pesos. Far above any repair, far below what an Int column holds. */
export const MAX_QUOTE_TOTAL_CENTS = 1_000_000_000;

/**
 * Tax is computed once on the subtotal and rounded half up, in integer
 * arithmetic. Rounding per line instead makes the total depend on how the
 * same work is split into lines.
 */
export function computeTotals(lines: readonly QuoteLine[], taxRateBps: number): QuoteTotals {
  const subtotalCents = lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
  const taxCents = Math.floor((subtotalCents * taxRateBps + 5_000) / 10_000);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}
