// Every date is resolved against the shop's timezone, once, on the server.
// A browser never interprets one: it receives text that is already final.

const LOCALE = "es-MX";

/** The calendar day an instant falls on in `timeZone`, as YYYY-MM-DD. */
export function localDay(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD, which is the only reason it is used.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant at which a wall clock in `timeZone` reads the given time. */
export function zonedTimeToUtc(day: string, hour: number, timeZone: string): Date {
  const [y = 1970, m = 1, d = 1] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour);
  // Second pass: the offset at the guess can differ from the offset at the
  // answer on the two days a year the clocks change.
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

export function startOfLocalMonth(now: Date, timeZone: string): Date {
  return zonedTimeToUtc(`${localDay(now, timeZone).slice(0, 7)}-01`, 0, timeZone);
}

export function startOfLocalDay(now: Date, timeZone: string): Date {
  return zonedTimeToUtc(localDay(now, timeZone), 0, timeZone);
}

export function isValidDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function formatDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Whole days from `from` to `to`, by calendar day in `timeZone`. */
export function daysBetween(from: Date, to: Date, timeZone: string): number {
  const a = Date.parse(`${localDay(from, timeZone)}T00:00:00Z`);
  const b = Date.parse(`${localDay(to, timeZone)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
