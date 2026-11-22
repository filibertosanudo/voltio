import type { z } from "zod";
import { isDomainError } from "@/lib/errors";

/** What a Server Action hands back to the form that called it. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

export function invalid(error: z.ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] ??= issue.message;
  }
  return { ok: false, message: "Revisa los campos marcados.", fieldErrors };
}

/**
 * Runs the mutation and turns a business rule's refusal into a message for
 * the form. Anything else is rethrown: a bug should look like one, and
 * redirect() works by throwing.
 */
export async function attempt(fn: () => Promise<void>, success?: string): Promise<ActionState> {
  try {
    await fn();
    return { ok: true, message: success };
  } catch (error) {
    if (isDomainError(error)) return { ok: false, message: error.message };
    throw error;
  }
}

/** FormData.get() as trimmed text; a missing field and a file both read as "". */
export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
