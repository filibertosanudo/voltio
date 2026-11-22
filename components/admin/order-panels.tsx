// The panels of the order page that change something. Each is a plain form
// around a Server Action; what a role cannot do is not rendered here, and
// is refused by the action regardless.
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { Card, CardHeader } from "@/components/ui/primitives";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { ITEM_KIND_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { addNoteAction, assignOrderAction, transitionOrderAction, updateDiagnosisAction } from "@/lib/orders/actions";
import type { OrderDetail } from "@/lib/orders/queries";
import { recordPaymentAction } from "@/lib/payments/actions";
import { addPhotoAction } from "@/lib/photos/actions";
import { recordDecisionAction, withdrawQuoteAction } from "@/lib/quotes/actions";

type Quote = OrderDetail["quotes"][number];

function moveLabel(from: OrderStatus, to: OrderStatus): string {
  if (to === "IN_REPAIR") {
    if (from === "WAITING_PARTS") return "Llegó la refacción: reanudar";
    if (from === "READY") return "Regresar a reparación";
    return "Iniciar reparación";
  }
  if (to === "READY") return from === "QUOTE_REJECTED" ? "Listo para devolver sin reparar" : "Marcar como listo";
  const labels: Partial<Record<OrderStatus, string>> = {
    DIAGNOSING: "Iniciar diagnóstico",
    WAITING_PARTS: "Esperar refacción",
    DELIVERED: "Entregar al cliente",
    CANCELLED: "Cancelar orden",
  };
  return labels[to] ?? to;
}

export function MovePanel({ orderId, from, targets }: { orderId: string; from: OrderStatus; targets: OrderStatus[] }) {
  if (targets.length === 0) return null;
  return (
    <Card>
      <CardHeader title="Siguiente paso" />
      <ActionForm action={transitionOrderAction} className="space-y-3 p-5">
        <input type="hidden" name="orderId" value={orderId} />
        <Field label="Nota para el cliente (opcional)" name="note" hint="Se muestra en su seguimiento. Obligatoria para cancelar.">
          <textarea id="note" name="note" rows={2} maxLength={500} className="input" placeholder="La pieza llega el jueves" />
        </Field>
        <div className="flex flex-col gap-2">
          {targets.map((to) => (
            <SubmitButton
              key={to}
              name="to"
              value={to}
              className={`btn w-full ${to === "CANCELLED" ? "btn-danger" : "btn-primary"}`}
              pendingLabel="Moviendo…"
            >
              {moveLabel(from, to)}
            </SubmitButton>
          ))}
        </div>
      </ActionForm>
    </Card>
  );
}

export function DiagnosisForm({ orderId, diagnosis }: { orderId: string; diagnosis: string }) {
  return (
    <ActionForm action={updateDiagnosisAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <Field label="Diagnóstico" name="diagnosis" hint="El cliente lo lee junto con la cotización: escríbelo para él.">
        <textarea
          id="diagnosis"
          name="diagnosis"
          rows={4}
          maxLength={4000}
          className="input"
          defaultValue={diagnosis}
          placeholder="La pantalla está rota y el conector de carga tiene sulfato. La tarjeta lógica funciona."
        />
      </Field>
      <SubmitButton className="btn btn-ghost btn-sm">Guardar diagnóstico</SubmitButton>
    </ActionForm>
  );
}

export function QuoteLines({ quote, currency }: { quote: Quote; currency: string }) {
  const money = (cents: number) => formatMoney(cents, currency);
  return (
    <>
      <ul className="divide-y divide-line px-5">
        {quote.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-4 py-3 text-sm">
            <span>
              <span className="font-medium">{item.description}</span>
              <span className="block text-xs text-muted">
                {ITEM_KIND_LABEL[item.kind]} · {item.quantity} × {money(item.unitPriceCents)}
              </span>
            </span>
            <span className="whitespace-nowrap tabular-nums">{money(item.quantity * item.unitPriceCents)}</span>
          </li>
        ))}
      </ul>
      <dl className="space-y-1 border-t border-line px-5 py-4 text-sm">
        <div className="flex justify-between text-muted">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{money(quote.subtotalCents)}</dd>
        </div>
        <div className="flex justify-between text-muted">
          <dt>IVA ({quote.taxRateBps / 100}%)</dt>
          <dd className="tabular-nums">{money(quote.taxCents)}</dd>
        </div>
        <div className="flex justify-between pt-1 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{money(quote.totalCents)}</dd>
        </div>
      </dl>
      {quote.notes && <p className="border-t border-line px-5 py-3 text-sm text-muted">{quote.notes}</p>}
    </>
  );
}

