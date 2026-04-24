"use client";
import { useEffect, useState, useMemo } from "react";
import { AlertTriangle, Clock, CheckCircle2, XCircle, RefreshCw, Activity, Inbox, Send } from "lucide-react";

type QueueRow = {
  id: number;
  status: string;
  solicitation_number: string | null;
  nsn: string | null;
  bid_price: number | null;
  bid_qty: number | null;
  created_at: string;
  picked_up_at: string | null;
  processed_at: string | null;
  error_message: string | null;
  envelope_idnk33: number | null;
  line_idnk34: number | null;
};

type Envelope = {
  idnk33_k33: number;
  qotref_k33: string;
  o_stat_k33: string;
  t_stat_k33: string;
  s_stat_k33?: string;
  itmcnt_k33: number;
  age_min?: number;
  uptime_k33: string;
  t_stme_k33?: string;
};

type Snapshot = {
  id: number;
  snapshot_time: string;
  stuck_staged_count: number;
  stuck_staged_samples: Envelope[] | null;
  unshipped_count: number;
  unshipped_samples: Envelope[] | null;
  orphan_awards_count: number;
  orphan_awards_samples: any[] | null;
  recent_envelopes: Envelope[] | null;
  snapshot_error: string | null;
};

type Props = {
  queueRows: QueueRow[];
  latestSnapshot: Snapshot | null;
  workerHeartbeat: string | null;
  writebackEnabled: boolean;
  writebackNote: string | null;
};

