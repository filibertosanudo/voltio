import type { Prisma } from "@/lib/generated/prisma/client";
import { localDay } from "@/lib/dates";

/** VT-261115-007: prefix, local day as YYMMDD, the day's running number. */
export function formatFolio(prefix: string, day: string, sequence: number): string {
  const compact = day.slice(2).replaceAll("-", "");
  return `${prefix}-${compact}-${String(sequence).padStart(3, "0")}`;
}

/** What a customer types, tolerating case and the spaces a phone keyboard adds. */
export function normalizeFolio(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * The next folio of the shop's local day. One statement, so the increment
 * and the read are atomic: two intakes at the same instant get consecutive
 * numbers, and a rolled-back intake gives its number back.
 */
export async function nextFolio(
  tx: Prisma.TransactionClient,
  options: { prefix: string; timeZone: string; now: Date }
): Promise<string> {
  const day = localDay(options.now, options.timeZone);
  const rows = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "FolioCounter" ("day", "last") VALUES (${day}::date, 1)
    ON CONFLICT ("day") DO UPDATE SET "last" = "FolioCounter"."last" + 1
    RETURNING "last"
  `;
  const sequence = rows[0]?.last;
  if (sequence === undefined) throw new Error("FolioCounter returned no row");
  return formatFolio(options.prefix, day, sequence);
}
