"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, CircleDot, CheckCircle2, AlertCircle, Clock, Zap } from "lucide-react";

type Action = {
  id: number;
  action: string;
  params: Record<string, any>;
  status: string;
  result: any;
  error: string | null;
  requested_by: string;
  created_at: string;
  picked_up_at: string | null;
  processed_at: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-blue-100 text-blue-800 border-blue-300",
  claimed: "bg-amber-100 text-amber-800 border-amber-300",
  done: "bg-green-100 text-green-800 border-green-300",
  error: "bg-red-100 text-red-800 border-red-300",
};
const STATUS_ICON: Record<string, React.ElementType> = {
  pending: Clock,
  claimed: CircleDot,
  done: CheckCircle2,
  error: AlertCircle,
};

function relTime(iso: string | null, now: number): string {
  if (!iso) return "—";
  const sec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function OpsLamlinks() {
  const [actions, setActions] = useState<Action[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastRefreshRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/lamlinks-rescue/status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setActions(data.actions || []);
      setErr(null);
      lastRefreshRef.current = Date.now();
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  }, []);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function enqueue(action: string, params: Record<string, any>, dry_run = false) {
    setErr(null);
    try {
      const res = await fetch("/api/lamlinks-rescue/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, params, dry_run }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enqueue failed");
      refresh();
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  }

  const pending = useMemo(() => actions?.filter((a) => a.status === "pending" || a.status === "claimed").length ?? 0, [actions]);

  return (
    <div>
      {err && <div className="mb-3 rounded border border-red-300 bg-red-50 text-red-700 text-sm p-3">{err}</div>}

      {/* Quick-action cards */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <InspectCard onSubmit={(id) => enqueue("inspect", { idnk33: id })} />
        <ListStagingCard onSubmit={(user) => enqueue("list_staging", user ? { user } : {})} />
        <MarkSentCard onSubmit={(id, dry) => enqueue("mark_sent", { idnk33: id }, dry)} />
        <RetireCard onSubmit={(id, dry) => enqueue("retire", { idnk33: id }, dry)} />
        <RemoveK34Card onSubmit={(id, dry) => enqueue("remove_k34", { idnk34: id }, dry)} />
        <MoveK34Card onSubmit={(from, to, ids, dry) => enqueue("move_k34", { from_idnk33: from, to_idnk33: to, k34_ids: ids }, dry)} />
        <ExtractCard onSubmit={(id, dry) => enqueue("extract_to_temp", { idnk33: id }, dry)} />
        <NukeCard onSubmit={(id, dry) => enqueue("nuke", { idnk33: id }, dry)} />
      </div>

      {/* Queue view */}
      <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-card-border bg-gray-50 flex items-center gap-3">
          <h2 className="text-sm font-semibold">Recent actions</h2>
          {pending > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5">
              <Zap className="h-3 w-3" /> {pending} pending worker pickup
            </span>
          )}
          <div className="flex-1" />
          <span className="text-[11px] text-muted">Refreshed {lastRefreshRef.current ? relTime(new Date(lastRefreshRef.current).toISOString(), now) : "—"}</span>
          <button onClick={refresh} className="text-xs rounded border border-card-border px-2 py-1 hover:bg-white inline-flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/50 text-muted text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Action</th>
                <th className="px-3 py-2 text-left font-medium">Params</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Result / Error</th>
                <th className="px-3 py-2 text-left font-medium">Requested</th>
                <th className="px-3 py-2 text-left font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {actions === null ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted"><Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Loading...</td></tr>
              ) : actions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted text-sm">No actions yet.</td></tr>
              ) : actions.map((a) => {
                const Icon = STATUS_ICON[a.status] || Clock;
                return (
                  <tr key={a.id} className={`border-t border-card-border ${a.status === "error" ? "bg-red-50/30" : ""}`}>
                    <td className="px-3 py-2 font-mono text-xs">{a.action}</td>
                    <td className="px-3 py-2 text-xs font-mono text-muted truncate max-w-[260px]" title={JSON.stringify(a.params)}>
                      {JSON.stringify(a.params)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] rounded border px-1.5 py-0.5 ${STATUS_COLOR[a.status] || STATUS_COLOR.pending}`}>
                        <Icon className="h-3 w-3" /> {a.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {a.error ? (
                        <span className="text-red-700" title={a.error}>{a.error.slice(0, 80)}{a.error.length > 80 ? "…" : ""}</span>
                      ) : a.result ? (
                        <details>
                          <summary className="cursor-pointer text-muted">{Object.keys(a.result).length} field(s)</summary>
                          <pre className="mt-1 text-[10px] bg-gray-50 p-2 rounded max-h-60 overflow-auto">{JSON.stringify(a.result, null, 2)}</pre>
                        </details>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-2 text-muted text-xs whitespace-nowrap">{relTime(a.created_at, now)}</td>
                    <td className="px-3 py-2 text-muted text-xs">{a.requested_by}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-[11px] text-muted leading-snug">
        Worker on NYEVRVSQL001 polls <span className="font-mono">lamlinks_rescue_actions</span> every ~10 s.
        After the worker lands the <span className="font-mono">rescue</span> handler, actions will pick up and complete here with a result blob.
        Until then, continue using the <span className="font-mono">scripts/ll-*</span> CLI tools directly — same SQL, just terminal instead of buttons.
      </div>
    </div>
  );
}

// ——— Action cards ———

function FieldCard({ title, color, desc, children }: { title: string; color: string; desc: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border-2 bg-card-bg p-4 ${color}`}>
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-[11px] text-muted mb-3 leading-snug">{desc}</div>
      {children}
    </div>
  );
}

function InspectCard({ onSubmit }: { onSubmit: (id: number) => void }) {
  const [id, setId] = useState("");
  return (
    <FieldCard title="Inspect envelope" color="border-blue-200" desc="Dump k33 + k34 + k35 + lock view for an envelope. Read-only.">
      <div className="flex gap-2">
        <input type="number" value={id} onChange={(e) => setId(e.target.value)} placeholder="idnk33 (e.g. 46879)" className="flex-1 rounded border border-card-border px-2 py-1 text-sm" />
        <button onClick={() => id && onSubmit(Number(id))} className="rounded bg-blue-600 text-white px-3 py-1 text-sm font-medium">Run</button>
      </div>
    </FieldCard>
  );
}

function ListStagingCard({ onSubmit }: { onSubmit: (user: string) => void }) {
  const [user, setUser] = useState("");
  return (
    <FieldCard title="List staging envelopes" color="border-slate-200" desc="Shows top 30 recent k33 rows where o_stat='adding quotes'.">
      <div className="flex gap-2">
        <input type="text" value={user} onChange={(e) => setUser(e.target.value)} placeholder="upname (optional, e.g. ajoseph)" className="flex-1 rounded border border-card-border px-2 py-1 text-sm" />
        <button onClick={() => onSubmit(user)} className="rounded bg-slate-600 text-white px-3 py-1 text-sm font-medium">Run</button>
      </div>
    </FieldCard>
  );
}

function MarkSentCard({ onSubmit }: { onSubmit: (id: number, dry: boolean) => void }) {
  const [id, setId] = useState("");
  return (
    <FieldCard title="Mark envelope sent (first-choice)" color="border-green-300" desc="Reconcile LL's local state after a confirmed DLA ack. Flips t_stat='sent', a_stat='acknowledged'.">
      <div className="flex gap-2 mb-2">
        <input type="number" value={id} onChange={(e) => setId(e.target.value)} placeholder="idnk33" className="flex-1 rounded border border-card-border px-2 py-1 text-sm" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => id && onSubmit(Number(id), true)} className="flex-1 rounded border border-card-border px-3 py-1 text-xs">Dry run</button>
        <button onClick={() => id && onSubmit(Number(id), false)} className="flex-1 rounded bg-green-600 text-white px-3 py-1 text-xs font-medium">Execute</button>
      </div>
    </FieldCard>
  );
}

