"use client";

import { useEffect, useRef } from "react";

const DURATION_MS = 2000;

/** Starts gently, settles gently: no leap in the first frames, no crawl at the end. */
export function smoothstep(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}

/** The number shown `elapsed` ms into a count from 0 to `to`. */
export function countAt(to: number, elapsed: number, duration = DURATION_MS): number {
  return Math.round(to * smoothstep(elapsed / duration));
}

/**
 * A number that counts up from zero, once, when it comes into view.
 *
 * This is the one animation on the public pages driven by script, on
 * purpose: a CSS-only count (an animated @property feeding `counter()`)
 * computes the right value every frame but Chrome does not repaint the
 * counter text with it, so the number sat at 0 and then jumped. Writing the
 * text each frame is the reliable way.
 *
 * The server renders the final number, so without JavaScript, or with
 * reduced motion, it simply shows. Screen readers read the sr-only text
 * next to it, never the frames.
 */
export function CountUp({ to, delay = 0 }: { to: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let timer = 0;
    element.textContent = "0";

    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        element.textContent = String(countAt(to, elapsed));
        if (elapsed < DURATION_MS) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        timer = window.setTimeout(run, delay);
      },
      { threshold: 0.6 }
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      element.textContent = String(to);
    };
  }, [to, delay]);

  // Width reserved for the final number, so the suffix does not slide as digits are added.
  return (
    <span ref={ref} className="inline-block text-right tabular-nums" style={{ minWidth: `${String(to).length}ch` }} aria-hidden="true">
      {to}
    </span>
  );
}
