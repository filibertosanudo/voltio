"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps an open tracking page current: re-reads the server render every
 * `seconds`, and at once when the tab comes back to the foreground, which
 * is when someone actually looks. Nothing runs while the tab is hidden.
 */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refreshIfVisible, seconds * 1000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [router, seconds]);

  return null;
}
