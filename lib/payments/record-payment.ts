import "server-only";
import type { PaymentKind, PaymentMethod } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { lockOrder, type Actor } from "@/lib/orders/lock";
import { loadBalance } from "./ledger";

export type PaymentInput = {
  orderId: string;
  kind: PaymentKind;
  method: PaymentMethod;
  amountCents: number;
  note: string;
};

const METHOD_LABEL: Record<PaymentMethod, string> = { CASH: "efectivo", CARD: "tarjeta", TRANSFER: "transferencia" };

/**
 * Records money taken or returned at the counter. The balance is read
 * after the order's row lock: two payments entered at once are added up
 * one after the other, so together they cannot exceed what is owed, and a
 * refund cannot return more than came in.
 */
export async function recordPayment(input: PaymentInput, actor: Actor, now = new Date()): Promise<void> {
  if (actor.role !== "OWNER" && actor.role !== "FRONT_DESK") throw new DomainError("FORBIDDEN");

  await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    const balance = await loadBalance(tx, order.id);

    if (input.kind === "PAYMENT") {
      if (order.status === "CANCELLED") throw new DomainError("ORDER_CLOSED");
      if (balance.dueCents === 0) throw new DomainError("NO_APPROVED_QUOTE");
      if (input.amountCents > balance.balanceCents) throw new DomainError("OVERPAYMENT");
    } else if (input.amountCents > balance.paidCents) {
      throw new DomainError("OVER_REFUND");
    }

    await tx.payment.create({
      data: {
        orderId: order.id,
        kind: input.kind,
        method: input.method,
        amountCents: input.amountCents,
        note: input.note.trim(),
        receivedById: actor.id,
        createdAt: now,
      },
    });

    const business = await tx.business.findUniqueOrThrow({ where: { id: "main" } });
    const amount = formatMoney(input.amountCents, business.currency);
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "PAYMENT_RECORDED",
        message:
          input.kind === "PAYMENT"
            ? `Pago recibido: ${amount} en ${METHOD_LABEL[input.method]}.`
            : `Reembolso entregado: ${amount} en ${METHOD_LABEL[input.method]}.`,
        isPublic: true,
        actorId: actor.id,
        createdAt: now,
      },
    });
  });
}
