"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeIcon, ClipboardIcon, GridIcon, SettingsIcon, UsersIcon } from "@/components/ui/icons";

const ITEMS = [
  { href: "/admin", label: "Resumen", icon: GridIcon, ownerOnly: false },
  { href: "/admin/ordenes", label: "Órdenes", icon: ClipboardIcon, ownerOnly: false },
  { href: "/admin/clientes", label: "Clientes", icon: UsersIcon, ownerOnly: false },
  { href: "/admin/equipo", label: "Equipo", icon: BadgeIcon, ownerOnly: true },
  { href: "/admin/ajustes", label: "Ajustes", icon: SettingsIcon, ownerOnly: true },
];

/** The panel's navigation: a sidebar on desktop, a scrolling row on a phone. Hiding a link is a courtesy; the pages check the role themselves. */
export function AdminNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <nav aria-label="Panel" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ITEMS.filter((item) => isOwner || !item.ownerOnly).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
            isActive(item.href) ? "bg-volt text-ink" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <item.icon className="text-base" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
