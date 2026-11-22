import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { NotificationPayload } from "./enqueue";
import type { Mailer } from "./mailer";
import { renderEmail } from "./templates";

export const MAX_ATTEMPTS = 5;
const LEASE_MS = 2 * 60_000;

/** 1, 2, 4, 8 minutes: long enough for a mail server to come back. */
export function backoffMs(attempts: number): number {
  return Math.min(60_000 * 2 ** (attempts - 1), 60 * 60_000);
}

export type QueueResult = { sent: number; retried: number; failed: number };

/**
 * Sends one batch of queued emails.
 *
 * Claiming is a single UPDATE over a subquery with FOR UPDATE SKIP LOCKED:
 * two workers running at once each take different rows, without waiting on
 * each other. A claim is a lease, not a status: if the worker dies after
 * claiming, the row becomes claimable again when the lease expires. The
 * price is at-least-once delivery, which for an email is the right side to
 * err on.
 */
export async function processQueue(options: { mailer: Mailer; limit?: number; now?: Date }): Promise<QueueResult> {
  const now = options.now ?? new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_MS);

  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Notification"
    SET "lockedUntil" = ${leaseUntil}, "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "Notification"
      WHERE "status" = 'PENDING'
        AND "nextAttemptAt" <= ${now}
        AND ("lockedUntil" IS NULL OR "lockedUntil" < ${now})
      ORDER BY "createdAt"
      LIMIT ${options.limit ?? 10}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"
  `;

  const result: QueueResult = { sent: 0, retried: 0, failed: 0 };
  if (claimed.length === 0) return result;

  const business = await prisma.business.findUniqueOrThrow({ where: { id: "main" } });
  const shop = { name: business.name, phone: business.phone, address: business.address, currency: business.currency };

  for (const { id } of claimed) {
    const row = await prisma.notification.findUniqueOrThrow({ where: { id } });
    try {
      const email = renderEmail(row.template, row.payload as NotificationPayload, shop);
      await options.mailer.send({ ...email, to: row.toEmail, fromName: env.MAIL_FROM_NAME ?? business.name });
      await prisma.notification.update({
        where: { id },
        data: { status: "SENT", sentAt: now, lockedUntil: null, lastError: null },
      });
      result.sent++;
    } catch (error) {
      const exhausted = row.attempts >= MAX_ATTEMPTS;
      await prisma.notification.update({
        where: { id },
        data: {
          status: exhausted ? "FAILED" : "PENDING",
          lockedUntil: null,
          nextAttemptAt: new Date(now.getTime() + backoffMs(row.attempts)),
          lastError: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        },
      });
      if (exhausted) result.failed++;
      else result.retried++;
    }
  }
  return result;
}
