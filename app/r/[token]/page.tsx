import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/track/auto-refresh";
import { DecisionForm } from "@/components/track/decision-form";
import { ChatIcon, CheckIcon, PhoneIcon, ShieldIcon } from "@/components/ui/icons";
import { Photo } from "@/components/ui/photo";
import { Logo } from "@/components/ui/primitives";
import { normalizePhone } from "@/lib/customers/phone";
import { ITEM_KIND_LABEL } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { PUBLIC_STEPS, STATUS_META, isTerminal, publicStepIndex } from "@/lib/orders/status";
import { getBusiness } from "@/lib/settings/business";
import { getPublicOrder } from "@/lib/track/public-order";

// A private link: it must never be indexed, and never leak in a Referer.
export const metadata: Metadata = {
  title: "Tu reparación",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const business = await getBusiness();
  const order = await getPublicOrder(token, business.timezone);
  if (!order) notFound();

  const money = (cents: number) => formatMoney(cents, business.currency);
  const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
  const meta = STATUS_META[order.status];
  const step = publicStepIndex(order.status);
  const phone = normalizePhone(business.phone);
  const whatsappHref = business.whatsapp
    ? `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(`Hola, escribo por mi orden ${order.folio}.`)}`
    : null;

  return (
    <div className="min-h-screen pb-16">
      {!isTerminal(order.status) && <AutoRefresh />}

      <header className="bench-grid bg-ink text-white">
        {/* Keyed by status: when an open page refreshes into a new status, the header plays its entrance again. */}
        <div key={order.status} className="mx-auto max-w-2xl px-5 pb-10 pt-6">
          <Link href="/" aria-label={`${business.name}, inicio`}>
            <Logo name={business.name} tone="light" />
          </Link>
          <p className="v-enter mt-10 font-mono text-sm text-white/60">Folio {order.folio}</p>
          <h1 className="v-enter mt-2 text-balance text-3xl font-bold sm:text-4xl" style={delay(80)}>
            {meta.publicLabel}
          </h1>
          <p className="v-enter mt-3 max-w-lg text-pretty text-white/70" style={delay(160)}>
            {meta.publicHint}
          </p>
          <p className="v-enter mt-6 text-sm text-white/60" style={delay(240)}>
            {order.customerFirstName && `${order.customerFirstName} · `}
            {order.deviceLabel} · recibido el {order.receivedAt}
            {order.promisedAt && !isTerminal(order.status) && ` · fecha estimada: ${order.promisedAt}`}
          </p>
        </div>
      </header>

      <main className="mx-auto -mt-5 max-w-2xl space-y-5 px-5">
        {step >= 0 && (
          <section className="v-enter card px-5 py-6" style={delay(200)} aria-label="Avance de la reparación">
            {/* Keyed by status, like the header: progress made while the page was open is drawn, not jumped to. */}
            <ol key={order.status} className="flex items-start">
              {PUBLIC_STEPS.map((label, index) => {
                const done = index < step || order.status === "DELIVERED";
                const current = index === step && order.status !== "DELIVERED";
                // The bar fills left to right, one segment after the other.
                const at = 300 + index * 140;
                return (
                  <li key={label} className="relative flex flex-1 flex-col items-center text-center" aria-current={current ? "step" : undefined}>
                    {index > 0 && (
                      <span className="absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2 overflow-hidden bg-line">
                        {index <= step && <span className="v-step-fill absolute inset-0 bg-ink" style={delay(at - 140)} />}
                      </span>
                    )}
                    <span
                      className={`relative z-10 grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${
                        done ? "bg-ink text-volt" : current ? "bg-volt text-ink ring-4 ring-volt/30" : "bg-paper-deep text-muted"
                      }`}
                    >
                      {current && <span className="v-ping absolute inset-0 rounded-full bg-volt" aria-hidden="true" />}
                      {done ? (
                        <span className="v-pop grid place-items-center" style={delay(at)}>
                          <CheckIcon />
                        </span>
                      ) : (
                        <span className="relative">{index + 1}</span>
                      )}
                    </span>
                    {/* Six labels do not fit a phone's width: there, only the current one shows; the rest stay for screen readers. */}
                    <span
                      className={`mt-2 whitespace-nowrap text-xs leading-tight ${current ? "font-semibold text-ink" : "max-sm:sr-only"} ${
                        done ? "font-medium text-ink" : current ? "" : "text-muted"
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {order.justDecided && (
          <section
            className={`v-enter flex items-start gap-4 rounded-xl border px-5 py-5 ${
              order.justDecided === "APPROVED" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-line bg-white"
            }`}
            style={delay(260)}
            role="status"
          >
            {order.justDecided === "APPROVED" ? (
              <svg viewBox="0 0 48 48" className="h-12 w-12 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle className="v-draw" pathLength={100} cx="24" cy="24" r="21" style={delay(380)} />
                <path className="v-draw" pathLength={100} d="m14.5 24.5 6.5 6.5 13-13.5" style={delay(760)} />
              </svg>
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-paper text-xl text-muted" aria-hidden="true">
                <CheckIcon />
              </span>
            )}
            <div>
              <h2 className="text-lg font-semibold">
                {order.justDecided === "APPROVED" ? "¡Listo! Aprobaste tu reparación" : "Recibimos tu respuesta"}
              </h2>
              <p className={`mt-1 text-sm ${order.justDecided === "APPROVED" ? "text-emerald-900/80" : "text-muted"}`}>
                {order.justDecided === "APPROVED"
                  ? "Tu equipo pasa al banco de trabajo. Te avisamos en cuanto esté listo, y aquí puedes seguir cada paso."
                  : "No haremos la reparación. Te avisamos cuando puedas pasar por tu equipo."}
              </p>
            </div>
          </section>
        )}

        {order.quote && (
          <section className="v-enter card overflow-hidden" style={delay(300)} aria-labelledby="quote-title">
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 id="quote-title" className="text-lg font-semibold">
                Cotización
              </h2>
              {order.quote.status === "APPROVED" && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Aprobada</span>
              )}
              {order.quote.status === "REJECTED" && (
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">Rechazada</span>
              )}
            </header>
            {order.diagnosis && (
              <div className="border-b border-line bg-paper/60 px-5 py-4">
                <p className="eyebrow text-muted">Lo que encontramos</p>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">{order.diagnosis}</p>
              </div>
            )}
            <ul className="divide-y divide-line px-5">
              {order.quote.items.map((item, index) => (
                <li key={index} className="flex items-start justify-between gap-4 py-3.5 text-sm">
                  <span>
                    <span className="font-medium">{item.description}</span>
                    <span className="block text-xs text-muted">
                      {ITEM_KIND_LABEL[item.kind]}
                      {item.quantity > 1 && ` · ${item.quantity} × ${money(item.unitPriceCents)}`}
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-medium tabular-nums">{money(item.quantity * item.unitPriceCents)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line px-5 py-4 text-sm">
              <div className="flex justify-between text-muted">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{money(order.quote.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between text-muted">
                <dt>IVA ({order.quote.taxRateBps / 100}%)</dt>
                <dd className="tabular-nums">{money(order.quote.taxCents)}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-2">
                <dt className="font-semibold">Total</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{money(order.quote.totalCents)}</dd>
              </div>
            </dl>
            {order.quote.notes && <p className="border-t border-line px-5 py-4 text-sm text-muted">{order.quote.notes}</p>}

            {order.quote.status === "SENT" && order.status === "AWAITING_APPROVAL" && (
              <div className="border-t border-line bg-volt-soft/50 px-5 py-5">
                <DecisionForm token={token} quoteId={order.quote.id} total={money(order.quote.totalCents)} />
              </div>
            )}
            {order.quote.status !== "SENT" && order.quote.decidedAt && (
              <p className="border-t border-line px-5 py-3 text-xs text-muted">
                {order.quote.status === "APPROVED" ? "Aprobada" : "Rechazada"} el {order.quote.decidedAt}
              </p>
            )}
            {order.quote.status === "APPROVED" && (
              <dl className="grid grid-cols-2 border-t border-line text-sm">
                <div className="border-r border-line px-5 py-4">
                  <dt className="text-muted">Pagado</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{money(order.paidCents)}</dd>
                </div>
                <div className="px-5 py-4">
                  <dt className="text-muted">Saldo al recoger</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{money(Math.max(order.balanceCents, 0))}</dd>
                </div>
              </dl>
            )}
          </section>
        )}

        {order.warrantyUntil && (
          <section className="v-enter card flex items-start gap-4 px-5 py-5" style={delay(340)}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-xl text-emerald-700">
              <ShieldIcon />
            </span>
            <div>
              <h2 className="font-semibold">Garantía vigente hasta el {order.warrantyUntil}</h2>
              <p className="mt-1 text-sm text-muted">
                Si la misma falla regresa, trae tu equipo con el folio {order.folio} y lo revisamos sin costo.
              </p>
            </div>
          </section>
        )}

        {order.photoIds.length > 0 && (
          <section className="v-enter card px-5 py-5" style={delay(380)} aria-labelledby="photos-title">
            <h2 id="photos-title" className="text-lg font-semibold">
              Fotos de tu equipo
            </h2>
            <ul className="mt-4 grid grid-cols-3 gap-2">
              {order.photoIds.map((id) => (
                <li key={id} className="aspect-square overflow-hidden rounded-lg bg-paper-deep">
                  <Photo src={`/api/photos/${id}?t=${token}`} alt="Foto del equipo en el taller" />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="v-enter card px-5 py-5" style={delay(420)} aria-labelledby="history-title">
          <h2 id="history-title" className="text-lg font-semibold">
            Historial
          </h2>
          <ol className="mt-5 space-y-5">
            {order.events.map((event, index) => (
              <li key={event.id} className="v-enter relative flex gap-3.5" style={delay(480 + Math.min(index, 6) * 70)}>
                {index < order.events.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-line" />}
                <span className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ${index === 0 ? "bg-volt ring-2 ring-ink" : "bg-line"}`}>
                  {index === 0 && !isTerminal(order.status) && <span className="v-ping absolute inset-0 rounded-full bg-volt" aria-hidden="true" />}
                </span>
                <div className="text-sm">
                  {event.label && <p className="font-medium">{STATUS_META[event.label].publicLabel}</p>}
                  {event.message && <p className={event.label ? "text-muted" : "font-medium"}>{event.message}</p>}
                  <p className="mt-0.5 text-xs text-muted">{event.at}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="v-enter card px-5 py-5 text-sm" style={delay(460)}>
          <h2 className="text-lg font-semibold">¿Dudas?</h2>
          <p className="mt-1 text-muted">Escríbenos con tu folio a la mano.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {whatsappHref && (
              <a href={whatsappHref} className="btn btn-dark" target="_blank" rel="noopener noreferrer">
                <ChatIcon /> WhatsApp
              </a>
            )}
            {phone && (
              <a href={`tel:+${phone}`} className="btn btn-ghost">
                <PhoneIcon /> Llamar al taller
              </a>
            )}
          </div>
          {business.address && <p className="mt-4 text-muted">{[business.address, business.city].filter(Boolean).join(", ")}</p>}
        </section>
      </main>
    </div>
  );
}
