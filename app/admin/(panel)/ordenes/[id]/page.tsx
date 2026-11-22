import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AssignForm,
  DecisionPanel,
  DiagnosisForm,
  MovePanel,
  NoteForm,
  PaymentForm,
  PhotoForm,
  QuoteLines,
} from "@/components/admin/order-panels";
import { QuoteEditor, type EditorLine } from "@/components/admin/quote-editor";
import { AlertIcon, ChatIcon, EyeIcon, PrinterIcon, ShieldIcon } from "@/components/ui/icons";
import { Photo } from "@/components/ui/photo";
import { Card, CardHeader, StatusBadge } from "@/components/ui/primitives";
import { ANY_ROLE, requirePageRole } from "@/lib/auth/guards";
import { formatPhone } from "@/lib/customers/phone";
import { formatDate, formatDateTime } from "@/lib/dates";
import { CHANNEL_LABEL, DEVICE_KIND_LABEL, PAYMENT_METHOD_LABEL, QUOTE_STATUS_LABEL } from "@/lib/labels";
import { centsToInput, formatMoney } from "@/lib/money";
import { trackingUrl } from "@/lib/notifications/enqueue";
import { getOrderDetail, isOverdue, listAssignableStaff } from "@/lib/orders/queries";
import { STATUS_META, canDraftQuote, canSendQuote, manualTargets, transitionRule } from "@/lib/orders/status";
import { getBusiness } from "@/lib/settings/business";

