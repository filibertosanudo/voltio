import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, SearchIcon } from "@/components/ui/icons";
import { Card, EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/primitives";
import { ANY_ROLE, requirePageRole } from "@/lib/auth/guards";
import { formatDate } from "@/lib/dates";
import { ORDER_FILTERS, isOrderFilter, listOrders, type OrderFilter } from "@/lib/orders/queries";
import { getBusiness } from "@/lib/settings/business";

export const metadata: Metadata = { title: "Órdenes" };

type SearchParams = Promise<{ filtro?: string; q?: string; pagina?: string }>;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePageRole(...ANY_ROLE);
  const params = await searchParams;
  const filter: OrderFilter = isOrderFilter(params.filtro) ? params.filtro : "abiertas";
  const q = (params.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);

  const business = await getBusiness();
  const { rows, total, pages } = await listOrders({ filter, q, page });

  const hrefFor = (next: { filter?: OrderFilter; page?: number }) => {
    const query = new URLSearchParams({ filtro: next.filter ?? filter });
    if (q) query.set("q", q);
    if (next.page && next.page > 1) query.set("pagina", String(next.page));
    return `/admin/ordenes?${query}`;
  };

  return (
    <>
      <PageHeader
        title="Órdenes de servicio"
        description={`${total} ${total === 1 ? "orden" : "órdenes"} en esta vista`}
        actions={
          actor.role !== "TECHNICIAN" && (
            <Link href="/admin/ordenes/nueva" className="btn btn-primary">
              <PlusIcon /> Recibir equipo
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1.5" aria-label="Filtrar por estado">
          {(Object.keys(ORDER_FILTERS) as OrderFilter[]).map((key) => (
            <Link
              key={key}
              href={hrefFor({ filter: key })}
              aria-current={key === filter ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                key === filter ? "bg-ink text-white" : "border border-line bg-white text-muted hover:text-ink"
              }`}
            >
              {ORDER_FILTERS[key].label}
            </Link>
          ))}
        </nav>
        <form className="relative w-full sm:w-72" role="search">
          <input type="hidden" name="filtro" value={filter} />
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            className="input pl-9"
            placeholder="Folio, cliente, teléfono, IMEI…"
            aria-label="Buscar órdenes"
          />
        </form>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState title={q ? "Sin resultados" : "No hay órdenes en esta vista"}>
            {q ? `Nada coincide con "${q}". Prueba con el folio completo o el teléfono.` : "Cuando recibas un equipo aparecerá aquí."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-paper/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Folio</th>
                  <th className="px-3 py-3 font-medium">Equipo y cliente</th>
                  <th className="px-3 py-3 font-medium">Estado</th>
                  <th className="px-3 py-3 font-medium">Técnico</th>
                  <th className="px-5 py-3 font-medium">Recibido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-paper/70">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/ordenes/${row.id}`} className="whitespace-nowrap font-mono font-medium underline-offset-4 hover:underline">
                        {row.folio}
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="block font-medium">
                        {row.device.brand} {row.device.model}
                      </span>
                      <span className="block text-xs text-muted">{row.customer.name}</span>
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusBadge status={row.status} />
                      {row.overdue && <span className="mt-1 block text-xs font-medium text-rose-700">Atrasada</span>}
                    </td>
                    <td className="px-3 py-3.5 text-muted">{row.assignedTo?.name ?? "Sin asignar"}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-muted">{formatDate(row.receivedAt, business.timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pages={pages} hrefFor={(next) => hrefFor({ page: next })} />
      </Card>
    </>
  );
}
