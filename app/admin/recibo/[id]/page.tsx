import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "@/components/ui/print-button";
import { Logo } from "@/components/ui/primitives";
import { ANY_ROLE, requirePageRole } from "@/lib/auth/guards";
import { formatPhone, normalizePhone } from "@/lib/customers/phone";
import { formatDate, formatDateTime } from "@/lib/dates";
import { DEVICE_KIND_LABEL } from "@/lib/labels";
import { trackingUrl } from "@/lib/notifications/enqueue";
import { getOrderDetail } from "@/lib/orders/queries";
import { getBusiness } from "@/lib/settings/business";

export const metadata: Metadata = { title: "Recibo", robots: { index: false } };

/**
 * The paper the customer leaves with. Its QR code is the tracking link, so
 * "how is my repair going" is a scan away instead of a phone call. Outside
 * the panel's layout on purpose: the page is the printout.
 */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(...ANY_ROLE);
  const { id } = await params;
  const [order, business] = await Promise.all([getOrderDetail(id), getBusiness()]);
  if (!order) notFound();

  const track = trackingUrl(order.publicToken);
  // Rendered on the server as inline SVG: no image request, no client script.
  const qr = await QRCode.toString(track, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  const shopPhone = normalizePhone(business.phone);
  const tz = business.timezone;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 print:max-w-none print:p-0">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href={`/admin/ordenes/${order.id}`} className="btn btn-ghost">
          Volver a la orden
        </Link>
        <PrintButton />
      </div>

      <article className="card p-8 text-sm print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <Logo name={business.name} />
            <p className="mt-3 text-muted">
              {[business.address, business.city].filter(Boolean).join(", ")}
              {shopPhone && <span className="block">Tel. {formatPhone(shopPhone)}</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow text-muted">Orden de servicio</p>
            <p className="mt-1 whitespace-nowrap font-mono text-2xl font-bold">{order.folio}</p>
            <p className="mt-1 text-muted">{formatDateTime(order.receivedAt, tz)}</p>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-line py-6">
          <div>
            <dt className="eyebrow text-muted">Cliente</dt>
            <dd className="mt-1 font-medium">{order.customer.name}</dd>
            <dd className="text-muted">{formatPhone(order.customer.phone)}</dd>
          </div>
          <div>
            <dt className="eyebrow text-muted">Equipo</dt>
            <dd className="mt-1 font-medium">
              {order.device.brand} {order.device.model}
            </dd>
            <dd className="text-muted">
              {DEVICE_KIND_LABEL[order.device.kind]}
              {order.device.color && ` · ${order.device.color}`}
              {order.device.serial && ` · ${order.device.serial}`}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="eyebrow text-muted">Falla reportada</dt>
            <dd className="mt-1 whitespace-pre-line">{order.reportedIssue}</dd>
          </div>
          <div>
            <dt className="eyebrow text-muted">Estado físico al recibir</dt>
            <dd className="mt-1 whitespace-pre-line">{order.intakeCondition || "Sin observaciones"}</dd>
          </div>
          <div>
            <dt className="eyebrow text-muted">Accesorios que deja</dt>
            <dd className="mt-1 whitespace-pre-line">{order.accessories || "Ninguno"}</dd>
          </div>
          {order.promisedAt && (
            <div className="col-span-2">
              <dt className="eyebrow text-muted">Fecha estimada de entrega</dt>
              <dd className="mt-1">{formatDate(order.promisedAt, tz)}</dd>
            </div>
          )}
        </dl>

        <section className="flex items-center gap-6 border-b border-line py-6">
          <div className="h-28 w-28 shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
          <div>
            <h2 className="text-base font-semibold">Sigue tu reparación desde tu celular</h2>
            <p className="mt-1 text-muted">
              Escanea el código para ver el avance y aprobar tu cotización. También puedes entrar al sitio del taller con tu
              folio y los últimos 4 dígitos de tu teléfono.
            </p>
          </div>
        </section>

        {business.terms && (
          <section className="border-b border-line py-6">
            <h2 className="eyebrow text-muted">Condiciones del servicio</h2>
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted">{business.terms}</p>
          </section>
        )}

        <footer className="grid grid-cols-2 gap-10 pt-14 text-center text-xs text-muted">
          <p className="border-t border-ink pt-2">Firma del cliente</p>
          <p className="border-t border-ink pt-2">Recibió: {order.createdBy.name}</p>
        </footer>
      </article>
    </div>
  );
}