function RetireCard({ onSubmit }: { onSubmit: (id: number, dry: boolean) => void }) {
  const [id, setId] = useState("");
  return (
    <FieldCard title="Retire envelope" color="border-amber-200" desc="Flip o_stat='quotes added' to stop LL from piggybacking. t_stat stays 'not sent'.">
      <div className="flex gap-2 mb-2"><input type="number" value={id} onChange={(e) => setId(e.target.value)} placeholder="idnk33" className="flex-1 rounded border border-card-border px-2 py-1 text-sm" /></div>
      <div className="flex gap-2">
        <button onClick={() => id && onSubmit(Number(id), true)} className="flex-1 rounded border border-card-border px-3 py-1 text-xs">Dry run</button>
        <button onClick={() => id && onSubmit(Number(id), false)} className="flex-1 rounded bg-amber-600 text-white px-3 py-1 text-xs font-medium">Execute</button>
      </div>
    </FieldCard>
  );
}

function RemoveK34Card({ onSubmit }: { onSubmit: (id: number, dry: boolean) => void }) {
  const [id, setId] = useState("");
  return (
    <FieldCard title="Remove single k34 line" color="border-orange-200" desc="Surgical: delete one k34 + its k35 price row, decrement envelope itmcnt.">
      <div className="flex gap-2 mb-2"><input type="number" value={id} onChange={(e) => setId(e.target.value)} placeholder="idnk34" className="flex-1 rounded border border-card-border px-2 py-1 text-sm" /></div>
      <div className="flex gap-2">
        <button onClick={() => id && onSubmit(Number(id), true)} className="flex-1 rounded border border-card-border px-3 py-1 text-xs">Dry run</button>
        <button onClick={() => id && onSubmit(Number(id), false)} className="flex-1 rounded bg-orange-600 text-white px-3 py-1 text-xs font-medium">Execute</button>
      </div>
    </FieldCard>
  );
}

