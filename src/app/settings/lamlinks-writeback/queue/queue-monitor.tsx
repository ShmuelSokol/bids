"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, CircleDot, CheckCircle2, AlertCircle, Clock, Zap, Pause, Play } from "lucide-react";

type Row = {
  id: number;
  solicitation_number: string;
  nsn: string;
  bid_price: number | null;
  bid_qty: number | null;
  delivery_days: number | null;
  status: string;
  created_at: string;
  picked_up_at: string | null;
  processed_at: string | null;
  envelope_idnk33: number | null;
  line_idnk34: number | null;
  price_idnk35: number | null;
  error_message: string | null;
  created_by: string | null;
};

type Payload = {
  rows: Row[];
  counts: Record<string, number>;
  pending_total: number;
  writeback_live: boolean;
  worker_last_heartbeat: string | null;
};

function relativeTime(iso: string | null, nowMs: number): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

const STATUS_META: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pending: { color: "bg-blue-100 text-blue-800 border-blue-300", icon: Clock, label: "pending" },
  claimed: { color: "bg-amber-100 text-amber-800 border-amber-300", icon: CircleDot, label: "claimed" },
  done: { color: "bg-green-100 text-green-800 border-green-300", icon: CheckCircle2, label: "done" },
  error: { color: "bg-red-100 text-red-800 border-red-300", icon: AlertCircle, label: "error" },
};

