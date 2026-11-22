// The order state machine. Pure data and pure functions, shared by the
// server (which enforces it) and the screens (which only offer what it
// allows). Type-only imports keep the generated client out of the browser.
import type { OrderStatus, UserRole } from "@/lib/generated/prisma/enums";

export const ORDER_STATUSES = [
  "RECEIVED",
  "DIAGNOSING",
  "AWAITING_APPROVAL",
  "APPROVED",
  "IN_REPAIR",
  "WAITING_PARTS",
  "QUOTE_REJECTED",
  "READY",
  "DELIVERED",
  "CANCELLED",
] as const satisfies readonly OrderStatus[];

/**
 * "manual": a staff member moves the order (lib/orders/transition.ts).
 * "quote": the move is a consequence of sending, withdrawing or deciding a
 * quote (lib/quotes/quote-service.ts) and cannot be made any other way, so
 * an order never waits for approval without a quote to approve.
 */
export type TransitionRule = { via: "manual" | "quote"; roles: readonly UserRole[] };

const EVERYONE = ["OWNER", "FRONT_DESK", "TECHNICIAN"] as const;
const BENCH = ["OWNER", "TECHNICIAN"] as const;
const COUNTER = ["OWNER", "FRONT_DESK"] as const;

const manual = (roles: readonly UserRole[]): TransitionRule => ({ via: "manual", roles });
const quote = (roles: readonly UserRole[]): TransitionRule => ({ via: "quote", roles });

export const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, TransitionRule>>> = {
  RECEIVED: { DIAGNOSING: manual(BENCH), CANCELLED: manual(COUNTER) },
  DIAGNOSING: { AWAITING_APPROVAL: quote(BENCH), CANCELLED: manual(COUNTER) },
  AWAITING_APPROVAL: {
    APPROVED: quote(EVERYONE),
    QUOTE_REJECTED: quote(EVERYONE),
    DIAGNOSING: quote(BENCH),
    CANCELLED: manual(COUNTER),
  },
  APPROVED: { IN_REPAIR: manual(BENCH), CANCELLED: manual(COUNTER) },
  // Extra damage found on the bench: a new quote goes out mid-repair.
  IN_REPAIR: { WAITING_PARTS: manual(BENCH), READY: manual(BENCH), AWAITING_APPROVAL: quote(BENCH) },
  WAITING_PARTS: { IN_REPAIR: manual(BENCH) },
  // READY here means "ready to be handed back unrepaired".
  QUOTE_REJECTED: { AWAITING_APPROVAL: quote(BENCH), READY: manual(EVERYONE), CANCELLED: manual(COUNTER) },
  READY: { DELIVERED: manual(COUNTER), IN_REPAIR: manual(BENCH) },
  DELIVERED: {},
  CANCELLED: {},
};

export function transitionRule(from: OrderStatus, to: OrderStatus): TransitionRule | undefined {
  return TRANSITIONS[from][to];
}

/** The moves a person in `role` can make by hand from `from`, in table order. */
export function manualTargets(from: OrderStatus, role: UserRole): OrderStatus[] {
  return ORDER_STATUSES.filter((to) => {
    const rule = TRANSITIONS[from][to];
    return rule?.via === "manual" && rule.roles.includes(role);
  });
}

export function isTerminal(status: OrderStatus): boolean {
  return Object.keys(TRANSITIONS[status]).length === 0;
}

export const OPEN_STATUSES: OrderStatus[] = ORDER_STATUSES.filter((s) => !isTerminal(s));

/** A quote can be drafted wherever sending one is a legal move. */
export function canDraftQuote(status: OrderStatus): boolean {
  return TRANSITIONS[status].AWAITING_APPROVAL?.via === "quote";
}

export function canSendQuote(status: OrderStatus, role: UserRole): boolean {
  const rule = TRANSITIONS[status].AWAITING_APPROVAL;
  return rule?.via === "quote" && rule.roles.includes(role);
}