function MoveK34Card({ onSubmit }: { onSubmit: (from: number, to: number, ids: number[], dry: boolean) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ids, setIds] = useState("");
  const parsedIds = ids.split(",").map((s) => Number(s.trim())).filter(Boolean);
  return (
    <FieldCard title="Move k34 lines between envelopes" color="border-purple-200" desc="Transplant lines from a poisoned envelope to a clean LL-native one.">
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input type="number" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="from idnk33" className="rounded border border-card-border px-2 py-1 text-sm" />
        <input type="number" value={to} onChange={(e) => setTo(e.target.value)} placeholder="to idnk33" className="rounded border border-card-border px-2 py-1 text-sm" />
      </div>
      <input type="text" value={ids} onChange={(e) => setIds(e.target.value)} placeholder="k34 ids (comma-separated)" className="w-full mb-2 rounded border border-card-border px-2 py-1 text-sm font-mono text-xs" />
      <div className="flex gap-2">
        <button onClick={() => from && to && parsedIds.length && onSubmit(Number(from), Number(to), parsedIds, true)} className="flex-1 rounded border border-card-border px-3 py-1 text-xs">Dry run</button>
        <button onClick={() => from && to && parsedIds.length && onSubmit(Number(from), Number(to), parsedIds, false)} className="flex-1 rounded bg-purple-600 text-white px-3 py-1 text-xs font-medium">Execute</button>
      </div>
    </FieldCard>
  );
}

function ExtractCard({ onSubmit }: { onSubmit: (id: number, dry: boolean) => void }) {
  const [id, setId] = useState("");
  return (
    <FieldCard title="Extract to temp (park + delete k33)" color="border-rose-200" desc="Move all k34s to a temporary parking envelope, delete original k33. Preserves line data.">
      <div className="flex gap-2 mb-2"><input type="number" value={id} onChange={(e) => setId(e.target.value)} placeholder="idnk33" className="flex-1 rounded border border-card-border px-2 py-1 text-sm" /></div>
      <div className="flex gap-2">
        <button onClick={() => id && onSubmit(Number(id), true)} className="flex-1 rounded border border-card-border px-3 py-1 text-xs">Dry run</button>
        <button onClick={() => id && onSubmit(Number(id), false)} className="flex-1 rounded bg-rose-600 text-white px-3 py-1 text-xs font-medium">Execute</button>
      </div>
    </FieldCard>
  );
}

function NukeCard({ onSubmit }: { onSubmit: (id: number, dry: boolean) => void }) {
  const [id, setId] = useState("");
  return (
    <FieldCard title="Nuke envelope (LAST RESORT)" color="border-red-400" desc="Delete all k34+k35 rows AND the k33 row. Loses the bids. Only after rescue paths fail.">
      <div className="flex gap-2 mb-2"><input type="number" value={id} onChange={(e) => setId(e.target.value)} placeholder="idnk33" className="flex-1 rounded border border-card-border px-2 py-1 text-sm" /></div>
      <div className="flex gap-2">
        <button onClick={() => id && onSubmit(Number(id), true)} className="flex-1 rounded border border-card-border px-3 py-1 text-xs">Dry run</button>
        <button onClick={() => id && confirm(`NUKE envelope ${id}? Bids will be LOST.`) && onSubmit(Number(id), false)} className="flex-1 rounded bg-red-700 text-white px-3 py-1 text-xs font-medium">Execute</button>
      </div>
    </FieldCard>
  );
}
