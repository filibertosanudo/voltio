import "server-only";
import type { DeviceKind } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { enqueueOrderNotification } from "@/lib/notifications/enqueue";
import { nextFolio } from "./folio";
import type { Actor } from "./lock";

export type CreateOrderInput = {
  customer: { name: string; phone: string; email: string | null };
  device: { kind: DeviceKind; brand: string; model: string; serial: string | null; color: string };
  reportedIssue: string;
  intakeCondition: string;
  accessories: string;
  promisedAt: Date | null;
  assignedToId: string | null;
};

export type CreatedOrder = { id: string; folio: string; publicToken: string; warrantyOfFolio: string | null };

/**
 * Receives a device. One transaction: the customer (found by phone or
 * created), the device (found by serial among that customer's devices, so
 * a returning device keeps one history), the folio, the order, its first
 * event and the confirmation email all exist together or not at all.
 */
export async function createOrder(input: CreateOrderInput, actor: Actor, now = new Date()): Promise<CreatedOrder> {
  return prisma.$transaction(async (tx) => {
    const business = await tx.business.findUniqueOrThrow({ where: { id: "main" } });

    const customer = await tx.customer.upsert({
      where: { phone: input.customer.phone },
      create: { name: input.customer.name, phone: input.customer.phone, email: input.customer.email },
      // A returning customer keeps the name already on file; an email given
      // today fills in or replaces the one we had.
      update: input.customer.email ? { email: input.customer.email } : {},
    });

    const known = input.device.serial
      ? await tx.device.findFirst({ where: { customerId: customer.id, serial: input.device.serial } })
      : null;
    const device =
      known ??
      (await tx.device.create({
        data: { ...input.device, customerId: customer.id },
      }));

    // The same device back inside its warranty: flag it at the counter,
    // before anyone quotes a repair that should be free.
    const underWarranty = known
      ? await tx.order.findFirst({
          where: { deviceId: known.id, status: "DELIVERED", warrantyUntil: { gte: now } },
          orderBy: { deliveredAt: "desc" },
          select: { id: true, folio: true },
        })
      : null;

    const folio = await nextFolio(tx, { prefix: business.folioPrefix, timeZone: business.timezone, now });

    const order = await tx.order.create({
      data: {
        folio,
        customerId: customer.id,
        deviceId: device.id,
        reportedIssue: input.reportedIssue,
        intakeCondition: input.intakeCondition,
        accessories: input.accessories,
        promisedAt: input.promisedAt,
        assignedToId: input.assignedToId,
        createdById: actor.id,
        receivedAt: now,
        warrantyOfId: underWarranty?.id ?? null,
      },
      select: { id: true, folio: true, publicToken: true },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "CREATED",
        toStatus: "RECEIVED",
        message: "Recibimos tu equipo en el taller.",
        isPublic: true,
        actorId: actor.id,
        createdAt: now,
      },
    });
    if (underWarranty) {
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "NOTE",
          message: `El equipo regresa dentro de la garantía de la orden ${underWarranty.folio}.`,
          isPublic: false,
          actorId: actor.id,
          createdAt: now,
        },
      });
    }

    await enqueueOrderNotification(tx, order.id, "ORDER_RECEIVED");

    return { ...order, warrantyOfFolio: underWarranty?.folio ?? null };
  });
}
