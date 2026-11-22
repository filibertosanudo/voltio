import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { OrderStatus, QuoteItemKind, QuoteStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@/lib/dates";
import { lastFourDigits } from "@/lib/customers/phone";
import { normalizeFolio } from "@/lib/orders/folio";
import { computeBalance } from "@/lib/payments/balance";

/**
 * What the holder of a tracking link may see. Built field by field rather
 * than by spreading the row: internal notes, the customer's full contact
 * details, who touched the order and private photos must never be one
 * `select` away from a public page.
 */
export type PublicOrder = {
  folio: string;
  status: OrderStatus;
  customerFirstName: string;
  deviceLabel: string;
  reportedIssue: string;
  diagnosis: string;
  receivedAt: string;
  promisedAt: string | null;
  warrantyUntil: string | null;
  quote: {
    id: string;
    version: number;
    status: QuoteStatus;
    notes: string;
    items: { kind: QuoteItemKind; description: string; quantity: number; unitPriceCents: number }[];
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    taxRateBps: number;
    decidedAt: string | null;
  } | null;
  paidCents: number;
  balanceCents: number;
  events: { id: string; message: string; label: OrderStatus | null; at: string }[];
  photoIds: string[];
  /** The customer answered the quote a moment ago: the page says so, once, as the moment it is. */
  justDecided: "APPROVED" | "REJECTED" | null;
};

const JUST_DECIDED_MS = 10 * 60_000;

export async function getPublicOrder(publicToken: string, timeZone: string, now = new Date()): Promise<PublicOrder | null> {
  const order = await prisma.order.findUnique({
    where: { publicToken },
    include: {
      customer: { select: { name: true } },
      device: { select: { brand: true, model: true } },
      quotes: {
        where: { status: { in: ["SENT", "APPROVED", "REJECTED"] } },
        orderBy: { version: "desc" },
        take: 1,
        include: { items: { orderBy: { position: "asc" } } },
      },
      payments: { select: { kind: true, amountCents: true } },
      events: { where: { isPublic: true }, orderBy: { createdAt: "desc" } },
      photos: { where: { isPublic: true }, orderBy: { createdAt: "asc" }, select: { id: true } },
    },
  });
  if (!order) return null;

  const quote = order.quotes[0] ?? null;
  const balance = computeBalance(quote?.status === "APPROVED" ? quote.totalCents : null, order.payments);

  return {
    folio: order.folio,
    status: order.status,
    customerFirstName: order.customer.name.split(" ")[0] ?? "",
    deviceLabel: `${order.device.brand} ${order.device.model}`,
    reportedIssue: order.reportedIssue,
    diagnosis: order.diagnosis,
    receivedAt: formatDateTime(order.receivedAt, timeZone),
    promisedAt: order.promisedAt ? formatDate(order.promisedAt, timeZone) : null,
    warrantyUntil: order.warrantyUntil ? formatDate(order.warrantyUntil, timeZone) : null,
    quote: quote && {
      id: quote.id,
      version: quote.version,
      status: quote.status,
      notes: quote.notes,
      items: quote.items.map(({ kind, description, quantity, unitPriceCents }) => ({
        kind,
        description,
        quantity,
        unitPriceCents,
      })),
      subtotalCents: quote.subtotalCents,
      taxCents: quote.taxCents,
      totalCents: quote.totalCents,
      taxRateBps: quote.taxRateBps,
      decidedAt: quote.decidedAt ? formatDateTime(quote.decidedAt, timeZone) : null,
    },
    paidCents: balance.paidCents,
    balanceCents: balance.balanceCents,
    events: order.events.map((event) => ({
      id: event.id,
      message: event.message,
      label: event.toStatus,
      at: formatDateTime(event.createdAt, timeZone),
    })),
    photoIds: order.photos.map((photo) => photo.id),
    justDecided:
      quote?.decidedAt &&
      quote.decidedVia === "CUSTOMER_LINK" &&
      (quote.status === "APPROVED" || quote.status === "REJECTED") &&
      now.getTime() - quote.decidedAt.getTime() < JUST_DECIDED_MS
        ? quote.status
        : null,
  };
}

/**
 * For the customer who lost the link: the folio on their receipt plus the
 * last four digits of their phone. Wrong folio and wrong digits are the
 * same null, so the form cannot be used to learn which folios exist.
 */
export async function findTrackingToken(folioInput: string, lastFour: string): Promise<string | null> {
  const order = await prisma.order.findUnique({
    where: { folio: normalizeFolio(folioInput) },
    select: { publicToken: true, customer: { select: { phone: true } } },
  });
  const expected = Buffer.from(order ? lastFourDigits(order.customer.phone) : "----");
  const given = Buffer.from(lastFour.padEnd(4, " ").slice(0, 4));
  const matches = timingSafeEqual(expected, given);
  return order && matches ? order.publicToken : null;
}
