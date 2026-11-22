import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/nav";
import { LogoutIcon, PlusIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/primitives";
import { ANY_ROLE, requirePageRole } from "@/lib/auth/guards";
import { signOutAction } from "@/lib/auth/session-actions";
import { ROLE_LABEL } from "@/lib/labels";
import { getBusiness } from "@/lib/settings/business";

export const metadata: Metadata = { title: { default: "Panel", template: "%s · Panel" }, robots: { index: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageRole(...ANY_ROLE);
  const business = await getBusiness();
  const canReceive = actor.role !== "TECHNICIAN";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="bg-ink px-4 py-4 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:py-6">
        <div className="mb-4 flex items-center justify-between lg:mb-8">
          <Link href="/admin">
            <Logo name={business.name} tone="light" />
          </Link>
        </div>
        {canReceive && (
          <Link href="/admin/ordenes/nueva" className="btn btn-primary mb-4 hidden w-full lg:inline-flex">
            <PlusIcon /> Recibir equipo
          </Link>
        )}
        <AdminNav isOwner={actor.role === "OWNER"} />
        <div className="mt-auto hidden border-t border-white/10 pt-4 lg:block">
          <p className="truncate text-sm font-medium">{actor.name}</p>
          <p className="text-xs text-white/50">{ROLE_LABEL[actor.role]}</p>
          <form action={signOutAction} className="mt-3">
            <button type="submit" className="flex items-center gap-2 text-sm text-white/60 transition hover:text-white">
              <LogoutIcon /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex items-center justify-between border-b border-line bg-white px-5 py-3 text-sm lg:hidden">
          <span>
            <span className="font-medium">{actor.name}</span> <span className="text-muted">· {ROLE_LABEL[actor.role]}</span>
          </span>
          <span className="flex items-center gap-3">
            {canReceive && (
              <Link href="/admin/ordenes/nueva" className="btn btn-primary btn-sm">
                <PlusIcon /> Recibir
              </Link>
            )}
            <form action={signOutAction}>
              <button type="submit" className="text-muted" aria-label="Cerrar sesión">
                <LogoutIcon className="text-lg" />
              </button>
            </form>
          </span>
        </div>
        <main className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
