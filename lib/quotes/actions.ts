"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ANY_ROLE, BENCH_ROLES, requireRole } from "@/lib/auth/guards";
import { attempt, invalid, text, type ActionState } from "@/lib/forms/action-state";
import { parseMoneyToCents } from "@/lib/money";
import { decideQuote, saveQuoteDraft, sendQuote, withdrawQuote } from "./quote-service";

const itemSchema = z.object({
  kind: z.enum(["LABOR", "PART", "OTHER"]),
  description: z.string().trim().min(1, "Cada concepto necesita una descripción.").max(200),
  quantity: z.coerce.number().int("La cantidad debe ser un número entero.").min(1, "La cantidad mínima es 1.").max(999),
  // Prices arrive as the text the technician typed, and become cents here.
  unitPrice: z.string().transform((value, ctx) => {
    const cents = parseMoneyToCents(value);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Escribe cada precio como un monto, por ejemplo 1250.50." });
      return z.NEVER;
    }
    return cents;
  }),
});

const quoteSchema = z.object({
  orderId: z.string().min(1).max(40),
  notes: z.string().max(1000, "Las notas son demasiado largas."),
  items: z.array(itemSchema).max(40, "Una cotización admite hasta 40 conceptos."),
  intent: z.enum(["save", "send"]),
});

function parseItems(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Saves the draft; with intent "send", also sends it to the customer. */
export async function saveQuoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(...BENCH_ROLES);
  const parsed = quoteSchema.safeParse({
    orderId: text(formData, "orderId"),
    notes: text(formData, "notes"),
    items: parseItems(text(formData, "items")),
    intent: text(formData, "intent"),
  });
  if (!parsed.success) {
    // Line errors have no single field to sit under: show the first one.
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa la cotización." };
  }
  const { orderId, notes, items, intent } = parsed.data;

  return attempt(
    async () => {
      await saveQuoteDraft(
        {
          orderId,
          notes,
          items: items.map(({ unitPrice, ...item }) => ({ ...item, unitPriceCents: unitPrice })),
        },
        actor
      );
      if (intent === "send") await sendQuote(orderId, actor);
      revalidatePath("/admin", "layout");
    },
    intent === "send" ? "Cotización enviada al cliente." : "Borrador guardado."
  );
}

export async function withdrawQuoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(...BENCH_ROLES);
  const orderId = text(formData, "orderId");
  return attempt(async () => {
    await withdrawQuote(orderId, actor);
    revalidatePath("/admin", "layout");
  });
}

const decisionSchema = z.object({
  orderId: z.string().min(1).max(40),
  quoteId: z.string().min(1).max(40),
  decision: z.enum(["approve", "reject"]),
  channel: z.enum(["IN_PERSON", "PHONE"], "Indica cómo respondió el cliente."),
  reason: z.string().max(300, "El motivo es demasiado largo."),
});

/** Staff recording what the customer said at the counter or on the phone. */
export async function recordDecisionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(...ANY_ROLE);
  const parsed = decisionSchema.safeParse({
    orderId: text(formData, "orderId"),
    quoteId: text(formData, "quoteId"),
    decision: text(formData, "decision"),
    channel: text(formData, "channel"),
    reason: text(formData, "reason"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const { quoteId, decision, channel, reason } = parsed.data;

  return attempt(async () => {
    await decideQuote({ quoteId, approve: decision === "approve", reason, by: { kind: "staff", actor, channel } });
    revalidatePath("/admin", "layout");
  });
}
