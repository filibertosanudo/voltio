// The small pure functions everything else is built on.
import { describe, expect, it } from "vitest";
import { centsToInput, formatMoney, parseMoneyToCents } from "./money";
import { daysBetween, isValidDay, localDay, startOfLocalMonth, zonedTimeToUtc } from "./dates";
import { formatPhone, lastFourDigits, normalizePhone, normalizeSerial } from "./customers/phone";
import { formatFolio, normalizeFolio } from "./orders/folio";
import { computeTotals } from "./quotes/totals";
import { computeBalance } from "./payments/balance";
import { clientIpFrom } from "./security/client-ip";
import { sniffImageType } from "./photos/validate";
import { backoffMs } from "./notifications/process-queue";

describe("money", () => {
  it("parses what people type into a price field", () => {
    expect(parseMoneyToCents("1250")).toBe(125_000);
    expect(parseMoneyToCents("1,250.50")).toBe(125_050);
    expect(parseMoneyToCents("$ 899.9")).toBe(89_990);
    expect(parseMoneyToCents("0")).toBe(0);
  });

  it("refuses instead of guessing", () => {
    for (const bad of ["", "abc", "-5", "12.345", "1.2.3", "1e3"]) expect(parseMoneyToCents(bad), bad).toBeNull();
  });

  it("formats and round-trips", () => {
    expect(formatMoney(261_000)).toBe("$2,610.00");
    expect(parseMoneyToCents(centsToInput(89_990))).toBe(89_990);
  });
});

describe("quote totals", () => {
  it("taxes the subtotal once, rounding half up", () => {
    expect(computeTotals([{ quantity: 1, unitPriceCents: 180_000 }, { quantity: 1, unitPriceCents: 45_000 }], 1600)).toEqual({
      subtotalCents: 225_000,
      taxCents: 36_000,
      totalCents: 261_000,
    });
    // 0.5 of a cent rounds up; 0.4 rounds down.
    expect(computeTotals([{ quantity: 1, unitPriceCents: 3 }], 5000).taxCents).toBe(2);
    expect(computeTotals([{ quantity: 1, unitPriceCents: 33 }], 1600).taxCents).toBe(5);
  });

  it("does not depend on how the same work is split into lines", () => {
    const whole = computeTotals([{ quantity: 3, unitPriceCents: 333 }], 1600);
    const split = computeTotals(
      [{ quantity: 1, unitPriceCents: 333 }, { quantity: 1, unitPriceCents: 333 }, { quantity: 1, unitPriceCents: 333 }],
      1600
    );
    expect(split).toEqual(whole);
  });

  it("handles an empty quote and a zero rate", () => {
    expect(computeTotals([], 1600)).toEqual({ subtotalCents: 0, taxCents: 0, totalCents: 0 });
    expect(computeTotals([{ quantity: 2, unitPriceCents: 500 }], 0).totalCents).toBe(1_000);
  });
});

describe("balance", () => {
  it("owes nothing before a quote is approved", () => {
    expect(computeBalance(null, [])).toEqual({ dueCents: 0, paidCents: 0, balanceCents: 0 });
  });

  it("nets payments against refunds", () => {
    expect(
      computeBalance(261_000, [
        { kind: "PAYMENT", amountCents: 100_000 },
        { kind: "PAYMENT", amountCents: 161_000 },
        { kind: "REFUND", amountCents: 61_000 },
      ])
    ).toEqual({ dueCents: 261_000, paidCents: 200_000, balanceCents: 61_000 });
  });
});

