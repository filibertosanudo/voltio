"use client";

import { useEffect, useSyncExternalStore } from "react";

const KEY = "voltio-motion";
const EVENT = "voltio-motion-change";

// The source of truth is the attribute on <html> that app/motion.css reads;
// React only mirrors it, so the button and the page can never disagree.
const isPaused = () => document.documentElement.dataset.motion === "paused";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function setPaused(paused: boolean) {
  if (paused) document.documentElement.dataset.motion = "paused";
  else delete document.documentElement.dataset.motion;
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Pauses every looping animation on the page (WCAG 2.2.2: moving content
 * that lasts more than five seconds needs a way to stop it). The choice is
 * remembered on this device. Hidden when the visitor already asked their
 * system for reduced motion: then nothing loops.
 */
export function MotionToggle({ className = "" }: { className?: string }) {
  const paused = useSyncExternalStore(subscribe, isPaused, () => false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "paused") setPaused(true);
    } catch {
      // Storage blocked: the toggle still works for this visit.
    }
  }, []);

  function toggle() {
    const next = !isPaused();
    setPaused(next);
    try {
      if (next) localStorage.setItem(KEY, "paused");
      else localStorage.removeItem(KEY);
    } catch {
      // Same as above.
    }
  }

  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={toggle}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 text-xs font-medium text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt motion-reduce:hidden ${className}`}
    >
      <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
        {paused ? <path d="M8 5.5v13l10.5-6.5L8 5.5Z" /> : <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />}
      </svg>
      {paused ? "Reanudar animación" : "Pausar animación"}
    </button>
  );
}
