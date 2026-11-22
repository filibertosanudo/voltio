import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "@/components/ui/icons";
import { Card, EmptyState, PageHeader, Pagination } from "@/components/ui/primitives";
import { ANY_ROLE, requirePageRole } from "@/lib/auth/guards";
import { formatPhone } from "@/lib/customers/phone";
import { listCustomers } from "@/lib/customers/queries";
import { formatDate } from "@/lib/dates";
import { getBusiness } from "@/lib/settings/business";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  await requirePageRole(...ANY_ROLE);
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);
  const [business, { rows, total, pages }] = await Promise.all([getBusiness(), listCustomers({ q, page })]);

  const hrefFor = (next: number) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (next > 1) query.set("pagina", String(next));
    return `/admin/clientes?${query}`;
  };

  return (
    <>
      <PageHeader title="Clientes" description={`${total} ${total === 1 ? "cliente" : "clientes"}`} />
      <form className="relative mb-4 max-w-sm" role="search">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input name="q" defaultValue={q} className="input pl-9" placeholder="Nombre, teléfono o correo" aria-label="Buscar clientes" />
      </form>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState title={q ? "Sin resultados" : "Aún no hay clientes"}>
            {q ? `Nada coincide con "${q}".` : "Se crean solos al recibir su primer equipo."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((customer) => (
              <li key={customer.id}>
                <Link href={`/admin/clientes/${customer.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-paper/70">
                  <span>
                    <span className="block font-medium">{customer.name}</span>
                    <span className="block text-sm text-muted">
                      {formatPhone(customer.phone)}
                      {customer.email && ` · ${customer.email}`}
                    </span>
                  </span>
                  <span className="text-right text-sm text-muted">
                    {customer._count.orders} {customer._count.orders === 1 ? "orden" : "órdenes"} · {customer._count.devices}{" "}
                    {customer._count.devices === 1 ? "equipo" : "equipos"}
                    {customer.orders[0] && <span className="block text-xs">Última visita: {formatDate(customer.orders[0].receivedAt, business.timezone)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pages={pages} hrefFor={hrefFor} />
      </Card>
    </>
  );
}
