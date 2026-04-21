"use client";

import { useState, useTransition } from "react";

export function Toggle({ initialValue }: { initialValue: boolean }) {
  const [live, setLive] = useState(initialValue);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const clickToggle = () => {
    setError(null);
    const next = !live;
    // Confirm flipping to LIVE — it's a real state change with downstream effects
    if (next) {
      if (!confirm("Going LIVE will transmit future Submitted bids to LamLinks for DLA. Continue?")) return;
    }
    start(async () => {
      const r = await fetch("/api/settings/lamlinks-writeback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: "unknown" }));
        setError(j.error || `HTTP ${r.status}`);
        return;
      }
      setLive(next);
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={clickToggle}
        disabled={pending}
        className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${
          live ? "bg-green-600" : "bg-gray-300"
        } ${pending ? "opacity-50" : "hover:opacity-90"}`}
        aria-pressed={live}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
            live ? "translate-x-9" : "translate-x-1"
          }`}
        />
      </button>
      <div className="text-[10px] text-muted">{pending ? "Saving…" : live ? "LIVE" : "SIMULATED"}</div>
      {error && <div className="text-[10px] text-red-700">{error}</div>}
    </div>
  );
}
