import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { NotificationTemplate } from "@/lib/generated/prisma/enums";
import { env } from "@/lib/env";

/** Captured when the event happens, so the email says what was true then. */
export type NotificationPayload = {
  customerName: string;
  folio: string;
  deviceLabel: string;
  trackUrl: string;
  totalCents?: number;
  balanceCents?: number;
  warrantyUntil?: string;
  note?: string;
};

export function trackingUrl(publicToken: string): string {
  return new URL(`/r/${publicToken}`, env.APP_ORIGIN).toString();
}

/**
 * Queues an email about an order, inside the transaction that made the
 * change. Committing the change commits the email; rolling it back takes
 * the email with it. A customer with no email on file simply gets none:
 * the counter still has their phone and the WhatsApp link.
 */
export async function enqueueOrderNotification(
  tx: Prisma.TransactionClient,
  orderId: string,
  template: NotificationTemplate,
  extra: Partial<NotificationPayload> = {}
): Promise<void> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      folio: true,
      publicToken: true,
      customer: { select: { name: true, email: true } },
      device: { select: { brand: true, model: true } },
    },
  });
  if (!order.customer.email) return;

  const payload: NotificationPayload = {
    customerName: order.customer.name,
    folio: order.folio,
    deviceLabel: `${order.device.brand} ${order.device.model}`,
    trackUrl: trackingUrl(order.publicToken),
    ...extra,
  };
  await tx.notification.create({
    data: { orderId, template, toEmail: order.customer.email, payload },
  });
}
