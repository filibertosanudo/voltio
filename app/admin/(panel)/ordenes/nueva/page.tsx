import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { COUNTER_ROLES, requirePageRole } from "@/lib/auth/guards";
import { formatPhone } from "@/lib/customers/phone";
import { localDay } from "@/lib/dates";
import { DEVICE_KIND_LABEL } from "@/lib/labels";
import { createOrderAction } from "@/lib/orders/actions";
import { listAssignableStaff } from "@/lib/orders/queries";
import { prisma } from "@/lib/prisma";
import { getBusiness } from "@/lib/settings/business";

export const metadata: Metadata = { title: "Recibir equipo" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ cliente?: string; equipo?: string }> }) {
  await requirePageRole(...COUNTER_ROLES);
  const params = await searchParams;
  const business = await getBusiness();

  // Coming from a customer's page: their details, and optionally one of
  // their devices, are filled in. The action still finds them by phone and
  // serial, so nothing here is trusted as an id.
  const [staff, customer, device] = await Promise.all([
    listAssignableStaff(),
    params.cliente ? prisma.customer.findUnique({ where: { id: params.cliente } }) : null,
    params.equipo ? prisma.device.findUnique({ where: { id: params.equipo } }) : null,
  ]);
  const knownDevice = device && customer && device.customerId === customer.id ? device : null;

  return (
    <>
      <PageHeader title="Recibir equipo" description="Anota cómo llega el equipo antes de que alguien lo abra." />

      <ActionForm action={createOrderAction} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Cliente" description="Si el teléfono ya existe, la orden se liga a ese cliente." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Nombre completo" name="customerName" className="sm:col-span-2">
                <input id="customerName" name="customerName" className="input" defaultValue={customer?.name} autoComplete="off" required />
              </Field>
              <Field label="Teléfono" name="phone" hint="10 dígitos. Es como lo buscamos después.">
                <input
                  id="phone"
                  name="phone"
                  className="input"
                  inputMode="tel"
                  defaultValue={customer ? formatPhone(customer.phone) : undefined}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label="Correo (opcional)" name="email" hint="Para avisarle de cada cambio.">
                <input id="email" name="email" type="email" className="input" defaultValue={customer?.email ?? undefined} autoComplete="off" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Equipo" description="El IMEI o número de serie liga el equipo con su historial y su garantía." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Tipo" name="kind">
                <select id="kind" name="kind" className="input" defaultValue={knownDevice?.kind ?? "PHONE"}>
                  {Object.entries(DEVICE_KIND_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Marca" name="brand">
                <input id="brand" name="brand" className="input" defaultValue={knownDevice?.brand} placeholder="Samsung" required />
              </Field>
              <Field label="Modelo" name="model">
                <input id="model" name="model" className="input" defaultValue={knownDevice?.model} placeholder="Galaxy S23" required />
              </Field>
              <Field label="Color (opcional)" name="color">
                <input id="color" name="color" className="input" defaultValue={knownDevice?.color} />
              </Field>
              <Field label="IMEI o número de serie (opcional)" name="serial" className="sm:col-span-2">
                <input id="serial" name="serial" className="input font-mono uppercase" defaultValue={knownDevice?.serial ?? undefined} autoComplete="off" />
              </Field>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Recepción" />
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <Field label="Falla que reporta el cliente" name="reportedIssue" className="lg:col-span-2">
              <textarea id="reportedIssue" name="reportedIssue" rows={3} className="input" placeholder="No enciende desde que se cayó al agua" required />
            </Field>
            <Field label="Estado físico al recibir" name="intakeCondition" hint="Golpes, rayones, pantalla estrellada, tornillos faltantes.">
              <textarea id="intakeCondition" name="intakeCondition" rows={3} className="input" />
            </Field>
            <Field label="Accesorios que deja" name="accessories" hint="Funda, cargador, SIM, memoria.">
              <textarea id="accessories" name="accessories" rows={3} className="input" />
            </Field>
            <Field label="Fecha estimada de entrega (opcional)" name="promisedAt">
              <input id="promisedAt" name="promisedAt" type="date" className="input" min={localDay(new Date(), business.timezone)} />
            </Field>
            <Field label="Técnico asignado (opcional)" name="assignedToId">
              <select id="assignedToId" name="assignedToId" className="input" defaultValue="">
                <option value="">Sin asignar</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton className="btn btn-primary px-6 py-3" pendingLabel="Creando orden…">
            Crear orden y generar folio
          </SubmitButton>
          <Link href="/admin/ordenes" className="btn btn-ghost">
            Cancelar
          </Link>
        </div>
      </ActionForm>
    </>
  );
}
