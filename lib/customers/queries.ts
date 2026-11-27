import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 25;

export async function listCustomers(options: { q: string; page: number }) {
  const digits = options.q.replace(/\D/g, "");
  const where: Prisma.CustomerWhereInput = options.q
    ? {
        OR: [
          { name: { contains: options.q, mode: "insensitive" } },
          { email: { contains: options.q, mode: "insensitive" } },
          ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
        ],
      }
    : {};
  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (options.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        _count: { select: { orders: true, devices: true } },
        orders: { orderBy: { receivedAt: "desc" }, take: 1, select: { receivedAt: true } },
      },
    }),
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), rows };
}

/** A customer with every device they have brought in and each device's service history. */
export async function getCustomer(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      devices: {
        orderBy: { createdAt: "desc" },
        include: {
          orders: {
            orderBy: { receivedAt: "desc" },
            select: { id: true, folio: true, status: true, receivedAt: true, reportedIssue: true, warrantyUntil: true },
          },
        },
      },
    },
  });
}

/**
 * The customer a phone number belongs to, for the intake form: what is on
 * file and the devices they brought before, most recent first. Null when
 * the number is new.
 */
export async function findCustomerByPhone(phone: string) {
  return prisma.customer.findUnique({
    where: { phone },
    select: {
      name: true,
      email: true,
      _count: { select: { orders: true } },
      devices: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, kind: true, brand: true, model: true, serial: true, color: true },
      },
    },
  });
}
