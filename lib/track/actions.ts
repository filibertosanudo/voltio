"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isDomainError } from "@/lib/errors";
import { invalid, text, type ActionState } from "@/lib/forms/action-state";
import { decideQuote } from "@/lib/quotes/quote-service";
import { publicRateLimit } from "@/lib/security/public-rate-limit";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { findTrackingToken } from "./public-order";

const TOO_MANY = "Demasiados intentos. Espera unos minutos y vuelve a intentar.";

const lookupSchema = z.object({
  folio: z.string().min(5, "Escribe el folio de tu recibo.").max(30, "Ese folio es demasiado largo."),
  lastFour: z.string().regex(/^\d{4}$/, "Escribe los últimos 4 dígitos de tu teléfono."),
});

export async function lookupOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const caller = await publicRateLimit(RATE_LIMITS.trackLookup);
  if (!caller.allowed) return { ok: false, message: TOO_MANY };

  const parsed = lookupSchema.safeParse({ folio: text(formData, "folio"), lastFour: text(formData, "lastFour") });
  if (!parsed.success) return invalid(parsed.error);

  const token = await findTrackingToken(parsed.data.folio, parsed.data.lastFour);
  if (!token) {
    return { ok: false, message: "No encontramos una orden con esos datos. Revisa el folio de tu recibo y tu teléfono." };
  }
  redirect(`/r/${token}`);
}

const decisionSchema = z.object({
  token: z.string().min(10).max(64),
  quoteId: z.string().min(10).max(64),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(300, "El motivo es demasiado largo."),
});

export async function decideQuoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const caller = await publicRateLimit(RATE_LIMITS.quoteDecision);
  if (!caller.allowed) return { ok: false, message: TOO_MANY };

  const parsed = decisionSchema.safeParse({
    token: text(formData, "token"),
    quoteId: text(formData, "quoteId"),
    decision: text(formData, "decision"),
    reason: text(formData, "reason"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const { token, quoteId, decision, reason } = parsed.data;

  try {
    await decideQuote({
      quoteId,
      approve: decision === "approve",
      reason,
      by: { kind: "customer", publicToken: token, ip: caller.ip, userAgent: caller.userAgent },
    });
  } catch (error) {
    if (!isDomainError(error)) throw error;
    // The page the customer had open is out of date: show them the current one.
    revalidatePath(`/r/${token}`);
    return { ok: false, message: error.message };
  }
  revalidatePath(`/r/${token}`);
  return { ok: true };
}
