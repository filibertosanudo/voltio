import type { Prisma } from "@/lib/generated/prisma/client";
import type { OrderStatus, UserRole } from "@/lib/generated/prisma/enums";
import { DomainError } from "@/lib/errors";

/** Who is making a change. Always passed in, never read from a global. */
export type Actor = { id: string; role: UserRole; name: string };

/**
 * Takes the order's row lock and returns its status as of that moment.
 * Every change to an order starts here, so moves, quote decisions and
 * payments on the same order run one after another, each seeing what the
 * previous one committed, instead of each deciding on a stale read.
 */
export async function lockOrder(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<{ id: string; status: OrderStatus }> {
  const rows = await tx.$queryRaw<{ id: string; status: OrderStatus }[]>`
    SELECT "id", "status" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE
  `;
  const order = rows[0];
  if (!order) throw new DomainError("NOT_FOUND");
  return order;
}