describe("phone and serial", () => {
  it("makes every way of writing a Mexican number the same value", () => {
    for (const raw of ["6671234567", "(667) 123-4567", "+52 667 123 4567", "+52 1 667 123 4567"]) {
      expect(normalizePhone(raw), raw).toBe("526671234567");
    }
  });

  it("keeps other countries and rejects fragments", () => {
    expect(normalizePhone("+1 415 555 2671")).toBe("14155552671");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("formats and takes the last four", () => {
    expect(formatPhone("526671234567")).toBe("667 123 4567");
    expect(formatPhone("14155552671")).toBe("+14155552671");
    expect(lastFourDigits("526671234567")).toBe("4567");
  });

  it("normalizes serials", () => {
    expect(normalizeSerial(" ab 12 cd ")).toBe("AB12CD");
    expect(normalizeSerial("   ")).toBeNull();
  });
});

describe("folio", () => {
  it("reads prefix, day and a padded sequence", () => {
    expect(formatFolio("VT", "2026-11-15", 7)).toBe("VT-261115-007");
    expect(formatFolio("VT", "2026-11-15", 1234)).toBe("VT-261115-1234");
  });

  it("tolerates how a customer types it", () => {
    expect(normalizeFolio("  vt-261115-007 ")).toBe("VT-261115-007");
    expect(normalizeFolio("vt - 261115 - 007")).toBe("VT-261115-007");
  });
});

describe("dates in the shop's timezone", () => {
  const tz = "America/Mexico_City";

  it("puts a late-evening instant on the right local day", () => {
    // 03:30 UTC on the 16th is 21:30 on the 15th in Mexico City.
    expect(localDay(new Date("2026-11-16T03:30:00Z"), tz)).toBe("2026-11-15");
    expect(localDay(new Date("2026-11-16T03:30:00Z"), "UTC")).toBe("2026-11-16");
  });

  it("finds the instant of a local wall-clock time", () => {
    expect(zonedTimeToUtc("2026-11-15", 18, tz).toISOString()).toBe("2026-11-16T00:00:00.000Z");
    // Across a daylight-saving change (New York, 2026-03-08).
    expect(zonedTimeToUtc("2026-03-08", 12, "America/New_York").toISOString()).toBe("2026-03-08T16:00:00.000Z");
    expect(startOfLocalMonth(new Date("2026-11-15T12:00:00Z"), tz).toISOString()).toBe("2026-11-01T06:00:00.000Z");
  });

  it("counts days by calendar, not by 24-hour blocks", () => {
    expect(daysBetween(new Date("2026-11-15T05:00:00Z"), new Date("2026-11-16T07:00:00Z"), tz)).toBe(2);
  });

  it("validates a day string", () => {
    expect(isValidDay("2026-02-28")).toBe(true);
    expect(isValidDay("2026-02-30")).toBe(false);
    expect(isValidDay("28/02/2026")).toBe(false);
  });
});

describe("client address", () => {
  const headers = (value: string) => new Headers({ "x-forwarded-for": value });

  it("trusts only the entry our own proxy wrote", () => {
    // The client sent a forged first entry; the proxy appended the real one.
    expect(clientIpFrom(headers("1.1.1.1, 203.0.113.9"), 1)).toBe("203.0.113.9");
    expect(clientIpFrom(headers("1.1.1.1, 203.0.113.9, 10.0.0.2"), 2)).toBe("203.0.113.9");
  });

  it("degrades without throwing", () => {
    expect(clientIpFrom(new Headers(), 1)).toBeNull();
    expect(clientIpFrom(headers("203.0.113.9"), 3)).toBe("203.0.113.9");
    expect(clientIpFrom(headers("203.0.113.9"), 0)).toBe("203.0.113.9");
  });
});

describe("image sniffing", () => {
  it("recognizes the three accepted formats by their bytes", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.extension).toBe("jpg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.extension).toBe("png");
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(sniffImageType(webp)?.contentType).toBe("image/webp");
  });

  it("rejects a page pretending to be a photo", () => {
    expect(sniffImageType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("retry backoff", () => {
  it("doubles from one minute and stops at an hour", () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([60_000, 120_000, 240_000, 480_000]);
    expect(backoffMs(20)).toBe(3_600_000);
  });
});