function ageMinutes(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

function ageLabel(m: number | null): string {
  if (m == null) return "—";
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function DibsPipelineDashboard(props: Props) {
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);

  // Auto-refresh every 30s by reloading the SSR page (simplest, always fresh)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (now === props.queueRows.length) return;
    // noop; rerender stamp
  }, [now, props.queueRows.length]);

  const queueByStatus = useMemo(() => {
    const m: Record<string, QueueRow[]> = { pending: [], processing: [], done: [], failed: [] };
    for (const r of props.queueRows) {
      if (!m[r.status]) m[r.status] = [];
      m[r.status].push(r);
    }
    return m;
  }, [props.queueRows]);

  const oldestPending = useMemo(() => {
    const p = queueByStatus.pending || [];
    if (p.length === 0) return null;
    return p.reduce((acc, r) => (r.created_at < acc.created_at ? r : acc));
  }, [queueByStatus]);

  const snapshotAge = ageMinutes(props.latestSnapshot?.snapshot_time || null);
  const snapshotStale = snapshotAge != null && snapshotAge > 10;
  const workerAge = ageMinutes(props.workerHeartbeat);
  const workerStale = workerAge == null || workerAge > 2;

  const reload = () => {
    setLoading(true);
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-accent" /> DIBS → LL → DLA Pipeline
          </h1>
          <p className="text-sm text-muted mt-1">
            End-to-end health of the bid pipeline. Auto-refreshes every 30s.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded border border-card-border px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Top banners — worker + writeback status */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className={`rounded-lg border p-3 text-xs ${props.writebackEnabled ? "bg-green-50 border-green-300 text-green-900" : "bg-gray-50 border-card-border text-muted"}`}>
          <div className="font-semibold flex items-center gap-1">
            {props.writebackEnabled ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            Writeback {props.writebackEnabled ? "ENABLED" : "PAUSED"}
          </div>
          {props.writebackNote && <div className="mt-1 text-[11px]">{props.writebackNote}</div>}
        </div>
        <div className={`rounded-lg border p-3 text-xs ${workerStale ? "bg-red-50 border-red-300 text-red-900" : "bg-green-50 border-green-300 text-green-900"}`}>
          <div className="font-semibold flex items-center gap-1">
            {workerStale ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            Worker {workerStale ? "OFFLINE" : "online"}
          </div>
          <div className="mt-1 text-[11px]">
            Last heartbeat: {props.workerHeartbeat ? ageLabel(workerAge) : "never"}
          </div>
        </div>
        <div className={`rounded-lg border p-3 text-xs ${snapshotStale ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-gray-50 border-card-border"}`}>
          <div className="font-semibold flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Pipeline snapshot
          </div>
          <div className="mt-1 text-[11px]">
            {props.latestSnapshot ? `from ${ageLabel(snapshotAge)}` : "no snapshot yet — worker needs to run snapshot-ll-pipeline"}
          </div>
        </div>
      </div>

      {/* Panel 1: lamlinks_write_queue */}
      <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
        <div className="px-4 py-2 border-b border-card-border bg-gray-50 flex items-center justify-between">
          <div className="font-semibold flex items-center gap-2">
            <Inbox className="h-4 w-4 text-accent" /> DIBS Write Queue
          </div>
          <div className="text-[11px] text-muted">lamlinks_write_queue · DIBS → Windows worker</div>
        </div>
        <div className="grid grid-cols-4 gap-0 text-sm">
          {(["pending", "processing", "done", "failed"] as const).map((status) => {
            const rows = queueByStatus[status] || [];
            const color =
              status === "failed" ? "bg-red-50 text-red-900" :
              status === "pending" ? "bg-amber-50 text-amber-900" :
              status === "processing" ? "bg-blue-50 text-blue-900" :
              "bg-green-50 text-green-900";
            return (
              <div key={status} className={`p-3 border-r border-card-border last:border-r-0 ${color}`}>
                <div className="text-[10px] uppercase tracking-wide font-semibold">{status}</div>
                <div className="text-2xl font-bold font-mono">{rows.length}</div>
              </div>
            );
          })}
        </div>
        {oldestPending && (
          <div className="px-4 py-2 border-t border-card-border bg-amber-50 text-xs text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
            Oldest pending: <strong>{oldestPending.solicitation_number}</strong> · NSN {oldestPending.nsn} · ${oldestPending.bid_price} · queued {ageLabel(ageMinutes(oldestPending.created_at))}
          </div>
        )}
        {(queueByStatus.failed || []).length > 0 && (
          <div className="px-4 py-2 border-t border-card-border bg-red-50 text-xs">
            <div className="font-semibold text-red-900 mb-1">Recent failures:</div>
            <div className="space-y-0.5">
              {queueByStatus.failed.slice(0, 5).map((r) => (
                <div key={r.id} className="text-[11px] text-red-800 truncate">
                  <span className="font-mono">{r.solicitation_number}</span> · {r.error_message?.slice(0, 140) || "(no error message)"}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Panel 2: Stuck staged envelopes */}
      <EnvelopePanel
        title="Stuck Staged Envelopes"
        subtitle="LL k33 at o_stat='adding quotes' older than 5 min — should be ~0 after envelope-finalization patch. Non-zero = DIBS worker didn't finalize OR Abe has a draft in progress"
        count={props.latestSnapshot?.stuck_staged_count ?? 0}
        samples={props.latestSnapshot?.stuck_staged_samples ?? []}
        tone="amber"
        ageField
      />

      {/* Panel 3: Unshipped envelopes */}
      <EnvelopePanel
        title="Unshipped Envelopes"
        subtitle="LL k33 at 'quotes added' + t_stat='not sent' older than 10 min. These bids haven't reached DLA yet — LL transmit daemon stuck or nobody clicked Post"
        count={props.latestSnapshot?.unshipped_count ?? 0}
        samples={props.latestSnapshot?.unshipped_samples ?? []}
        tone="red"
        ageField
      />

      {/* Panel 4: Recent envelope activity (last 24h) */}
      <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
        <div className="px-4 py-2 border-b border-card-border bg-gray-50 flex items-center justify-between">
          <div className="font-semibold flex items-center gap-2">
            <Send className="h-4 w-4 text-accent" /> Recent LL Envelope Activity (last 24h)
          </div>
          <div className="text-[11px] text-muted">
            {(props.latestSnapshot?.recent_envelopes || []).length} envelopes · source of truth: k33_tab
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-muted sticky top-0">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Envelope</th>
                <th className="px-3 py-1.5 text-left font-medium">Status</th>
                <th className="px-3 py-1.5 text-right font-medium">Items</th>
                <th className="px-3 py-1.5 text-left font-medium">Opened</th>
                <th className="px-3 py-1.5 text-left font-medium">Transmitted</th>
              </tr>
            </thead>
            <tbody>
              {(props.latestSnapshot?.recent_envelopes || []).map((e) => {
                const sent = String(e.t_stat_k33 || "").trim() === "sent";
                const finalized = String(e.o_stat_k33 || "").trim() === "quotes added";
                return (
                  <tr key={e.idnk33_k33} className="border-t border-card-border/60">
                    <td className="px-3 py-1.5 font-mono text-[11px]">
                      {e.qotref_k33?.trim()} <span className="text-muted">(#{e.idnk33_k33})</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sent ? "bg-green-100 text-green-700" : finalized ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                        {e.o_stat_k33?.trim()} / {e.t_stat_k33?.trim()}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{e.itmcnt_k33}</td>
                    <td className="px-3 py-1.5 text-muted">{e.uptime_k33 ? new Date(e.uptime_k33).toLocaleTimeString() : "—"}</td>
                    <td className="px-3 py-1.5 text-muted">{sent && e.t_stme_k33 ? new Date(e.t_stme_k33).toLocaleTimeString() : "—"}</td>
                  </tr>
                );
              })}
              {(props.latestSnapshot?.recent_envelopes || []).length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted text-xs">
                  No recent envelope activity. Worker may not have run snapshot yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {props.latestSnapshot?.snapshot_error && (
        <div className="rounded-xl border-2 border-red-500 bg-red-50 p-3 text-xs text-red-900">
          <div className="font-semibold">Latest snapshot errored:</div>
          <div className="font-mono mt-1">{props.latestSnapshot.snapshot_error}</div>
        </div>
      )}
    </div>
  );
}

function EnvelopePanel({
  title, subtitle, count, samples, tone, ageField,
}: {
  title: string;
  subtitle: string;
  count: number;
  samples: Envelope[];
  tone: "red" | "amber" | "green";
  ageField?: boolean;
}) {
  const colorCls =
    tone === "red" ? "bg-red-50 border-red-300 text-red-900" :
    tone === "amber" ? "bg-amber-50 border-amber-300 text-amber-900" :
    "bg-green-50 border-green-300 text-green-900";
  const ok = count === 0;
  return (
    <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
      <div className="px-4 py-2 border-b border-card-border bg-gray-50 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{title}</div>
          <div className="text-[11px] text-muted mt-0.5">{subtitle}</div>
        </div>
        <div className={`rounded-lg px-4 py-2 font-mono text-2xl font-bold ${ok ? "bg-green-50 text-green-700" : colorCls}`}>
          {count}
        </div>
      </div>
      {samples.length > 0 && (
        <div className="max-h-[260px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-muted sticky top-0">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Envelope</th>
                <th className="px-3 py-1.5 text-left font-medium">o_stat</th>
                <th className="px-3 py-1.5 text-left font-medium">t_stat</th>
                <th className="px-3 py-1.5 text-right font-medium">Items</th>
                {ageField && <th className="px-3 py-1.5 text-right font-medium">Age</th>}
              </tr>
            </thead>
            <tbody>
              {samples.map((e) => (
                <tr key={e.idnk33_k33} className="border-t border-card-border/60">
                  <td className="px-3 py-1.5 font-mono text-[11px]">{e.qotref_k33?.trim()} <span className="text-muted">(#{e.idnk33_k33})</span></td>
                  <td className="px-3 py-1.5 text-[11px]">{e.o_stat_k33?.trim()}</td>
                  <td className="px-3 py-1.5 text-[11px]">{e.t_stat_k33?.trim()}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{e.itmcnt_k33}</td>
                  {ageField && <td className="px-3 py-1.5 text-right font-mono text-[11px]">{e.age_min != null ? `${e.age_min}m` : "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
