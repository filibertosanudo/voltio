"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { COUNTER_ROLES, requireRole } from "@/lib/auth/guards";
import { attempt, invalid, text, type ActionState } from "@/lib/forms/action-state";
import { parseMoneyToCents } from "@/lib/money";
import { recordPayment } from "./record-payment";

const paymentSchema = z.object({
  orderId: z.string().min(1).max(40),
  kind: z.enum(["PAYMENT", "REFUND"]),
  method: z.enum(["CASH", "CARD", "TRANSFER"], "Elige la forma de pago."),
  amount: z.string().transform((value, ctx) => {
    const cents = parseMoneyToCents(value);
    if (cents === null || cents === 0) {
      ctx.addIssue({ code: "custom", message: "Escribe un monto mayor a cero, por ejemplo 500 o 1250.50." });
      return z.NEVER;
    }
    return cents;
  }),
  note: z.string().max(200, "La nota es demasiado larga."),
});

export async function recordPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(...COUNTER_ROLES);
  const parsed = paymentSchema.safeParse({
    orderId: text(formData, "orderId"),
    kind: text(formData, "kind"),
    method: text(formData, "method"),
    amount: text(formData, "amount"),
    note: text(formData, "note"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const { amount, ...rest } = parsed.data;

  return attempt(async () => {
    await recordPayment({ ...rest, amountCents: amount }, actor);
    revalidatePath("/admin", "layout");
  });
}
