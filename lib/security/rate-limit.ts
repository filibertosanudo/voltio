import "server-only";
import { prisma } from "@/lib/prisma";

export type RateLimitRule = { scope: string; limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  // Guessing a folio and four digits of a phone number is the only way to
  // reach an order without its link: ten tries per address every ten minutes.
  trackLookup: { scope: "track-lookup", limit: 10, windowSeconds: 600 },
  quoteDecision: { scope: "quote-decision", limit: 20, windowSeconds: 600 },
  signIn: { scope: "sign-in", limit: 8, windowSeconds: 900 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Counts one attempt and says whether it is within the limit. A fixed
 * window kept in Postgres: the increment is one atomic upsert, it survives
 * a restart, and it is shared by every replica with no extra service.
 */
export async function consumeRateLimit(rule: RateLimitRule, key: string, now = new Date()): Promise<boolean> {
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitHit" ("scope", "key", "windowStart", "count")
    VALUES (${rule.scope}, ${key}, ${windowStart}, 1)
    ON CONFLICT ("scope", "key", "windowStart") DO UPDATE SET "count" = "RateLimitHit"."count" + 1
    RETURNING "count"
  `;
  return (rows[0]?.count ?? 1) <= rule.limit;
}

/** Deletes windows that can no longer matter. Run by the worker between batches. */
export async function purgeRateLimits(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60_000);
  const { count } = await prisma.rateLimitHit.deleteMany({ where: { windowStart: { lt: cutoff } } });
  return count;
}