export const metadata: Metadata = { title: "Orden" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageRole(...ANY_ROLE);
  const { id } = await params;
  const [order, business, staff] = await Promise.all([getOrderDetail(id), getBusiness(), listAssignableStaff()]);
  if (!order) notFound();

  const tz = business.timezone;
  const money = (cents: number) => formatMoney(cents, business.currency);
  const onBench = actor.role !== "FRONT_DESK";
  const atCounter = actor.role !== "TECHNICIAN";

  const draft = order.quotes.find((quote) => quote.status === "DRAFT");
  const live = order.quotes.find((quote) => quote.status === "SENT" || quote.status === "APPROVED");
  const shown = live ?? order.quotes.find((quote) => quote.status === "REJECTED");
  const editable = onBench && canDraftQuote(order.status);
  // With no draft yet, start from the last quote the customer saw: a
  // revision is usually that quote plus or minus a line.
  const seed = draft ?? shown;
  const editorLines: EditorLine[] = (seed?.items ?? []).map((item) => ({
    kind: item.kind,
    description: item.description,
    quantity: String(item.quantity),
    unitPrice: centsToInput(item.unitPriceCents),
  }));

  const track = trackingUrl(order.publicToken);
  const whatsappText = `Hola ${order.customer.name.split(" ")[0]}, te escribimos de ${business.name} sobre tu ${order.device.brand} ${order.device.model} (folio ${order.folio}). ${STATUS_META[order.status].publicLabel}. Puedes ver el detalle aquí: ${track}`;
  const overdue = isOverdue(order, new Date());

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/ordenes" className="text-sm text-muted underline-offset-4 hover:underline">
            Órdenes
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-bold sm:text-3xl">
            <span className="font-mono">{order.folio}</span>
            <StatusBadge status={order.status} />
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {order.device.brand} {order.device.model} · recibido el {formatDateTime(order.receivedAt, tz)} por {order.createdBy.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`https://wa.me/${order.customer.phone}?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            <ChatIcon /> Avisar por WhatsApp
          </a>
          <a href={`/r/${order.publicToken}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            <EyeIcon /> Ver como cliente
          </a>
          <Link href={`/admin/recibo/${order.id}`} className="btn btn-dark">
            <PrinterIcon /> Recibo
          </Link>
        </div>
      </div>

      {order.warrantyOf && (
        <p className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <ShieldIcon className="shrink-0 text-base" />
          Este equipo regresa dentro de la garantía de la orden{" "}
          <Link href={`/admin/ordenes/${order.warrantyOf.id}`} className="font-mono font-semibold underline underline-offset-4">
            {order.warrantyOf.folio}
          </Link>
          . Revisa si la falla es la misma antes de cotizar.
        </p>
      )}
      {overdue && order.promisedAt && (
        <p className="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertIcon className="shrink-0 text-base" />
          Atrasada: se prometió para el {formatDate(order.promisedAt, tz)}.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Recepción" />
            <dl className="grid gap-x-8 gap-y-4 p-5 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-muted">Falla reportada</dt>
                <dd className="mt-0.5 whitespace-pre-line font-medium">{order.reportedIssue}</dd>
              </div>
              <div>
                <dt className="text-muted">Estado físico al recibir</dt>
                <dd className="mt-0.5 whitespace-pre-line">{order.intakeCondition || "Sin observaciones"}</dd>
              </div>
              <div>
                <dt className="text-muted">Accesorios</dt>
                <dd className="mt-0.5 whitespace-pre-line">{order.accessories || "Ninguno"}</dd>
              </div>
              <div>
                <dt className="text-muted">Equipo</dt>
                <dd className="mt-0.5">
                  {DEVICE_KIND_LABEL[order.device.kind]}
                  {order.device.color && ` · ${order.device.color}`}
                  {order.device.serial && <span className="block font-mono text-xs text-muted">{order.device.serial}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Fecha estimada</dt>
                <dd className="mt-0.5">{order.promisedAt ? formatDate(order.promisedAt, tz) : "Sin fecha"}</dd>
              </div>
            </dl>
            <div className="border-t border-line p-5">
              {onBench ? (
                <DiagnosisForm orderId={order.id} diagnosis={order.diagnosis} />
              ) : (
                <div className="text-sm">
                  <p className="text-muted">Diagnóstico</p>
                  <p className="mt-0.5 whitespace-pre-line">{order.diagnosis || "El técnico aún no lo escribe."}</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Cotización"
              description={shown ? `Versión ${shown.version} · ${QUOTE_STATUS_LABEL[shown.status]}` : "Aún no se envía ninguna."}
            />
            {shown && (
              <>
                <QuoteLines quote={shown} currency={business.currency} />
                {shown.decidedAt && shown.decidedVia && (
                  <p className="border-t border-line bg-paper/60 px-5 py-3 text-xs text-muted">
                    {shown.status === "APPROVED" ? "Aprobada" : "Rechazada"} por {CHANNEL_LABEL[shown.decidedVia]}, el{" "}
                    {formatDateTime(shown.decidedAt, tz)}
                    {shown.decidedBy && ` · registró ${shown.decidedBy.name}`}
                    {shown.decisionIp && ` · IP ${shown.decisionIp}`}
                    {shown.rejectionReason && ` · motivo: ${shown.rejectionReason}`}
                  </p>
                )}
                {shown.status === "SENT" && order.status === "AWAITING_APPROVAL" && (
                  <DecisionPanel
                    orderId={order.id}
                    quoteId={shown.id}
                    canWithdraw={!!transitionRule(order.status, "DIAGNOSING")?.roles.includes(actor.role)}
                  />
                )}
              </>
            )}
            {editable && (
              <div className={shown ? "border-t-4 border-double border-line" : ""}>
                <p className="px-5 pt-5 text-sm font-medium">
                  {draft ? `Borrador de la versión ${draft.version}` : shown ? "Preparar una nueva versión" : "Preparar la cotización"}
                </p>
                <QuoteEditor
                  orderId={order.id}
                  initialLines={editorLines}
                  initialNotes={seed?.notes ?? ""}
                  taxRateBps={business.taxRateBps}
                  currency={business.currency}
                  canSend={canSendQuote(order.status, actor.role)}
                />
              </div>
            )}
            {!shown && !editable && (
              <p className="p-5 text-sm text-muted">
                {order.status === "RECEIVED"
                  ? "La cotización se prepara cuando un técnico inicia el diagnóstico."
                  : "No hay cotización para esta orden."}
              </p>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Fotos" description="Evidencia de cómo llegó el equipo y de lo que se encontró." />
            {order.photos.length > 0 ? (
              <ul className="grid grid-cols-3 gap-2 p-5 sm:grid-cols-4">
                {order.photos.map((photo) => (
                  <li key={photo.id}>
                    <a href={`/api/photos/${photo.id}`} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-lg bg-paper-deep">
                      <Photo src={`/api/photos/${photo.id}`} alt={photo.caption || "Foto de la orden"} />
                    </a>
                    <p className="mt-1 truncate text-xs text-muted">{photo.isPublic ? "Visible al cliente" : "Interna"}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-sm text-muted">Sin fotos todavía.</p>
            )}
            <PhotoForm orderId={order.id} />
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Historial" description="No se puede editar ni borrar: es el registro de la orden." />
            <NoteForm orderId={order.id} />
            <ol className="divide-y divide-line">
              {order.events.map((event) => (
                <li key={event.id} className="px-5 py-3.5 text-sm">
                  <p>
                    {event.toStatus && <span className="font-medium">{STATUS_META[event.toStatus].label}. </span>}
                    {event.message}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateTime(event.createdAt, tz)} · {event.actor?.name ?? "Cliente"}
                    {!event.isPublic && <span className="ml-2 rounded bg-ink px-1.5 py-0.5 font-medium text-white">Nota interna</span>}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside className="space-y-6">
          <MovePanel orderId={order.id} from={order.status} targets={manualTargets(order.status, actor.role)} />

          <Card className="overflow-hidden">
            <CardHeader title="Cobro" />
            <dl className="space-y-2 p-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Total aprobado</dt>
                <dd className="tabular-nums">{money(order.balance.dueCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Pagado</dt>
                <dd className="tabular-nums">{money(order.balance.paidCents)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                <dt>Saldo</dt>
                <dd className={`tabular-nums ${order.balance.balanceCents > 0 ? "text-rose-700" : ""}`}>{money(order.balance.balanceCents)}</dd>
              </div>
            </dl>
            {order.payments.length > 0 && (
              <ul className="divide-y divide-line border-t border-line text-sm">
                {order.payments.map((payment) => (
                  <li key={payment.id} className="flex justify-between gap-3 px-5 py-2.5">
                    <span>
                      {payment.kind === "REFUND" ? "Reembolso" : "Cobro"} · {PAYMENT_METHOD_LABEL[payment.method]}
                      <span className="block text-xs text-muted">
                        {formatDateTime(payment.createdAt, tz)} · {payment.receivedBy.name}
                        {payment.note && ` · ${payment.note}`}
                      </span>
                    </span>
                    <span className="whitespace-nowrap tabular-nums">
                      {payment.kind === "REFUND" ? "−" : ""}
                      {money(payment.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {atCounter && order.status !== "CANCELLED" && (
              <PaymentForm orderId={order.id} balanceCents={order.balance.balanceCents} paidCents={order.balance.paidCents} currency={business.currency} />
            )}
          </Card>

          <Card>
            <CardHeader title="Cliente" />
            <div className="space-y-3 p-5 text-sm">
              <p>
                <Link href={`/admin/clientes/${order.customer.id}`} className="font-semibold underline-offset-4 hover:underline">
                  {order.customer.name}
                </Link>
                <span className="block text-muted">{formatPhone(order.customer.phone)}</span>
                <span className="block text-muted">{order.customer.email ?? "Sin correo: avísale por WhatsApp"}</span>
              </p>
              <AssignForm orderId={order.id} assignedToId={order.assignedTo?.id ?? null} staff={staff} />
              {order.warrantyUntil && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900">Garantía hasta el {formatDate(order.warrantyUntil, tz)}</p>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