export function QueueMonitor() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [paused, setPaused] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const lastRefreshRef = useRef<number>(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/lamlinks-writeback/queue", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setPayload(data);
      setErr(null);
      lastRefreshRef.current = Date.now();
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  }, []);

  // Poll every 3 s — this monitor is meant to catch state transitions fast.
  useEffect(() => {
    refresh();
    if (paused) return;
    const id = setInterval(refresh, 3_000);
    return () => clearInterval(id);
  }, [refresh, paused]);

  // Tick every second for live relative timestamps.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(() => {
    if (!payload) return [];
    if (!statusFilter) return payload.rows;
    return payload.rows.filter((r) => r.status === statusFilter);
  }, [payload, statusFilter]);

  const refreshedAgo = Math.floor((nowMs - lastRefreshRef.current) / 1000);

  const heartbeatAgeSec = payload?.worker_last_heartbeat
    ? Math.floor((nowMs - new Date(payload.worker_last_heartbeat).getTime()) / 1000)
    : null;
  const workerHealthy = heartbeatAgeSec !== null && heartbeatAgeSec < 120; // <2 min
  const workerStale = heartbeatAgeSec !== null && heartbeatAgeSec >= 120 && heartbeatAgeSec < 600;
  const workerDead = heartbeatAgeSec === null || heartbeatAgeSec >= 600;

  return (
    <div>
      {/* Top banner — live / worker health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className={`rounded-lg border-2 p-3 ${payload?.writeback_live ? "border-green-400 bg-green-50" : "border-gray-300 bg-gray-50"}`}>
          <div className="text-xs text-muted">Writeback flag</div>
          <div className="text-lg font-semibold flex items-center gap-1">
            <Zap className={`h-4 w-4 ${payload?.writeback_live ? "text-green-600" : "text-gray-500"}`} />
            {payload?.writeback_live ? "LIVE" : "SIMULATED"}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            {payload?.writeback_live
              ? "Submits enqueue for k33/k34/k35 write"
              : "Submits stay DIBS-local only"}
          </div>
        </div>

        <div className={`rounded-lg border-2 p-3 ${workerHealthy ? "border-green-400 bg-green-50" : workerStale ? "border-amber-400 bg-amber-50" : "border-red-400 bg-red-50"}`}>
          <div className="text-xs text-muted">Worker heartbeat</div>
          <div className="text-lg font-semibold flex items-center gap-1">
            <CircleDot className={`h-4 w-4 ${workerHealthy ? "text-green-600" : workerStale ? "text-amber-600" : "text-red-600"}`} />
            {workerHealthy ? "healthy" : workerStale ? "stale" : "dead"}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            {payload?.worker_last_heartbeat
              ? `last ping ${relativeTime(payload.worker_last_heartbeat, nowMs)}`
              : "never seen"}
          </div>
        </div>

        <div className="rounded-lg border-2 border-card-border bg-card-bg p-3">
          <div className="text-xs text-muted">Pending in queue</div>
          <div className="text-lg font-semibold">
            {payload?.pending_total ?? "—"}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            waiting for worker to claim
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1">
          {(["pending", "claimed", "done", "error"] as const).map((s) => {
            const count = payload?.counts[s] || 0;
            const meta = STATUS_META[s];
            const Icon = meta.icon;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(active ? null : s)}
                className={`inline-flex items-center gap-1 rounded border text-xs px-2 py-1 ${meta.color} ${active ? "ring-2 ring-accent" : ""}`}
              >
                <Icon className="h-3 w-3" />
                {meta.label} {count}
              </button>
            );
          })}
          {statusFilter && (
            <button
              onClick={() => setStatusFilter(null)}
              className="text-[11px] text-muted hover:text-foreground ml-1"
            >
              clear filter
            </button>
          )}
        </div>
        <div className="flex-1" />
        {lastRefreshRef.current > 0 && (
          <span className="text-[11px] text-muted">
            Refreshed {refreshedAgo < 2 ? "just now" : `${refreshedAgo}s ago`}
          </span>
        )}
        <button
          onClick={() => setPaused((p) => !p)}
          className="inline-flex items-center gap-1 text-xs rounded border border-card-border px-2 py-1 hover:bg-gray-50"
          title={paused ? "Resume auto-refresh (every 3s)" : "Pause auto-refresh"}
        >
          {paused ? <><Play className="h-3 w-3" /> Resume</> : <><Pause className="h-3 w-3" /> Pause</>}
        </button>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1 text-xs rounded border border-card-border px-2 py-1 hover:bg-gray-50"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {err && <div className="mb-3 rounded border border-red-300 bg-red-50 text-red-700 text-sm p-3">{err}</div>}

      {/* Queue table */}
      <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-muted text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Solicitation</th>
                <th className="px-3 py-2 font-medium">NSN</th>
                <th className="px-3 py-2 font-medium text-right">Price</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium text-right">Days</th>
                <th className="px-3 py-2 font-medium">Enqueued</th>
                <th className="px-3 py-2 font-medium">Picked</th>
                <th className="px-3 py-2 font-medium">Done</th>
                <th className="px-3 py-2 font-medium">LL IDs</th>
                <th className="px-3 py-2 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {!payload ? (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-muted">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-muted text-sm">
                    {statusFilter ? `No rows with status=${statusFilter}.` : "Queue is empty."}
                  </td>
                </tr>
              ) : rows.map((r) => {
                const meta = STATUS_META[r.status] || STATUS_META.pending;
                const Icon = meta.icon;
                return (
                  <tr key={r.id} className={`border-t border-card-border hover:bg-gray-50/50 ${r.status === "error" ? "bg-red-50/30" : ""}`}>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium rounded border px-1.5 py-0.5 ${meta.color}`}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.solicitation_number}</td>
                    <td className="px-3 py-2 font-mono text-xs text-accent">{r.nsn}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">${Number(r.bid_price || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-xs">{r.bid_qty ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-xs">{r.delivery_days ?? "—"}</td>
                    <td className="px-3 py-2 text-muted text-xs whitespace-nowrap" title={r.created_at}>{relativeTime(r.created_at, nowMs)}</td>
                    <td className="px-3 py-2 text-muted text-xs whitespace-nowrap" title={r.picked_up_at || ""}>{relativeTime(r.picked_up_at, nowMs)}</td>
                    <td className="px-3 py-2 text-muted text-xs whitespace-nowrap" title={r.processed_at || ""}>{relativeTime(r.processed_at, nowMs)}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.envelope_idnk33 ? (
                        <span className="text-muted">
                          k33=<span className="font-mono text-foreground">{r.envelope_idnk33}</span>
                          {r.line_idnk34 && <> · k34=<span className="font-mono text-foreground">{r.line_idnk34}</span></>}
                        </span>
                      ) : r.error_message ? (
                        <span className="text-red-700 text-[11px]" title={r.error_message}>
                          {r.error_message.length > 60 ? r.error_message.slice(0, 60) + "…" : r.error_message}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted text-xs">{r.created_by || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-[11px] text-muted mt-3 leading-snug">
        Auto-refreshes every 3s (pause with the button). Timestamps update every 1s.
        &ldquo;LL IDs&rdquo; column shows the envelope / line IDs assigned by the worker —
        open the envelope in the LamLinks client to verify the quote landed.
        Errors show inline; hover for full message.
      </div>
    </div>
  );
}
