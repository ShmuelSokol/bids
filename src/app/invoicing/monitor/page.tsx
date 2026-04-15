"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/dates";
import { ArrowRight, ChevronLeft, RefreshCw } from "lucide-react";

type Event = {
  id: number;
  kad_id: number;
  invoice_number: string | null;
  from_state: string | null;
  to_state: string;
  event_type: string;
  detected_at: string;
  upname: string | null;
  total: number | null;
};

type ApiShape = {
  today_events: Event[];
  week_state_changes: Event[];
  tally: Record<string, { count: number; total: number }>;
  tracked_invoices: number;
  last_sync: { created_at: string; details: any } | null;
};

export default function InvoiceMonitorPage() {
  const [data, setData] = useState<ApiShape | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/invoicing/states");
      setData(await r.json());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const i = setInterval(load, 60_000); // refresh every minute
    return () => clearInterval(i);
  }, []);

  function fmtTotal(n: number | null | undefined) {
    if (!n) return "—";
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function stateColor(state: string) {
    const s = state?.trim();
    if (s === "Posted") return "bg-green-100 text-green-700";
    if (s === "Not Posted") return "bg-amber-100 text-amber-700";
    if (s === "Voided") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/invoicing" className="text-xs text-muted hover:text-accent inline-flex items-center gap-1 mb-2">
            <ChevronLeft className="h-3 w-3" /> Back to Invoicing
          </Link>
          <h1 className="text-2xl font-bold">Invoice State Monitor</h1>
          <p className="text-xs text-muted mt-1">
            Live view of LamLinks <code>kad_tab.cinsta_kad</code> — same-day signal for Abe posting invoices. Syncs every 15 min.
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded border border-card-border bg-card-bg text-xs font-medium hover:bg-accent/5 inline-flex items-center gap-1"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(data.tally).map(([state, t]) => (
              <div key={state} className={`rounded-lg border p-3 ${stateColor(state).replace("bg-", "bg-").replace("100", "50").replace("700", "200")}`}>
                <div className="text-xs text-muted">{state}</div>
                <div className="text-2xl font-bold">{t.count.toLocaleString()}</div>
                <div className="text-xs text-muted font-mono mt-0.5">{fmtTotal(t.total)}</div>
              </div>
            ))}
          </div>

          <div className="text-xs text-muted">
            Tracking <strong>{data.tracked_invoices.toLocaleString()}</strong> invoices.
            {data.last_sync && (
              <> Last sync {formatDateTime(data.last_sync.created_at)} — pulled {data.last_sync.details?.rows_pulled ?? "?"}, {data.last_sync.details?.changed ?? 0} state changes.</>
            )}
          </div>

          <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
            <div className="px-6 py-4 border-b border-card-border">
              <h2 className="font-semibold">Today's transitions ({data.today_events.length})</h2>
              <p className="text-xs text-muted mt-0.5">Everything that happened to a kad row since midnight ET — new invoices appearing, Abe posting them, rare voids.</p>
            </div>
            {data.today_events.length === 0 ? (
              <div className="p-6 text-center text-muted text-sm">No events yet today.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted border-b border-card-border">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Time</th>
                    <th className="px-4 py-2 text-left font-medium">Invoice #</th>
                    <th className="px-4 py-2 text-left font-medium">kad_id</th>
                    <th className="px-4 py-2 text-left font-medium">Event</th>
                    <th className="px-4 py-2 text-left font-medium">State</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2 text-left font-medium">By</th>
                  </tr>
                </thead>
                <tbody>
                  {data.today_events.map((e) => (
                    <tr key={e.id} className="border-b border-card-border/40">
                      <td className="px-4 py-1.5 text-muted whitespace-nowrap">{formatDateTime(e.detected_at)}</td>
                      <td className="px-4 py-1.5 font-mono">{e.invoice_number || "—"}</td>
                      <td className="px-4 py-1.5 font-mono text-[10px] text-muted">{e.kad_id}</td>
                      <td className="px-4 py-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          e.event_type === "state_change" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {e.event_type === "state_change" ? "state change" : "new"}
                        </span>
                      </td>
                      <td className="px-4 py-1.5">
                        {e.from_state ? (
                          <span className="inline-flex items-center gap-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${stateColor(e.from_state)}`}>{e.from_state}</span>
                            <ArrowRight className="h-3 w-3 text-muted" />
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${stateColor(e.to_state)}`}>{e.to_state}</span>
                          </span>
                        ) : (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${stateColor(e.to_state)}`}>{e.to_state}</span>
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-right font-mono">{fmtTotal(e.total)}</td>
                      <td className="px-4 py-1.5 text-muted">{e.upname || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
            <div className="px-6 py-4 border-b border-card-border">
              <h2 className="font-semibold">State-change events (last 7 days)</h2>
              <p className="text-xs text-muted mt-0.5">Transitions only — ignores the initial "appeared" events. This is where posting patterns show up.</p>
            </div>
            {data.week_state_changes.length === 0 ? (
              <div className="p-6 text-center text-muted text-sm">No transitions in the last 7 days.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted border-b border-card-border">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">When</th>
                    <th className="px-4 py-2 text-left font-medium">Invoice #</th>
                    <th className="px-4 py-2 text-left font-medium">From → To</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2 text-left font-medium">By</th>
                  </tr>
                </thead>
                <tbody>
                  {data.week_state_changes.map((e) => (
                    <tr key={e.id} className="border-b border-card-border/40">
                      <td className="px-4 py-1.5 text-muted whitespace-nowrap">{formatDateTime(e.detected_at)}</td>
                      <td className="px-4 py-1.5 font-mono">{e.invoice_number || "—"}</td>
                      <td className="px-4 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${stateColor(e.from_state || "")}`}>{e.from_state || "—"}</span>
                        <ArrowRight className="h-3 w-3 inline mx-1 text-muted" />
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${stateColor(e.to_state)}`}>{e.to_state}</span>
                      </td>
                      <td className="px-4 py-1.5 text-right font-mono">{fmtTotal(e.total)}</td>
                      <td className="px-4 py-1.5 text-muted">{e.upname || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
