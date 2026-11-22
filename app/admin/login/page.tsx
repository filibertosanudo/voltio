import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/ui/form";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/primitives";
import { demoSignInAction, signInAction } from "@/lib/auth/sign-in-actions";
import { DEMO_ACCOUNTS } from "@/lib/demo/accounts";
import { env } from "@/lib/env";
import { getBusiness } from "@/lib/settings/business";

export const metadata: Metadata = { title: "Acceso del personal", robots: { index: false } };

export default async function LoginPage() {
  const business = await getBusiness();
  const demo = env.DEMO_MODE;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="bench-grid hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <Link href="/">
          <Logo name={business.name} tone="light" />
        </Link>
        <div>
          <p className="eyebrow text-volt">Panel del taller</p>
          <p className="mt-4 max-w-md font-display text-4xl font-bold leading-tight">
            Cada equipo con su folio, su cotización aprobada y su historial.
          </p>
        </div>
        <p className="text-sm text-white/50">Recepción, banco de trabajo y caja en un solo lugar.</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Logo name={business.name} />
          </div>
          <h1 className="mt-8 text-2xl font-bold lg:mt-0">Acceso del personal</h1>
          <p className="mt-1 text-sm text-muted">Entra con el correo y la contraseña que te dio el taller.</p>

          <ActionForm action={signInAction} className="mt-8 space-y-4">
            <Field label="Correo" name="email">
              <input id="email" name="email" type="email" className="input" autoComplete="username" required />
            </Field>
            <Field label="Contraseña" name="password">
              <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
            </Field>
            <SubmitButton className="btn btn-dark w-full py-3" pendingLabel="Entrando…">
              Entrar
            </SubmitButton>
          </ActionForm>

          {demo && (
            <section className="mt-10 rounded-xl border border-dashed border-ink/30 bg-volt-soft/40 p-5" aria-labelledby="demo-title">
              <h2 id="demo-title" className="text-sm font-semibold">
                Demo de portafolio: entra con un clic
              </h2>
              <p className="mt-1 text-xs text-muted">Cada rol ve y puede hacer cosas distintas. Los datos son ficticios.</p>
              <ActionForm action={demoSignInAction} className="mt-4 space-y-2" hideMessage>
                {(["OWNER", "FRONT_DESK", "TECHNICIAN"] as const).map((role) => (
                  <button
                    key={role}
                    type="submit"
                    name="role"
                    value={role}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 text-left text-sm transition hover:border-ink"
                  >
                    <span>
                      <span className="font-semibold">{DEMO_ACCOUNTS[role].label}</span>
                      <span className="block text-xs text-muted">{DEMO_ACCOUNTS[role].hint}</span>
                    </span>
                    <ArrowRightIcon className="shrink-0 text-base" />
                  </button>
                ))}
                <FormMessage />
              </ActionForm>
            </section>
          )}

          <p className="mt-10 text-sm text-muted">
            ¿Buscas tu reparación?{" "}
            <Link href="/#rastrear" className="font-medium text-ink underline underline-offset-4">
              Rastréala aquí
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
