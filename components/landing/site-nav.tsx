"use client";

import { useEffect, useRef, useState } from "react";
import { BoltIcon } from "@/components/ui/icons";
import { currentSection } from "./current-section";

export type NavLink = { id: string; label: string };

/**
 * The landing's navigation: a floating pill that stays with the reader, like
 * Marea's, with three things Marea's does not have:
 *  - real anchor links, so it works before JavaScript and can be opened in a new tab;
 *  - the section on screen is marked as current (aria-current="location");
 *  - a menu on a phone instead of hiding the links.
 * Smooth scrolling comes from `scroll-behavior` in globals.css, which reduced
 * motion turns off, and `scroll-padding-top` keeps headings clear of the pill.
 */
export function SiteNav({ name, links }: { name: string; links: NavLink[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Recomputed on scroll and resize, at most once per frame. The rule itself
  // (and why the end of the page needs its own case) is in current-section.ts.
  useEffect(() => {
    const sections = links.map((link) => document.getElementById(link.id));
    let frame = 0;
    const update = () => {
      frame = 0;
      const tops = sections.map((section) => section?.getBoundingClientRect().top ?? Infinity);
      const remaining = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      setActive(links[currentSection(tops, window.innerHeight, remaining)]?.id ?? null);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [links]);

  // The phone menu closes on Escape and on any tap outside the navigation.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !root.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const linkClass = (id: string) =>
    `rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt ${
      active === id ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <div className="sticky top-0 z-50 h-0">
      <div ref={root} className="mx-auto max-w-6xl px-3 pt-3 sm:px-5">
        <nav
          aria-label="Principal"
          className="flex items-center justify-between gap-2 rounded-full bg-ink/80 py-1.5 pl-2 pr-1.5 text-white shadow-lift ring-1 ring-white/10 backdrop-blur-md"
        >
          <a
            href="#inicio"
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 font-display text-base font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt"
            onClick={() => setOpen(false)}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-volt text-ink">
              <BoltIcon />
            </span>
            {name}
          </a>

          <ul className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <li key={link.id}>
                <a href={`#${link.id}`} aria-current={active === link.id ? "location" : undefined} className={linkClass(link.id)}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1">
            <a href="#rastrear" className="btn btn-primary rounded-full px-4 py-2" onClick={() => setOpen(false)}>
              <span className="sm:hidden">Rastrear</span>
              <span className="hidden sm:inline">Rastrear mi equipo</span>
            </a>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt md:hidden"
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              onClick={() => setOpen((value) => !value)}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </nav>

        {open && (
          <ul
            id="site-menu"
            className="v-enter mt-2 grid gap-1 rounded-3xl bg-ink/95 p-2 text-white shadow-lift ring-1 ring-white/10 backdrop-blur-md md:hidden"
          >
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  aria-current={active === link.id ? "location" : undefined}
                  className={`block ${linkClass(link.id)} !px-4 !py-3 !text-base`}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
