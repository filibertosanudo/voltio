import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlusIcon, ShieldIcon } from "@/components/ui/icons";
import { Card, CardHeader, EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { ANY_ROLE, requirePageRole } from "@/lib/auth/guards";
import { formatPhone } from "@/lib/customers/phone";
import { getCustomer } from "@/lib/customers/queries";
import { formatDate } from "@/lib/dates";
import { DEVICE_KIND_LABEL } from "@/lib/labels";
import { getBusiness } from "@/lib/settings/business";

export const metadata: Metadata = { title: "Cliente" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageRole(...ANY_ROLE);
  const { id } = await params;
  const [customer, business] = await Promise.all([getCustomer(id), getBusiness()]);
  if (!customer) notFound();

  const now = new Date();
  const canReceive = actor.role !== "TECHNICIAN";

  return (
    <>
      <PageHeader
        title={customer.name}
        description={[formatPhone(customer.phone), customer.email].filter(Boolean).join(" · ")}
        actions={
          canReceive && (
            <Link href={`/admin/ordenes/nueva?cliente=${customer.id}`} className="btn btn-primary">
              <PlusIcon /> Recibir otro equipo
            </Link>
          )
        }
      />

      {customer.devices.length === 0 ? (
        <Card>
          <EmptyState title="Sin equipos registrados" />
        </Card>
      ) : (
        <div className="space-y-6">
          {customer.devices.map((device) => {
            const warranty = device.orders.find((order) => order.warrantyUntil && order.warrantyUntil >= now);
            return (
              <Card key={device.id} className="overflow-hidden">
                <CardHeader
                  title={`${device.brand} ${device.model}`}
                  description={[DEVICE_KIND_LABEL[device.kind], device.color, device.serial].filter(Boolean).join(" · ")}
                  aside={
                    canReceive && (
                      <Link href={`/admin/ordenes/nueva?cliente=${customer.id}&equipo=${device.id}`} className="btn btn-ghost btn-sm">
                        Recibir este equipo
                      </Link>
                    )
                  }
                />
                {warranty?.warrantyUntil && (
                  <p className="flex items-center gap-2 border-b border-line bg-emerald-50 px-5 py-2.5 text-sm text-emerald-900">
                    <ShieldIcon /> En garantía hasta el {formatDate(warranty.warrantyUntil, business.timezone)} (orden {warranty.folio})
                  </p>
                )}
                <ul className="divide-y divide-line">
                  {device.orders.map((order) => (
                    <li key={order.id}>
                      <Link href={`/admin/ordenes/${order.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm transition hover:bg-paper/70">
                        <span className="min-w-0">
                          <span className="font-mono font-medium">{order.folio}</span>
                          <span className="ml-2 text-muted">{formatDate(order.receivedAt, business.timezone)}</span>
                          <span className="block truncate text-muted">{order.reportedIssue}</span>
                        </span>
                        <StatusBadge status={order.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
