// Money is an integer number of cents everywhere: in the database, in
// arithmetic and across the server/client boundary. These two functions are
// the only places it becomes text or comes from text.

export function formatMoney(cents: number, currency = "MXN"): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(cents / 100);
}

/**
 * Parses what a person types into a price field: "1250", "1,250.50",
 * "$ 899.9". Returns null for anything that is not a non-negative amount
 * with at most two decimals, rather than guessing.
 */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[\s$,]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = "0", fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Cents as the plain decimal string a form field is prefilled with. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
