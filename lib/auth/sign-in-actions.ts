"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { DEMO_ACCOUNTS } from "@/lib/demo/accounts";
import { env } from "@/lib/env";
import { text, type ActionState } from "@/lib/forms/action-state";
import { publicRateLimit } from "@/lib/security/public-rate-limit";

// Generous: this only bounds the form itself. The real limits, per email
// and per address, are inside authenticate(), which the Auth.js endpoint
// reaches too.
const FORM_LIMIT = { scope: "sign-in-form", limit: 40, windowSeconds: 900 };
const FAILED = "Correo o contraseña incorrectos.";

async function signInWith(email: string, password: string): Promise<ActionState> {
  try {
    // Throws a redirect on success, an AuthError on bad credentials.
    await signIn("credentials", { email, password, redirectTo: "/admin" });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, message: FAILED };
    throw error;
  }
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const caller = await publicRateLimit(FORM_LIMIT);
  if (!caller.allowed) return { ok: false, message: "Demasiados intentos. Espera unos minutos." };
  return signInWith(text(formData, "email"), String(formData.get("password") ?? ""));
}

const roleSchema = z.enum(["OWNER", "FRONT_DESK", "TECHNICIAN"]);

/** One click into the demo as a role. Does nothing unless DEMO_MODE=1. */
export async function demoSignInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const caller = await publicRateLimit(FORM_LIMIT);
  const role = roleSchema.safeParse(text(formData, "role"));
  if (!caller.allowed || !env.DEMO_MODE || !role.success) return { ok: false, message: FAILED };
  const account = DEMO_ACCOUNTS[role.data];
  return signInWith(account.email, account.password);
}
