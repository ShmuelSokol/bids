"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/errors/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error_message: error.message,
        error_stack: error.stack || null,
        url: typeof window !== "undefined" ? window.location.href : null,
        error_type: "react_boundary",
        metadata: { digest: error.digest },
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-xl font-bold text-red-700">Something went wrong</h2>
        <p className="text-sm text-muted">{error.message}</p>
        <p className="text-xs text-muted">This error has been automatically reported.</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-accent text-white rounded text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
