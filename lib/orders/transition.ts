import "server-only";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { formatDate } from "@/lib/dates";
import { enqueueOrderNotification } from "@/lib/notifications/enqueue";
import { loadBalance } from "@/lib/payments/ledger";
import { lockOrder, type Actor } from "./lock";
import { transitionRule } from "./status";

export type TransitionInput = { orderId: string; to: OrderStatus; note: string };

const DAY_MS = 86_400_000;

/**
 * Moves an order by hand. The rule is read after the row lock, so it is
 * checked against the status the order really has, not the one the screen
 * showed: two people pressing different buttons get one move and one
 * "that is no longer possible", never both moves.
 */
export async function transitionOrder(input: TransitionInput, actor: Actor, now = new Date()): Promise<void> {
  const note = input.note.trim();

  await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    const rule = transitionRule(order.status, input.to);
    if (!rule || rule.via !== "manual") throw new DomainError("INVALID_TRANSITION");
    if (!rule.roles.includes(actor.role)) throw new DomainError("FORBIDDEN");

    const data: {
      status: OrderStatus;
      readyAt?: Date;
      deliveredAt?: Date;
      cancelledAt?: Date;
      warrantyUntil?: Date;
    } = { status: input.to };
    let warrantyUntil: Date | null = null;

    if (input.to === "IN_REPAIR") {
      // No work without consent: the bench needs a quote the customer approved.
      const approved = await tx.quote.findFirst({ where: { orderId: order.id, status: "APPROVED" } });
      if (!approved) throw new DomainError("NO_APPROVED_QUOTE");
    }

    if (input.to === "READY") data.readyAt = now;

    if (input.to === "CANCELLED") {
      if (!note) throw new DomainError("NOTE_REQUIRED");
      const { paidCents } = await loadBalance(tx, order.id);
      if (paidCents > 0) throw new DomainError("PAID_ORDER");
      data.cancelledAt = now;
    }

    if (input.to === "DELIVERED") {
      const { dueCents, balanceCents } = await loadBalance(tx, order.id);
      if (balanceCents > 0) throw new DomainError("BALANCE_PENDING");
      data.deliveredAt = now;
      // A warranty covers work that was done: a device handed back
      // unrepaired (no approved quote) gets none.
      if (dueCents > 0) {
        const business = await tx.business.findUniqueOrThrow({ where: { id: "main" } });
        if (business.defaultWarrantyDays > 0) {
          warrantyUntil = new Date(now.getTime() + business.defaultWarrantyDays * DAY_MS);
          data.warrantyUntil = warrantyUntil;
        }
      }
    }

    await tx.order.update({ where: { id: order.id }, data });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "STATUS_CHANGED",
        fromStatus: order.status,
        toStatus: input.to,
        message: note,
        isPublic: true,
        actorId: actor.id,
        createdAt: now,
      },
    });

    if (input.to === "WAITING_PARTS") {
      await enqueueOrderNotification(tx, order.id, "WAITING_PARTS", { note });
    }
    if (input.to === "READY") {
      const { balanceCents } = await loadBalance(tx, order.id);
      await enqueueOrderNotification(tx, order.id, "READY_FOR_PICKUP", { balanceCents, note });
    }
    if (input.to === "DELIVERED") {
      const business = await tx.business.findUniqueOrThrow({ where: { id: "main" } });
      await enqueueOrderNotification(tx, order.id, "DELIVERED", {
        warrantyUntil: warrantyUntil ? formatDate(warrantyUntil, business.timezone) : undefined,
      });
    }
  });
}

/** A note on the order: internal by default, or visible on the tracking page. */
export async function addNote(
  input: { orderId: string; message: string; isPublic: boolean },
  actor: Actor,
  now = new Date()
): Promise<void> {
  const message = input.message.trim();
  if (!message) throw new DomainError("NOTE_REQUIRED");
  await prisma.$transaction(async (tx) => {
    await lockOrder(tx, input.orderId);
    await tx.orderEvent.create({
      data: { orderId: input.orderId, type: "NOTE", message, isPublic: input.isPublic, actorId: actor.id, createdAt: now },
    });
  });
}
