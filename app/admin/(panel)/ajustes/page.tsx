import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { XIcon } from "@/components/ui/icons";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { OWNER_ONLY, requirePageRole } from "@/lib/auth/guards";
import { formatPhone, normalizePhone } from "@/lib/customers/phone";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { addServiceAction, removeServiceAction, updateBusinessAction } from "@/lib/settings/actions";
import { getBusiness } from "@/lib/settings/business";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  await requirePageRole(...OWNER_ONLY);
  const [business, services] = await Promise.all([getBusiness(), prisma.service.findMany({ orderBy: { position: "asc" } })]);
  const whatsapp = business.whatsapp ? formatPhone(business.whatsapp) : "";
  const phone = normalizePhone(business.phone);

  return (
    <>
      <PageHeader title="Ajustes" description="Lo que ven tus clientes en el sitio, en sus correos y en el recibo." />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <ActionForm action={updateBusinessAction} className="space-y-6">
          <Card>
            <CardHeader title="El taller" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Nombre" name="name">
                <input id="name" name="name" className="input" defaultValue={business.name} required />
              </Field>
              <Field label="Giro o lema" name="tagline">
                <input id="tagline" name="tagline" className="input" defaultValue={business.tagline} />
              </Field>
              <Field label="Teléfono" name="phone">
                <input id="phone" name="phone" className="input" inputMode="tel" defaultValue={phone ? formatPhone(phone) : business.phone} />
              </Field>
              <Field label="WhatsApp" name="whatsapp" hint="10 dígitos. Aparece como botón en el sitio.">
                <input id="whatsapp" name="whatsapp" className="input" inputMode="tel" defaultValue={whatsapp} />
              </Field>
              <Field label="Correo" name="email">
                <input id="email" name="email" type="email" className="input" defaultValue={business.email} />
              </Field>
              <Field label="Ciudad" name="city">
                <input id="city" name="city" className="input" defaultValue={business.city} />
              </Field>
              <Field label="Dirección" name="address" className="sm:col-span-2">
                <input id="address" name="address" className="input" defaultValue={business.address} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Horario" description="Hasta cuatro renglones, como quieras describirlos." />
            <div className="space-y-2 p-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <input name={`hoursLabel${i}`} className="input" maxLength={40} defaultValue={business.hours[i]?.label} placeholder="Lunes a viernes" aria-label={`Días, renglón ${i + 1}`} />
                  <input name={`hoursValue${i}`} className="input" maxLength={40} defaultValue={business.hours[i]?.value} placeholder="9:00 a 19:00" aria-label={`Horas, renglón ${i + 1}`} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Operación" />
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <Field label="Impuesto (%)" name="taxRate" hint="Se aplica a las cotizaciones nuevas.">
                <input id="taxRate" name="taxRate" className="input" inputMode="decimal" defaultValue={business.taxRateBps / 100} />
              </Field>
              <Field label="Garantía (días)" name="defaultWarrantyDays" hint="Se fija al entregar cada equipo.">
                <input id="defaultWarrantyDays" name="defaultWarrantyDays" className="input" inputMode="numeric" defaultValue={business.defaultWarrantyDays} />
              </Field>
              <Field label="Prefijo del folio" name="folioPrefix">
                <input id="folioPrefix" name="folioPrefix" className="input font-mono uppercase" maxLength={4} defaultValue={business.folioPrefix} />
              </Field>
              <Field label="Condiciones del servicio" name="terms" className="sm:col-span-3" hint="Se imprimen en el recibo de recepción.">
                <textarea id="terms" name="terms" rows={5} maxLength={2000} className="input" defaultValue={business.terms} />
              </Field>
            </div>
          </Card>

          <SubmitButton className="btn btn-primary px-6 py-3">Guardar ajustes</SubmitButton>
        </ActionForm>

        <Card className="self-start overflow-hidden">
          <CardHeader title="Servicios del sitio" description="La lista que ven tus clientes en la página principal." />
          <ul className="divide-y divide-line">
            {services.map((service) => (
              <li key={service.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{service.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {service.fromPriceCents !== null && `desde ${formatMoney(service.fromPriceCents, business.currency)}`}
                    {service.turnaround && ` · ${service.turnaround}`}
                  </span>
                </span>
                <ActionForm action={removeServiceAction} hideMessage>
                  <input type="hidden" name="serviceId" value={service.id} />
                  <button type="submit" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-rose-50 hover:text-rose-700" aria-label={`Quitar ${service.name}`}>
                    <XIcon />
                  </button>
                </ActionForm>
              </li>
            ))}
          </ul>
          <ActionForm action={addServiceAction} className="space-y-3 border-t border-line p-5">
            <Field label="Nuevo servicio" name="name" id="service-name">
              <input id="service-name" name="name" className="input" placeholder="Cambio de batería" required />
            </Field>
            <Field label="Descripción" name="description">
              <input id="description" name="description" className="input" maxLength={200} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Precio desde" name="fromPrice">
                <input id="fromPrice" name="fromPrice" className="input" inputMode="decimal" placeholder="899" />
              </Field>
              <Field label="Tiempo" name="turnaround">
                <input id="turnaround" name="turnaround" className="input" placeholder="1 hora" maxLength={40} />
              </Field>
            </div>
            <SubmitButton className="btn btn-ghost w-full">Agregar servicio</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
