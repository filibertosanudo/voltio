"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ANY_ROLE, BENCH_ROLES, COUNTER_ROLES, requireRole } from "@/lib/auth/guards";
import { normalizePhone, normalizeSerial } from "@/lib/customers/phone";
import { isValidDay, zonedTimeToUtc } from "@/lib/dates";
import { attempt, invalid, text, type ActionState } from "@/lib/forms/action-state";
import { prisma } from "@/lib/prisma";
import { getBusiness } from "@/lib/settings/business";
import { createOrder } from "./create-order";
import { ORDER_STATUSES } from "./status";
import { addNote, transitionOrder } from "./transition";

const DEVICE_KINDS = ["PHONE", "TABLET", "LAPTOP", "DESKTOP", "CONSOLE", "WEARABLE", "OTHER"] as const;

const orderSchema = z.object({
  customerName: z.string().min(2, "Escribe el nombre del cliente.").max(120),
  phone: z.string().min(1, "Escribe el teléfono del cliente."),
  email: z.union([z.literal(""), z.email("Ese correo no es válido.").max(200)]),
  kind: z.enum(DEVICE_KINDS, "Elige el tipo de equipo."),
  brand: z.string().min(1, "Escribe la marca.").max(60),
  model: z.string().min(1, "Escribe el modelo.").max(80),
  serial: z.string().max(60),
  color: z.string().max(40),
  reportedIssue: z.string().min(3, "Describe la falla que reporta el cliente.").max(2000),
  intakeCondition: z.string().max(2000),
  accessories: z.string().max(500),
  promisedAt: z.union([z.literal(""), z.string().refine(isValidDay, "Esa fecha no es válida.")]),
  assignedToId: z.string().max(40),
});

export async function createOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(...COUNTER_ROLES);

  const fields = Object.keys(orderSchema.shape) as (keyof typeof orderSchema.shape)[];
  const parsed = orderSchema.safeParse(Object.fromEntries(fields.map((field) => [field, text(formData, field)])));
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;

  const phone = normalizePhone(data.phone);
  if (!phone) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: { phone: "Escribe un teléfono de 10 dígitos." } };
  }

  const business = await getBusiness();
  const order = await createOrder(
    {
      customer: { name: data.customerName, phone, email: data.email ? data.email.toLowerCase() : null },
      device: { kind: data.kind, brand: data.brand, model: data.model, serial: normalizeSerial(data.serial), color: data.color },
      reportedIssue: data.reportedIssue,
      intakeCondition: data.intakeCondition,
      accessories: data.accessories,
      // "Promised for the 20th" means by closing time that day, in the shop's timezone.
      promisedAt: data.promisedAt ? zonedTimeToUtc(data.promisedAt, 18, business.timezone) : null,
      assignedToId: data.assignedToId || null,
    },
    actor
  );
  revalidatePath("/admin", "layout");
  redirect(`/admin/ordenes/${order.id}`);
}

const transitionSchema = z.object({
  orderId: z.string().min(1).max(40),
  to: z.enum(ORDER_STATUSES),
  note: z.string().max(500, "La nota es demasiado larga."),
});

export async function transitionOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(...ANY_ROLE);
  const parsed = transitionSchema.safeParse({
    orderId: text(formData, "orderId"),
    to: text(formData, "to"),
    note: text(formData, "note"),
  });
  if (!parsed.success) return invalid(parsed.error);
  return attempt(async () => {
    await transitionOrder(parsed.data, actor);
    revalidatePath("/admin", "layout");
  });
}

const noteSchema = z.object({
  orderId: z.string().min(1).max(40),
  message: z.string().min(1, "Escribe la nota.").max(1000, "La nota es demasiado larga."),
  isPublic: z.boolean(),
});

export async function addNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(...ANY_ROLE);
  const parsed = noteSchema.safeParse({
    orderId: text(formData, "orderId"),
    message: text(formData, "message"),
    isPublic: formData.get("isPublic") === "on",
  });
  if (!parsed.success) return invalid(parsed.error);
  return attempt(async () => {
    await addNote(parsed.data, actor);
    revalidatePath(`/admin/ordenes/${parsed.data.orderId}`);
  });
}

const diagnosisSchema = z.object({
  orderId: z.string().min(1).max(40),
  diagnosis: z.string().max(4000, "El diagnóstico es demasiado largo."),
});

export async function updateDiagnosisAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(...BENCH_ROLES);
  const parsed = diagnosisSchema.safeParse({ orderId: text(formData, "orderId"), diagnosis: text(formData, "diagnosis") });
  if (!parsed.success) return invalid(parsed.error);
  return attempt(async () => {
    await prisma.order.update({ where: { id: parsed.data.orderId }, data: { diagnosis: parsed.data.diagnosis } });
    revalidatePath(`/admin/ordenes/${parsed.data.orderId}`);
  }, `Diagnóstico guardado por ${actor.name}.`);
}

const assignSchema = z.object({ orderId: z.string().min(1).max(40), assignedToId: z.string().max(40) });

export async function assignOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(...ANY_ROLE);
  const parsed = assignSchema.safeParse({ orderId: text(formData, "orderId"), assignedToId: text(formData, "assignedToId") });
  if (!parsed.success) return invalid(parsed.error);
  return attempt(async () => {
    await prisma.order.update({
      where: { id: parsed.data.orderId },
      data: { assignedToId: parsed.data.assignedToId || null },
    });
    revalidatePath("/admin", "layout");
  }, "Asignación guardada.");
}
