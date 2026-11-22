import "server-only";
import type { DecisionChannel, QuoteItemKind } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { enqueueOrderNotification } from "@/lib/notifications/enqueue";
import { lockOrder, type Actor } from "@/lib/orders/lock";
import { canDraftQuote, transitionRule } from "@/lib/orders/status";
import { computeTotals, MAX_QUOTE_TOTAL_CENTS } from "./totals";

export type QuoteItemInput = { kind: QuoteItemKind; description: string; quantity: number; unitPriceCents: number };

/**
 * Saves the quote being prepared. There is one draft per order (a partial
 * unique index): saving again replaces its lines. Totals are computed here,
 * on the server, from the shop's current tax rate; nothing the browser
 * added up is trusted.
 */
export async function saveQuoteDraft(
  input: { orderId: string; items: QuoteItemInput[]; notes: string },
  actor: Actor
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    if (!canDraftQuote(order.status)) throw new DomainError("QUOTE_NOT_EDITABLE");
    const rule = transitionRule(order.status, "AWAITING_APPROVAL");
    if (!rule?.roles.includes(actor.role)) throw new DomainError("FORBIDDEN");

    const business = await tx.business.findUniqueOrThrow({ where: { id: "main" } });
    const totals = computeTotals(input.items, business.taxRateBps);
    if (totals.totalCents > MAX_QUOTE_TOTAL_CENTS) throw new DomainError("QUOTE_TOO_LARGE");

    const items = input.items.map((item, position) => ({ ...item, position }));
    const draft = await tx.quote.findFirst({ where: { orderId: order.id, status: "DRAFT" }, select: { id: true } });

    if (draft) {
      await tx.quoteItem.deleteMany({ where: { quoteId: draft.id } });
      await tx.quote.update({
        where: { id: draft.id },
        data: { notes: input.notes, taxRateBps: business.taxRateBps, ...totals, items: { create: items } },
      });
      return draft.id;
    }

    const latest = await tx.quote.aggregate({ where: { orderId: order.id }, _max: { version: true } });
    const created = await tx.quote.create({
      data: {
        orderId: order.id,
        version: (latest._max.version ?? 0) + 1,
        notes: input.notes,
        taxRateBps: business.taxRateBps,
        ...totals,
        items: { create: items },
      },
      select: { id: true },
    });
    return created.id;
  });
}

/**
 * Sends the draft to the customer. Any earlier live quote is superseded in
 * the same transaction, so the tracking page never shows two prices, and a
 * decision on the old one is refused (see decideQuote).
 */
export async function sendQuote(orderId: string, actor: Actor, now = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    const rule = transitionRule(order.status, "AWAITING_APPROVAL");
    if (!rule || rule.via !== "quote") throw new DomainError("INVALID_TRANSITION");
    if (!rule.roles.includes(actor.role)) throw new DomainError("FORBIDDEN");

    const draft = await tx.quote.findFirst({
      where: { orderId, status: "DRAFT" },
      select: { id: true, totalCents: true, _count: { select: { items: true } } },
    });
    if (!draft || draft._count.items === 0) throw new DomainError("QUOTE_EMPTY");

    await tx.quote.updateMany({
      where: { orderId, status: { in: ["SENT", "APPROVED"] } },
      data: { status: "SUPERSEDED" },
    });
    await tx.quote.update({ where: { id: draft.id }, data: { status: "SENT", sentAt: now } });
    await tx.order.update({ where: { id: orderId }, data: { status: "AWAITING_APPROVAL" } });

    const business = await tx.business.findUniqueOrThrow({ where: { id: "main" } });
    await tx.orderEvent.create({
      data: {
        orderId,
        type: "QUOTE_SENT",
        fromStatus: order.status,
        toStatus: "AWAITING_APPROVAL",
        message: `Cotización lista por ${formatMoney(draft.totalCents, business.currency)}.`,
        isPublic: true,
        actorId: actor.id,
        createdAt: now,
      },
    });
    await enqueueOrderNotification(tx, orderId, "QUOTE_READY", { totalCents: draft.totalCents });
  });
}

/**
 * Takes a sent quote back to the bench to be corrected. The sent quote is
 * superseded and its lines are copied into a new draft with a new id: a
 * customer who still has the old one open on their phone is answering a
 * row that is no longer pending, so they cannot approve a corrected price
 * they have not seen.
 */
