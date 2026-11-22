"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { OWNER_ONLY, requireRole } from "@/lib/auth/guards";
import { normalizePhone } from "@/lib/customers/phone";
import { attempt, invalid, text, type ActionState } from "@/lib/forms/action-state";
import { parseMoneyToCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { hoursSchema } from "./business";

const businessSchema = z.object({
  name: z.string().min(2, "Escribe el nombre del taller.").max(80),
  tagline: z.string().max(160),
  phone: z.string().max(30),
  whatsapp: z.string().max(30),
  email: z.union([z.literal(""), z.email("Ese correo no es válido.").max(200)]),
  address: z.string().max(200),
  city: z.string().max(80),
  taxRate: z.coerce.number("Escribe el porcentaje de impuesto.").min(0, "Mínimo 0%.").max(100, "Máximo 100%."),
  defaultWarrantyDays: z.coerce.number("Escribe los días de garantía.").int().min(0, "Mínimo 0 días.").max(730, "Máximo 730 días."),
  folioPrefix: z.string().toUpperCase().regex(/^[A-Z]{2,4}$/, "De 2 a 4 letras."),
  terms: z.string().max(2000),
});

export async function updateBusinessAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(...OWNER_ONLY);
  const fields = Object.keys(businessSchema.shape) as (keyof typeof businessSchema.shape)[];
  const parsed = businessSchema.safeParse(Object.fromEntries(fields.map((field) => [field, text(formData, field)])));
  if (!parsed.success) return invalid(parsed.error);

  // Up to four "days / hours" rows; a row left blank is dropped.
  const rows = [0, 1, 2, 3]
    .map((i) => ({ label: text(formData, `hoursLabel${i}`), value: text(formData, `hoursValue${i}`) }))
    .filter((row) => row.label && row.value);
  const hours = hoursSchema.safeParse(rows);
  if (!hours.success) return { ok: false, message: "Revisa el horario: cada renglón admite hasta 40 caracteres." };

  const { taxRate, whatsapp, ...rest } = parsed.data;
  return attempt(async () => {
    await prisma.business.update({
      where: { id: "main" },
      data: {
        ...rest,
        whatsapp: whatsapp ? (normalizePhone(whatsapp) ?? "") : "",
        taxRateBps: Math.round(taxRate * 100),
        hours: hours.data,
      },
    });
    revalidatePath("/", "layout");
  }, "Ajustes guardados.");
}

const serviceSchema = z.object({
  name: z.string().min(2, "Escribe el nombre del servicio.").max(80),
  description: z.string().max(200),
  turnaround: z.string().max(40),
  fromPrice: z.string().max(20),
});

export async function addServiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(...OWNER_ONLY);
  const parsed = serviceSchema.safeParse({
    name: text(formData, "name"),
    description: text(formData, "description"),
    turnaround: text(formData, "turnaround"),
    fromPrice: text(formData, "fromPrice"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { fromPrice, ...rest } = parsed.data;
  const fromPriceCents = fromPrice ? parseMoneyToCents(fromPrice) : null;
  if (fromPrice && fromPriceCents === null) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: { fromPrice: "Escribe un monto, por ejemplo 899." } };
  }

  return attempt(async () => {
    const last = await prisma.service.aggregate({ _max: { position: true } });
    await prisma.service.create({ data: { ...rest, fromPriceCents, position: (last._max.position ?? 0) + 1 } });
    revalidatePath("/", "layout");
  });
}

export async function removeServiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(...OWNER_ONLY);
  const id = text(formData, "serviceId");
  return attempt(async () => {
    await prisma.service.deleteMany({ where: { id } });
    revalidatePath("/", "layout");
  });
}
