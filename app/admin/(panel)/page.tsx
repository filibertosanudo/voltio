import type { Metadata } from "next";
import Link from "next/link";
import { AlertIcon, ArrowRightIcon } from "@/components/ui/icons";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ANY_ROLE, requirePageRole } from "@/lib/auth/guards";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getDashboard } from "@/lib/orders/queries";
import { getBusiness } from "@/lib/settings/business";

export const metadata: Metadata = { title: "Resumen" };

type Row = Awaited<ReturnType<typeof getDashboard>>["lists"]["awaiting"][number];

function AttentionList({ title, description, rows, empty, detail }: {
  title: string;
  description: string;
  rows: Row[];
  empty: string;
  detail: (row: Row) => string | null;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {rows.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/admin/ordenes/${row.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-paper">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {row.device.brand} {row.device.model}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    <span className="font-mono">{row.folio}</span> · {row.customer.name}
                    {detail(row) && ` · ${detail(row)}`}
                  </span>
                </span>
                <ArrowRightIcon className="shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function DashboardPage() {
  const actor = await requirePageRole(...ANY_ROLE);
  const business = await getBusiness();
  const data = await getDashboard(business.timezone);
  const tz = business.timezone;

  const stats = [
    { label: "Órdenes abiertas", value: data.open, href: "/admin/ordenes?filtro=abiertas", hint: `${data.received} sin revisar` },
    { label: "En banco", value: data.onBench, href: "/admin/ordenes?filtro=en-banco", hint: "diagnóstico y reparación" },
    { label: "Esperan aprobación", value: data.awaitingApproval, href: "/admin/ordenes?filtro=por-aprobar", hint: "cotizaciones sin respuesta" },
    { label: "Listas para entrega", value: data.readyForPickup, href: "/admin/ordenes?filtro=listas", hint: "el cliente puede recoger" },
  ];

  return (
    <>
      <PageHeader title={`Hola, ${actor.name.split(" ")[0]}`} description="Así está el taller en este momento." />

      {data.overdue > 0 && (
        <p className="mb-6 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertIcon className="shrink-0 text-base" />
          {data.overdue === 1 ? "Hay 1 orden atrasada" : `Hay ${data.overdue} órdenes atrasadas`} respecto a la fecha prometida al cliente.
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <li key={stat.label}>
            <Link href={stat.href} className="card block p-5 transition hover:-translate-y-0.5 hover:border-ink">
              <p className="text-sm text-muted">{stat.label}</p>
              <p className="mt-2 font-display text-4xl font-bold tabular-nums">{stat.value}</p>
              <p className="mt-1 text-xs text-muted">{stat.hint}</p>
            </Link>
          </li>
        ))}
      </ul>

      {actor.role === "OWNER" && (
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          <li className="card bg-ink p-5 text-white">
            <p className="text-sm text-white/60">Cobrado este mes</p>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums text-volt">{formatMoney(data.monthRevenueCents, business.currency)}</p>
            <p className="mt-1 text-xs text-white/50">pagos menos reembolsos</p>
          </li>
          <li className="card p-5">
            <p className="text-sm text-muted">Equipos entregados este mes</p>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums">{data.deliveredThisMonth}</p>
          </li>
          <li className="card p-5">
            <p className="text-sm text-muted">Tiempo promedio de entrega</p>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums">
              {data.turnaroundDays === null ? "—" : `${data.turnaroundDays.toFixed(1)} días`}
            </p>
            <p className="mt-1 text-xs text-muted">últimas 30 entregas</p>
          </li>
        </ul>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <AttentionList
          title="Esperan respuesta del cliente"
          description="Una llamada suele destrabarlas."
          rows={data.lists.awaiting}
          empty="Ninguna cotización pendiente"
          detail={() => null}
        />
        <AttentionList
          title="Listas, sin recoger"
          description="Las más antiguas primero."
          rows={data.lists.ready}
          empty="Nada esperando en mostrador"
          detail={(row) => (row.readyAt ? `lista desde el ${formatDate(row.readyAt, tz)}` : null)}
        />
        <AttentionList
          title="Atrasadas"
          description="Pasó la fecha prometida."
          rows={data.lists.late}
          empty="Todo va en tiempo"
          detail={(row) => (row.promisedAt ? `prometida para el ${formatDate(row.promisedAt, tz)}` : null)}
        />
      </div>
    </>
  );
}
