"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Client-side activity tracker — tracks page views automatically.
 * Drop into layout.tsx to start tracking all navigation.
 *
 * Also exposes `trackAction()` for manual event tracking from components.
 */

// Session ID persists across page views within a browser session
function getSessionId() {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem("dibs_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("dibs_session_id", sid);
  }
  return sid;
}

// Fire-and-forget tracking call
export function trackAction(
  eventType: string,
  eventAction: string,
  details?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_type: eventType,
      event_action: eventAction,
      page: window.location.pathname,
      details: details || {},
      session_id: getSessionId(),
    }),
    keepalive: true,
  }).catch(() => {});
}

export function ActivityTracker() {
  const pathname = usePathname();
  const lastPath = useRef("");

  useEffect(() => {
    // Don't double-track the same page
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    trackAction("page_view", "view", {
      referrer: document.referrer || null,
      screen: `${window.innerWidth}x${window.innerHeight}`,
    });
  }, [pathname]);

  return null; // invisible component
}