export async function withdrawQuote(orderId: string, actor: Actor, now = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    const rule = transitionRule(order.status, "DIAGNOSING");
    if (!rule || rule.via !== "quote") throw new DomainError("INVALID_TRANSITION");
    if (!rule.roles.includes(actor.role)) throw new DomainError("FORBIDDEN");

    const sent = await tx.quote.findFirst({
      where: { orderId, status: "SENT" },
      include: { items: { orderBy: { position: "asc" } } },
    });
    if (!sent) throw new DomainError("QUOTE_NOT_PENDING");

    await tx.quote.update({ where: { id: sent.id }, data: { status: "SUPERSEDED" } });
    await tx.quote.create({
      data: {
        orderId,
        version: sent.version + 1,
        notes: sent.notes,
        taxRateBps: sent.taxRateBps,
        subtotalCents: sent.subtotalCents,
        taxCents: sent.taxCents,
        totalCents: sent.totalCents,
        items: {
          create: sent.items.map(({ kind, description, quantity, unitPriceCents, position }) => ({
            kind,
            description,
            quantity,
            unitPriceCents,
            position,
          })),
        },
      },
    });

    await tx.order.update({ where: { id: orderId }, data: { status: "DIAGNOSING" } });
    await tx.orderEvent.create({
      data: {
        orderId,
        type: "QUOTE_WITHDRAWN",
        fromStatus: order.status,
        toStatus: "DIAGNOSING",
        message: "Estamos ajustando la cotización. Te avisamos en cuanto esté lista.",
        isPublic: true,
        actorId: actor.id,
        createdAt: now,
      },
    });
  });
}

export type QuoteDecision = {
  quoteId: string;
  approve: boolean;
  reason: string;
  /** The customer, proving themselves with the order's token; or staff recording what the customer said. */
  by:
    | { kind: "customer"; publicToken: string; ip: string | null; userAgent: string | null }
    | { kind: "staff"; actor: Actor; channel: Exclude<DecisionChannel, "CUSTOMER_LINK"> };
};

const CHANNEL_LABEL: Record<DecisionChannel, string> = {
  CUSTOMER_LINK: "por el cliente desde su enlace de seguimiento",
  IN_PERSON: "por el cliente en mostrador",
  PHONE: "por el cliente por teléfono",
};

/**
 * Records the customer's answer to one specific quote. The quote id is
 * part of the request: approving is "yes to this price", not "yes to
 * whatever is current". The update only matches while the quote is still
 * SENT, so a second click, or an approval of a quote that was replaced a
 * moment ago, changes nothing and is reported as QUOTE_NOT_PENDING.
 */
export async function decideQuote(decision: QuoteDecision, now = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({
      where: { id: decision.quoteId },
      select: { id: true, orderId: true, order: { select: { publicToken: true } } },
    });
    if (!quote) throw new DomainError("NOT_FOUND");
    // A wrong token answers exactly like a quote that does not exist.
    if (decision.by.kind === "customer" && quote.order.publicToken !== decision.by.publicToken) {
      throw new DomainError("NOT_FOUND");
    }

    const order = await lockOrder(tx, quote.orderId);
    const to = decision.approve ? "APPROVED" : "QUOTE_REJECTED";
    const rule = transitionRule(order.status, to);
    if (decision.by.kind === "staff" && rule && !rule.roles.includes(decision.by.actor.role)) {
      throw new DomainError("FORBIDDEN");
    }

    const channel = decision.by.kind === "customer" ? "CUSTOMER_LINK" : decision.by.channel;
    const reason = decision.reason.trim();
    const { count } = await tx.quote.updateMany({
      where: { id: quote.id, status: "SENT" },
      data: {
        status: decision.approve ? "APPROVED" : "REJECTED",
        decidedAt: now,
        decidedVia: channel,
        decidedById: decision.by.kind === "staff" ? decision.by.actor.id : null,
        decisionIp: decision.by.kind === "customer" ? decision.by.ip : null,
        decisionUserAgent: decision.by.kind === "customer" ? decision.by.userAgent?.slice(0, 300) : null,
        rejectionReason: decision.approve ? null : reason || null,
      },
    });
    if (count !== 1 || !rule) throw new DomainError("QUOTE_NOT_PENDING");

    await tx.order.update({ where: { id: order.id }, data: { status: to } });
    const verb = decision.approve ? "Cotización aprobada" : "Cotización rechazada";
    const detail = !decision.approve && reason ? ` Motivo: ${reason}` : "";
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: decision.approve ? "QUOTE_APPROVED" : "QUOTE_REJECTED",
        fromStatus: order.status,
        toStatus: to,
        message: `${verb} ${CHANNEL_LABEL[channel]}.${detail}`,
        isPublic: true,
        actorId: decision.by.kind === "staff" ? decision.by.actor.id : null,
        createdAt: now,
      },
    });
  });
}
