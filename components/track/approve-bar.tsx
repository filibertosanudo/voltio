"use client";

import { useEffect, useState } from "react";
import { ArrowRightIcon } from "@/components/ui/icons";

/**
 * On a phone the decision buttons sit below the quote's lines, often a
 * scroll away. This bar keeps the total and a way to them at the bottom of
 * the screen until they are in view.
 *
 * It takes the customer to the form; it does not approve. An approval is a
 * yes to the price the customer is looking at (components/track/
 * decision-form.tsx), and the bar does not show the lines that price is
 * made of.
 */
export function ApproveBar({ targetId, total }: { targetId: string; total: string }) {
  const [targetInView, setTargetInView] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setTargetInView(entry?.isIntersecting ?? false), { threshold: 0.4 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  if (targetInView) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-5 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 shadow-lift backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted">Tu cotización</p>
          <p className="font-display text-lg font-bold tabular-nums">{total}</p>
        </div>
        <a href={`#${targetId}`} className="btn btn-primary px-4 py-3">
          Revisar y aprobar <ArrowRightIcon />
        </a>
      </div>
    </div>
  );
}
