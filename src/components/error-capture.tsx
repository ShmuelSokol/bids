"use client";

import { useEffect } from "react";

let sessionId: string | null = null;
function getSessionId() {
  if (!sessionId) {
    sessionId =
      (typeof sessionStorage !== "undefined" && sessionStorage.getItem("dibs_session")) ||
      Math.random().toString(36).slice(2);
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem("dibs_session", sessionId);
  }
  return sessionId;
}

const reported = new Set<string>();

function report(data: Record<string, any>) {
  const key = `${data.error_message}|${data.url}`;
  if (reported.has(key)) return;
  reported.add(key);
  // Keep set bounded
  if (reported.size > 100) reported.clear();

  fetch("/api/errors/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, session_id: getSessionId() }),
  }).catch(() => {});
}

export function ErrorCapture() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      report({
        error_message: event.message || "Uncaught error",
        error_stack: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
        url: window.location.href,
        error_type: "uncaught",
      });
    }

    function onRejection(event: PromiseRejectionEvent) {
      const err = event.reason;
      report({
        error_message: err?.message || String(err) || "Unhandled promise rejection",
        error_stack: err?.stack || null,
        url: window.location.href,
        error_type: "unhandled_rejection",
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
