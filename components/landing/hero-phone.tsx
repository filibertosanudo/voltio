import type { CSSProperties, ReactNode } from "react";
import { BoltIcon, CheckIcon, ShieldIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";

const slot = (n: number) => ({ "--slot": n }) as CSSProperties;

const LABELS = ["En diagnóstico", "Tu cotización está lista", "Cotización aprobada", "En reparación", "Listo para recoger"];

function Card({ children, ...props }: { children: ReactNode } & Record<string, unknown>) {
  return (
    <div {...props} className="v-phone-card absolute inset-x-0 top-0 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
      {children}
    </div>
  );
}

function Skeleton({ width }: { width: string }) {
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-paper-deep" style={{ width }}>
      <span className="v-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white to-transparent" />
    </div>
  );
}

/**
 * A phone showing what a customer sees, playing the story of one repair:
 * diagnosis, the quote, the tap that approves it, the bench, the pickup.
 * Illustration only (aria-hidden): every element is static markup animated
 * by app/motion.css, and with motion off it rests on the quote frame.
 */
export function HeroPhone({ shopName, warrantyDays, currency }: { shopName: string; warrantyDays: number; currency: string }) {
  const total = formatMoney(168_200, currency);

  return (
    <div className="v-phone relative w-[264px] select-none" aria-hidden="true">
      <div className="absolute -inset-10 rounded-full bg-volt/20 blur-3xl" />
      <div className="relative h-[540px] rounded-[2.75rem] bg-ink-700 p-2.5 shadow-lift ring-1 ring-white/10">
        <div className="relative h-full overflow-hidden rounded-[2.25rem] bg-paper text-ink">
          <div className="flex items-center justify-between px-6 pt-3 text-[11px] font-semibold">
            <span>9:41</span>
            <span className="h-5 w-20 rounded-full bg-ink" />
            <span className="flex gap-0.5">
              <span className="h-2.5 w-1 rounded-sm bg-ink" />
              <span className="h-2.5 w-1 rounded-sm bg-ink" />
              <span className="h-2.5 w-1 rounded-sm bg-ink/30" />
            </span>
          </div>

          <div className="mx-3 mt-3 rounded-2xl bg-ink px-4 pb-4 pt-3 text-white">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              <span className="grid h-4 w-4 place-items-center rounded bg-volt text-[9px] text-ink">
                <BoltIcon />
              </span>
              {shopName}
            </div>
            <p className="mt-3 font-mono text-[10px] text-white/50">Folio VT-261115-007</p>
            <div className="relative mt-1 h-12">
              {LABELS.map((label, i) => (
                <p key={label} data-slot={i} style={slot(i)} className="v-phone-label absolute inset-x-0 top-0 font-display text-lg font-bold leading-tight">
                  {label}
                </p>
              ))}
            </div>
            <p className="text-[10px] text-white/50">iPhone 13 · recibido hoy, 10:12</p>
          </div>

          <div className="mx-3 mt-3 rounded-2xl bg-white px-4 py-3.5 ring-1 ring-line">
            <div className="relative h-1.5 rounded-full bg-paper-deep">
              <div className="v-phone-progress absolute inset-0 rounded-full bg-ink" />
              {[0, 20, 40, 60, 80, 100].map((at) => (
                <span key={at} className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-ink/25" style={{ left: `${at}%` }} />
              ))}
              <div className="v-phone-marker absolute inset-0">
                <span className="absolute left-0 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-volt ring-4 ring-volt/30" />
              </div>
            </div>
            <div className="mt-2.5 flex justify-between text-[9px] text-muted">
              <span>Recibido</span>
              <span>Cotización</span>
              <span>Listo</span>
            </div>
          </div>

          <div className="relative mx-3 mt-3 h-[220px]">
            <Card data-card="slot" style={slot(0)}>
              <p className="eyebrow text-[9px] text-muted">Diagnóstico</p>
              <p className="mt-1.5 text-sm font-semibold">Un técnico está revisando tu equipo</p>
              <div className="mt-4 space-y-2.5">
                <Skeleton width="90%" />
                <Skeleton width="70%" />
                <Skeleton width="80%" />
              </div>
            </Card>

            <Card data-card="quote">
              <p className="eyebrow text-[9px] text-muted">Cotización</p>
              <div className="mt-2 space-y-1.5 text-[11px]">
                <p className="flex justify-between">
                  <span>Batería original</span>
                  <span className="tabular-nums">$1,150.00</span>
                </p>
                <p className="flex justify-between">
                  <span>Mano de obra</span>
                  <span className="tabular-nums">$300.00</span>
                </p>
                <p className="flex justify-between text-muted">
                  <span>IVA 16%</span>
                  <span className="tabular-nums">$232.00</span>
                </p>
              </div>
              <p className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
                <span className="text-xs font-semibold">Total</span>
                <span className="font-display text-xl font-bold tabular-nums">{total}</span>
              </p>
              <div className="relative mt-3 h-10">
                <span className="v-phone-cta absolute inset-0 grid place-items-center rounded-xl bg-volt text-xs font-bold">Aprobar reparación</span>
                <span className="v-phone-done absolute inset-0 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-100 text-xs font-bold text-emerald-800">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path className="v-phone-check" pathLength={100} d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                  Aprobada
                </span>
                <span className="v-phone-ripple absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full bg-ink" />
                <span className="v-phone-touch absolute left-1/2 top-1/2 -ml-4 -mt-3 h-8 w-8 rounded-full bg-ink/25 ring-2 ring-white" />
              </div>
            </Card>

            <Card data-card="slot" style={slot(3)}>
              <p className="eyebrow text-[9px] text-muted">En el banco de trabajo</p>
              <p className="mt-1.5 text-sm font-semibold">Estamos cambiando tu batería</p>
              <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-paper-deep">
                <span className="v-shimmer absolute inset-y-0 left-0 w-1/2 rounded-full bg-ink" />
              </div>
              <p className="mt-3 text-[11px] text-muted">Pieza nueva instalada. Siguen las pruebas.</p>
            </Card>

            <Card data-card="slot" style={slot(4)}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-xl text-emerald-700">
                <CheckIcon />
              </span>
              <p className="mt-3 text-sm font-semibold">Pasa por él cuando quieras</p>
              <p className="mt-1 text-[11px] text-muted">Saldo al recoger: {total}</p>
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-[10px] font-medium">
                <ShieldIcon /> Garantía de {warrantyDays} días
              </p>
            </Card>
          </div>

          <div className="v-phone-toast absolute inset-x-2.5 top-2.5 flex items-start gap-2.5 rounded-2xl bg-white/95 p-3 shadow-lift ring-1 ring-line">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-volt text-sm">
              <BoltIcon />
            </span>
            <span className="min-w-0 text-[11px] leading-snug">
              <span className="flex justify-between font-semibold">
                {shopName}
                <span className="font-normal text-muted">ahora</span>
              </span>
              Tu iPhone 13 está listo. Te esperamos.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
