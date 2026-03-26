"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Auto-refresh component — calls router.refresh() on an interval.
 * This re-runs server components and fetches fresh data without
 * a full page reload. Drop into any page layout.
 *
 * Default: 60 seconds. Pass intervalMs to customize.
 */
export function AutoRefresh({ intervalMs = 60000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    // Don't auto-refresh if user is actively typing or has unsaved work
    let paused = false;

    function onFocus() { paused = false; }
    function onBlur() { paused = true; }
    function onInput() {
      paused = true;
      // Resume after 30s of no input
      clearTimeout(inputTimer);
      inputTimer = setTimeout(() => { paused = false; }, 30000);
    }

    let inputTimer: ReturnType<typeof setTimeout>;

    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    document.addEventListener("input", onInput);

    const interval = setInterval(() => {
      if (!paused && document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);

    return () => {
      clearInterval(interval);
      clearTimeout(inputTimer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("input", onInput);
    };
  }, [router, intervalMs]);

  return null;
}
