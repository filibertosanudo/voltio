"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import type { ActionState } from "@/lib/forms/action-state";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const FormContext = createContext<{ state: ActionState; pending: boolean }>({ state: null, pending: false });

/**
 * A form bound to a Server Action. It works before JavaScript loads (the
 * browser posts it), and once hydrated it shows the action's answer in
 * place: field errors under their fields, the message at the bottom.
 *
 * The submit is dispatched by hand rather than left to `action={...}`:
 * React clears a form after its action runs, success or not, and someone
 * who mistyped one field should not have to type the other nine again.
 * The form is reset only when the action says it worked.
 */
export function ActionForm({
  action,
  children,
  className,
  hideMessage = false,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  hideMessage?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The pressed button's own name and value are part of the submission.
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(data));
  }

  return (
    <form ref={form} action={formAction} onSubmit={onSubmit} className={className} noValidate>
      <FormContext.Provider value={{ state, pending }}>
        {children}
        {!hideMessage && <FormMessage />}
      </FormContext.Provider>
    </form>
  );
}

export function FormMessage({ className = "" }: { className?: string }) {
  const { state } = useContext(FormContext);
  if (!state?.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-lg px-3 py-2 text-sm ${
        state.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
      } ${className}`}
    >
      {state.message}
    </p>
  );
}

/** A label, its control and, after a failed submit, that field's error. */
export function Field({
  label,
  name,
  id = name,
  hint,
  children,
  className = "",
}: {
  label: string;
  name: string;
  /** The control's id, when it cannot be the field name (two forms on one page with a field of the same name). */
  id?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const error = useContext(FormContext).state?.fieldErrors?.[name];
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

export function SubmitButton({
  children,
  className = "btn btn-primary",
  name,
  value,
  pendingLabel = "Guardando…",
}: {
  children: ReactNode;
  className?: string;
  name?: string;
  value?: string;
  pendingLabel?: string;
}) {
  const { pending } = useContext(FormContext);
  return (
    <button type="submit" name={name} value={value} className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
