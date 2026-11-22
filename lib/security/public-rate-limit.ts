import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { clientIpFrom } from "./client-ip";
import { consumeRateLimit, type RateLimitRule } from "./rate-limit";

export type PublicCaller = { allowed: boolean; ip: string | null; userAgent: string | null };

/**
 * The first statement of every Server Action a stranger may call
 * (lib/auth/guard-coverage.test.ts checks it): an action with no role to
 * require spends rate limit instead. Requests with no usable address share
 * one bucket rather than getting a free pass.
 */
export async function publicRateLimit(rule: RateLimitRule): Promise<PublicCaller> {
  const requestHeaders = await headers();
  const ip = clientIpFrom(requestHeaders, env.TRUSTED_PROXY_COUNT);
  const allowed = await consumeRateLimit(rule, ip ?? "unknown");
  return { allowed, ip, userAgent: requestHeaders.get("user-agent") };
}
