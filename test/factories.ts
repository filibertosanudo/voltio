// Builders for integration tests. Each returns what the domain functions
// take, so a test reads as the scenario it sets up and nothing else.
import type { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createOrder, type CreateOrderInput } from "@/lib/orders/create-order";
import type { Actor } from "@/lib/orders/lock";
import { transitionOrder } from "@/lib/orders/transition";
import { saveQuoteDraft, sendQuote, type QuoteItemInput } from "@/lib/quotes/quote-service";

let counter = 0;

export async function makeStaff(role: UserRole = "OWNER"): Promise<Actor> {
  counter++;
  const user = await prisma.user.create({
    data: { name: `Staff ${counter}`, email: `staff${counter}-${Date.now()}@voltio.test`, role, passwordHash: "x" },
  });
  return { id: user.id, role: user.role, name: user.name };
}

export function orderInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    customer: { name: "Ana Torres", phone: "526671234567", email: "ana@example.com" },
    device: { kind: "PHONE", brand: "Samsung", model: "Galaxy S23", serial: "IMEI123456", color: "Negro" },
    reportedIssue: "La pantalla no enciende",
    intakeCondition: "Rayón en la esquina superior",
    accessories: "Funda",
    promisedAt: null,
    assignedToId: null,
    ...overrides,
  };
}

export const SCREEN: QuoteItemInput = { kind: "PART", description: "Pantalla", quantity: 1, unitPriceCents: 180_000 };
export const LABOR: QuoteItemInput = { kind: "LABOR", description: "Mano de obra", quantity: 1, unitPriceCents: 45_000 };

/** An order whose quote (2,250.00 + 16% = 2,610.00) is waiting for the customer. */
export async function orderAwaitingApproval(actor: Actor, items: QuoteItemInput[] = [SCREEN, LABOR]) {
  const order = await createOrder(orderInput(), actor);
  await transitionOrder({ orderId: order.id, to: "DIAGNOSING", note: "" }, actor);
  const quoteId = await saveQuoteDraft({ orderId: order.id, items, notes: "" }, actor);
  await sendQuote(order.id, actor);
  return { ...order, quoteId };
}

export const QUOTE_TOTAL_CENTS = 261_000;