/** For the customer who answers at the counter or on the phone instead of on their link. */
export function DecisionPanel({ orderId, quoteId, canWithdraw }: { orderId: string; quoteId: string; canWithdraw: boolean }) {
  return (
    <div className="space-y-4 border-t border-line bg-amber-50/60 p-5">
      <ActionForm action={recordDecisionAction} className="space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="quoteId" value={quoteId} />
        <p className="text-sm font-medium">¿El cliente respondió en persona o por teléfono? Regístralo aquí.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cómo respondió" name="channel">
            <select id="channel" name="channel" className="input" defaultValue="IN_PERSON">
              <option value="IN_PERSON">En mostrador</option>
              <option value="PHONE">Por teléfono</option>
            </select>
          </Field>
          <Field label="Motivo si rechaza (opcional)" name="reason">
            <input id="reason" name="reason" className="input" maxLength={300} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="decision" value="approve" className="btn btn-primary">
            El cliente aprobó
          </SubmitButton>
          <SubmitButton name="decision" value="reject" className="btn btn-danger">
            El cliente rechazó
          </SubmitButton>
        </div>
      </ActionForm>
      {canWithdraw && (
        <ActionForm action={withdrawQuoteAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <SubmitButton className="text-sm font-medium text-muted underline underline-offset-4 hover:text-ink" pendingLabel="Retirando…">
            Retirar la cotización para corregirla
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

export function PaymentForm({ orderId, balanceCents, paidCents, currency }: {
  orderId: string;
  balanceCents: number;
  paidCents: number;
  currency: string;
}) {
  if (balanceCents <= 0 && paidCents <= 0) return null;
  return (
    <ActionForm action={recordPaymentAction} className="space-y-3 border-t border-line p-5">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Movimiento" name="kind">
          <select id="kind" name="kind" className="input" defaultValue={balanceCents > 0 ? "PAYMENT" : "REFUND"}>
            {balanceCents > 0 && <option value="PAYMENT">Cobro</option>}
            {paidCents > 0 && <option value="REFUND">Reembolso</option>}
          </select>
        </Field>
        <Field label="Forma" name="method">
          <select id="method" name="method" className="input" defaultValue="CASH">
            {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Monto" name="amount" hint={balanceCents > 0 ? `Saldo pendiente: ${formatMoney(balanceCents, currency)}` : undefined}>
        <input
          id="amount"
          name="amount"
          className="input text-right tabular-nums"
          inputMode="decimal"
          defaultValue={balanceCents > 0 ? (balanceCents / 100).toFixed(2) : undefined}
        />
      </Field>
      <Field label="Nota (opcional)" name="note" id="payment-note">
        <input id="payment-note" name="note" className="input" maxLength={200} placeholder="Anticipo, referencia de transferencia…" />
      </Field>
      <SubmitButton className="btn btn-dark w-full">Registrar movimiento</SubmitButton>
    </ActionForm>
  );
}

export function AssignForm({ orderId, assignedToId, staff }: {
  orderId: string;
  assignedToId: string | null;
  staff: { id: string; name: string }[];
}) {
  return (
    <ActionForm action={assignOrderAction} className="flex items-end gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <Field label="Técnico asignado" name="assignedToId" className="flex-1">
        <select id="assignedToId" name="assignedToId" className="input" defaultValue={assignedToId ?? ""}>
          <option value="">Sin asignar</option>
          {staff.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </Field>
      <SubmitButton className="btn btn-ghost mb-px">Asignar</SubmitButton>
    </ActionForm>
  );
}

export function NoteForm({ orderId }: { orderId: string }) {
  return (
    <ActionForm action={addNoteAction} className="space-y-3 border-b border-line p-5">
      <input type="hidden" name="orderId" value={orderId} />
      <Field label="Agregar nota" name="message">
        <textarea id="message" name="message" rows={2} maxLength={1000} className="input" placeholder="Llamé al cliente, no contestó" />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPublic" className="h-4 w-4 rounded border-line accent-ink" />
          Visible para el cliente
        </label>
        <SubmitButton className="btn btn-ghost btn-sm">Guardar nota</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PhotoForm({ orderId }: { orderId: string }) {
  return (
    <ActionForm action={addPhotoAction} className="space-y-3 border-t border-line p-5">
      <input type="hidden" name="orderId" value={orderId} />
      <Field label="Agregar foto" name="photo" hint="JPG, PNG o WebP, hasta 8 MB.">
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
      </Field>
      <Field label="Descripción (opcional)" name="caption">
        <input id="caption" name="caption" className="input" maxLength={200} placeholder="Pantalla estrellada al recibir" />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPublic" className="h-4 w-4 rounded border-line accent-ink" defaultChecked />
          Visible para el cliente
        </label>
        <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="Subiendo…">
          Subir foto
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