type StatusMeta = {
  /** What staff read on the board. */
  label: string;
  /** What the customer reads on their tracking page. */
  publicLabel: string;
  publicHint: string;
  badge: string;
  dot: string;
};

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  RECEIVED: {
    label: "Recibido",
    publicLabel: "Recibimos tu equipo",
    publicHint: "Está en fila para que un técnico lo revise.",
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    dot: "bg-slate-400",
  },
  DIAGNOSING: {
    label: "En diagnóstico",
    publicLabel: "En diagnóstico",
    publicHint: "Un técnico está revisando tu equipo para decirte qué tiene y cuánto cuesta.",
    badge: "bg-sky-100 text-sky-800 ring-sky-200",
    dot: "bg-sky-500",
  },
  AWAITING_APPROVAL: {
    label: "Esperando aprobación",
    publicLabel: "Tu cotización está lista",
    publicHint: "Revísala aquí abajo. No tocamos tu equipo hasta que la apruebes.",
    badge: "bg-amber-100 text-amber-900 ring-amber-200",
    dot: "bg-amber-500",
  },
  APPROVED: {
    label: "Aprobado",
    publicLabel: "Cotización aprobada",
    publicHint: "Tu equipo entra a reparación en cuanto se libere el banco de trabajo.",
    badge: "bg-teal-100 text-teal-800 ring-teal-200",
    dot: "bg-teal-500",
  },
  IN_REPAIR: {
    label: "En reparación",
    publicLabel: "En reparación",
    publicHint: "Estamos trabajando en tu equipo.",
    badge: "bg-indigo-100 text-indigo-800 ring-indigo-200",
    dot: "bg-indigo-500",
  },
  WAITING_PARTS: {
    label: "Esperando refacción",
    publicLabel: "Esperando una refacción",
    publicHint: "Pedimos la pieza que hace falta. Retomamos la reparación en cuanto llegue.",
    badge: "bg-violet-100 text-violet-800 ring-violet-200",
    dot: "bg-violet-500",
  },
  QUOTE_REJECTED: {
    label: "Cotización rechazada",
    publicLabel: "Cotización rechazada",
    publicHint: "No haremos la reparación. Te avisamos cuando puedas pasar por tu equipo.",
    badge: "bg-rose-100 text-rose-800 ring-rose-200",
    dot: "bg-rose-500",
  },
  READY: {
    label: "Listo para entrega",
    publicLabel: "Listo para que lo recojas",
    publicHint: "Ya puedes pasar por tu equipo. Trae tu folio.",
    badge: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  DELIVERED: {
    label: "Entregado",
    publicLabel: "Entregado",
    publicHint: "Gracias por confiar en nosotros.",
    badge: "bg-zinc-100 text-zinc-600 ring-zinc-200",
    dot: "bg-zinc-400",
  },
  CANCELLED: {
    label: "Cancelado",
    publicLabel: "Orden cancelada",
    publicHint: "Esta orden se canceló. Si tienes dudas, escríbenos.",
    badge: "bg-zinc-100 text-zinc-500 ring-zinc-200 line-through",
    dot: "bg-zinc-300",
  },
};

/** The six steps the customer sees, regardless of the detours inside them. */
export const PUBLIC_STEPS = ["Recibido", "Diagnóstico", "Cotización", "Reparación", "Listo", "Entregado"] as const;

const PUBLIC_STEP_OF: Record<OrderStatus, number> = {
  RECEIVED: 0,
  DIAGNOSING: 1,
  AWAITING_APPROVAL: 2,
  QUOTE_REJECTED: 2,
  APPROVED: 3,
  IN_REPAIR: 3,
  WAITING_PARTS: 3,
  READY: 4,
  DELIVERED: 5,
  CANCELLED: -1,
};

export function publicStepIndex(status: OrderStatus): number {
  return PUBLIC_STEP_OF[status];
}
