import Link from "next/link";
import type { ReactNode } from "react";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { STATUS_META } from "@/lib/orders/status";
import { BoltIcon } from "./icons";

export function Logo({ name = "Voltio", tone = "dark" }: { name?: string; tone?: "dark" | "light" }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-lg font-bold ${tone === "light" ? "text-white" : "text-ink"}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-volt text-ink">
        <BoltIcon className="text-[1.05rem]" />
      </span>
      {name}
    </span>
  );
}

export function StatusBadge({ status, className = "" }: { status: OrderStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${meta.badge} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function CardHeader({ title, aside, description }: { title: string; aside?: ReactNode; description?: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {aside}
    </header>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="font-display text-base font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Previous / next links that keep the current filters. */
export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between border-t border-line px-5 py-3 text-sm" aria-label="Paginación">
      <span className="text-muted">
        Página {page} de {pages}
      </span>
      <span className="flex gap-2">
        {page > 1 && (
          <Link href={hrefFor(page - 1)} className="btn btn-ghost btn-sm">
            Anterior
          </Link>
        )}
        {page < pages && (
          <Link href={hrefFor(page + 1)} className="btn btn-ghost btn-sm">
            Siguiente
          </Link>
        )}
      </span>
    </nav>
  );
}
