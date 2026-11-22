// A phone number is the customer's key at the counter, so "667 123 4567",
// "(667) 123-4567" and "+52 1 667 123 4567" have to become the same value.

const MX = "52";

/** Digits with country code, or null when it cannot be a phone number. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return MX + digits;
  if (digits.length === 12 && digits.startsWith(MX)) return digits;
  // The "1" Mexican mobiles carried after the country code until 2019.
  if (digits.length === 13 && digits.startsWith(`${MX}1`)) return MX + digits.slice(3);
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export function formatPhone(normalized: string): string {
  if (normalized.length === 12 && normalized.startsWith(MX)) {
    const local = normalized.slice(2);
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return `+${normalized}`;
}

export function lastFourDigits(normalized: string): string {
  return normalized.slice(-4);
}

export function normalizeSerial(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  return cleaned.length > 0 ? cleaned : null;
}
