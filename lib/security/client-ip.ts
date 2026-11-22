/**
 * The address a request came from, for rate limits and the approval record.
 *
 * x-forwarded-for is a list every proxy appends to, and its left end is
 * whatever the client chose to send. The only trustworthy entry is the one
 * written by our own outermost proxy: counting `trustedProxies` from the
 * right. Taking the first entry would let anyone pick a fresh "address"
 * per request and walk past every limit.
 */
export function clientIpFrom(headers: Headers, trustedProxies: number): string | null {
  const entries = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return null;
  const index = Math.max(entries.length - Math.max(trustedProxies, 1), 0);
  return entries[index] ?? null;
}
