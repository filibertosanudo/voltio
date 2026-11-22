"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { OWNER_ONLY, requireRole } from "@/lib/auth/guards";
import { DomainError } from "@/lib/errors";
import { attempt, invalid, text, type ActionState } from "@/lib/forms/action-state";
import { createStaff, resetStaffPassword, setStaffActive } from "./team-service";

const staffSchema = z.object({
  name: z.string().min(2, "Escribe el nombre.").max(120),
  email: z.email("Ese correo no es válido.").max(200),
  role: z.enum(["OWNER", "FRONT_DESK", "TECHNICIAN"], "Elige un rol."),
});

const passwordNotice = (name: string, password: string) =>
  `Contraseña temporal de ${name}: ${password} — cópiala ahora, no se vuelve a mostrar.`;

export async function createStaffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(...OWNER_ONLY);
  const parsed = staffSchema.safeParse({ name: text(formData, "name"), email: text(formData, "email"), role: text(formData, "role") });
  if (!parsed.success) return invalid(parsed.error);

  let password = "";
  const result = await attempt(async () => {
    password = await createStaff(parsed.data);
    revalidatePath("/admin/equipo");
  });
  return result?.ok ? { ok: true, message: passwordNotice(parsed.data.name, password) } : result;
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(...OWNER_ONLY);
  const userId = text(formData, "userId");
  let password = "";
  const result = await attempt(async () => {
    password = await resetStaffPassword(userId);
  });
  return result?.ok ? { ok: true, message: passwordNotice(text(formData, "name"), password) } : result;
}

export async function setStaffActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(...OWNER_ONLY);
  const userId = text(formData, "userId");
  const active = text(formData, "active") === "true";
  return attempt(async () => {
    // Locking yourself out is never what was meant.
    if (!active && userId === actor.id) throw new DomainError("LAST_OWNER");
    await setStaffActive(userId, active);
    revalidatePath("/admin/equipo");
  });
}
