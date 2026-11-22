import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { startOfLocalMonth } from "@/lib/dates";
import { computeBalance } from "@/lib/payments/balance";
import { ORDER_STATUSES, OPEN_STATUSES } from "./status";

export const PAGE_SIZE = 20;

/** The tabs of the order list. Keys are what appears in the URL. */
export const ORDER_FILTERS = {
  abiertas: { label: "Abiertas", statuses: OPEN_STATUSES },
  "por-aprobar": { label: "Por aprobar", statuses: ["AWAITING_APPROVAL"] },
  "en-banco": { label: "En banco", statuses: ["DIAGNOSING", "APPROVED", "IN_REPAIR", "WAITING_PARTS"] },
  listas: { label: "Listas", statuses: ["READY"] },
  cerradas: { label: "Cerradas", statuses: ["DELIVERED", "CANCELLED"] },
  todas: { label: "Todas", statuses: [...ORDER_STATUSES] },
} as const satisfies Record<string, { label: string; statuses: readonly OrderStatus[] }>;

export type OrderFilter = keyof typeof ORDER_FILTERS;

export function isOrderFilter(value: string | undefined): value is OrderFilter {
  return value !== undefined && value in ORDER_FILTERS;
}

function searchWhere(q: string): Prisma.OrderWhereInput {
  const digits = q.replace(/\D/g, "");
  return {
    OR: [
      { folio: { contains: q.toUpperCase() } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { device: { model: { contains: q, mode: "insensitive" } } },
      { device: { brand: { contains: q, mode: "insensitive" } } },
      { device: { serial: { contains: q.toUpperCase() } } },
      ...(digits.length >= 4 ? [{ customer: { phone: { contains: digits } } }] : []),
    ],
  };
}

export async function listOrders(options: { filter: OrderFilter; q: string; page: number; now?: Date }) {
  const now = options.now ?? new Date();
  const where: Prisma.OrderWhereInput = {
    status: { in: [...ORDER_FILTERS[options.filter].statuses] },
    ...(options.q ? searchWhere(options.q) : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (options.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        folio: true,
        status: true,
        receivedAt: true,
        promisedAt: true,
        customer: { select: { name: true } },
        device: { select: { brand: true, model: true } },
        assignedTo: { select: { name: true } },
      },
    }),
  ]);
  return {
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: rows.map((row) => ({ ...row, overdue: isOverdue(row, now) })),
  };
}

/** Promised for a date that has passed, and still not ready. */
export function isOverdue(order: { status: OrderStatus; promisedAt: Date | null }, now: Date): boolean {
  return (
    order.promisedAt !== null &&
    order.promisedAt < now &&
    !["READY", "DELIVERED", "CANCELLED"].includes(order.status)
  );
}

export async function getOrderDetail(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      device: true,
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      warrantyOf: { select: { id: true, folio: true } },
      quotes: {
        orderBy: { version: "desc" },
        include: { items: { orderBy: { position: "asc" } }, decidedBy: { select: { name: true } } },
      },
      payments: { orderBy: { createdAt: "asc" }, include: { receivedBy: { select: { name: true } } } },
      events: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } },
      photos: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return null;

  const approved = order.quotes.find((quote) => quote.status === "APPROVED") ?? null;
  return { ...order, balance: computeBalance(approved?.totalCents ?? null, order.payments) };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

export async function listAssignableStaff() {
  return prisma.user.findMany({
    where: { active: true, role: { in: ["TECHNICIAN", "OWNER"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

const attentionSelect = {
  id: true,
  folio: true,
  status: true,
  promisedAt: true,
  readyAt: true,
  customer: { select: { name: true } },
  device: { select: { brand: true, model: true } },
} satisfies Prisma.OrderSelect;

/** Everything the panel's home page shows, in one round of queries. */
export async function getDashboard(timeZone: string, now = new Date()) {
  const monthStart = startOfLocalMonth(now, timeZone);
  const [byStatus, overdue, awaiting, ready, late, monthPayments, deliveredThisMonth, recentDeliveries] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.count({ where: { promisedAt: { lt: now }, status: { notIn: ["READY", "DELIVERED", "CANCELLED"] } } }),
    prisma.order.findMany({ where: { status: "AWAITING_APPROVAL" }, orderBy: { updatedAt: "asc" }, take: 5, select: attentionSelect }),
    prisma.order.findMany({ where: { status: "READY" }, orderBy: { readyAt: "asc" }, take: 5, select: attentionSelect }),
    prisma.order.findMany({
      where: { promisedAt: { lt: now }, status: { notIn: ["READY", "DELIVERED", "CANCELLED"] } },
      orderBy: { promisedAt: "asc" },
      take: 5,
      select: attentionSelect,
    }),
    prisma.payment.groupBy({ by: ["kind"], where: { createdAt: { gte: monthStart } }, _sum: { amountCents: true } }),
    prisma.order.count({ where: { deliveredAt: { gte: monthStart } } }),
    prisma.order.findMany({
      where: { status: "DELIVERED", deliveredAt: { not: null } },
      orderBy: { deliveredAt: "desc" },
      take: 30,
      select: { receivedAt: true, deliveredAt: true },
    }),
  ]);

  const count = (status: OrderStatus) => byStatus.find((row) => row.status === status)?._count._all ?? 0;
  const sum = (kind: "PAYMENT" | "REFUND") => monthPayments.find((row) => row.kind === kind)?._sum.amountCents ?? 0;
  const turnaroundDays =
    recentDeliveries.length === 0
      ? null
      : recentDeliveries.reduce((total, o) => total + (o.deliveredAt!.getTime() - o.receivedAt.getTime()), 0) /
        recentDeliveries.length /
        86_400_000;

  return {
    open: OPEN_STATUSES.reduce((total, status) => total + count(status), 0),
    onBench: count("DIAGNOSING") + count("APPROVED") + count("IN_REPAIR") + count("WAITING_PARTS"),
    received: count("RECEIVED"),
    awaitingApproval: count("AWAITING_APPROVAL"),
    readyForPickup: count("READY"),
    overdue,
    monthRevenueCents: sum("PAYMENT") - sum("REFUND"),
    deliveredThisMonth,
    turnaroundDays,
    lists: { awaiting, ready, late },
  };
}
