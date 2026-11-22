import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { OWNER_ONLY, requirePageRole } from "@/lib/auth/guards";
import { ROLE_LABEL } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { createStaffAction, resetPasswordAction, setStaffActiveAction } from "@/lib/team/actions";

export const metadata: Metadata = { title: "Equipo" };

export default async function TeamPage() {
  const actor = await requirePageRole(...OWNER_ONLY);
  const staff = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  return (
    <>
      <PageHeader title="Equipo" description="Quién entra al panel y qué puede hacer." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="overflow-hidden">
          <CardHeader title="Cuentas" description="Una cuenta desactivada conserva su historial y deja de poder entrar en menos de un minuto." />
          <ul className="divide-y divide-line">
            {staff.map((person) => (
              <li key={person.id} className={`px-5 py-4 ${person.active ? "" : "bg-paper/60"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-medium">{person.name}</span>
                    {person.id === actor.id && <span className="ml-2 text-xs text-muted">(tú)</span>}
                    {!person.active && <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-700">Desactivada</span>}
                    <span className="block text-muted">
                      {ROLE_LABEL[person.role]} · {person.email}
                    </span>
                  </p>
                  <div className="flex flex-wrap items-start gap-2">
                    <ActionForm action={resetPasswordAction} className="space-y-2">
                      <input type="hidden" name="userId" value={person.id} />
                      <input type="hidden" name="name" value={person.name} />
                      <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="Generando…">
                        Nueva contraseña
                      </SubmitButton>
                    </ActionForm>
                    {person.id !== actor.id && (
                      <ActionForm action={setStaffActiveAction} className="space-y-2">
                        <input type="hidden" name="userId" value={person.id} />
                        <input type="hidden" name="active" value={String(!person.active)} />
                        <SubmitButton className={`btn btn-sm ${person.active ? "btn-danger" : "btn-ghost"}`}>
                          {person.active ? "Desactivar" : "Reactivar"}
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Agregar persona" description="Se genera una contraseña temporal que se muestra una sola vez." />
          <ActionForm action={createStaffAction} className="space-y-4 p-5">
            <Field label="Nombre" name="name">
              <input id="name" name="name" className="input" autoComplete="off" required />
            </Field>
            <Field label="Correo" name="email">
              <input id="email" name="email" type="email" className="input" autoComplete="off" required />
            </Field>
            <Field label="Rol" name="role" hint="Recepción recibe, cobra y entrega. Técnico diagnostica, cotiza y repara.">
              <select id="role" name="role" className="input" defaultValue="TECHNICIAN">
                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <SubmitButton className="btn btn-primary w-full">Crear cuenta</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
