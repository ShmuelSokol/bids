"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, AlertTriangle, Clock, CheckCircle2, Activity, FileText } from "lucide-react";
import { formatDateShort, formatDateTime } from "@/lib/dates";

interface Transmission {
  id: number;
  idnkbr: number;
  parent_table: string;
  parent_id: number;
  scenario: string | null;
  status: string;
  transmitted_at: string;
  added_by: string | null;
  edi_type: string;
  lifecycle: string;
}

interface Props {
  recent: Transmission[];
  dpms: Transmission[];
  problems: Transmission[];
  lifecycleCounts: { lifecycle: string; edi_type: string }[];
  lastSync: string | null;
}

const LIFECYCLE_COLOR: Record<string, string> = {
  acknowledged: "bg-green-50 text-green-700 border-green-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  problem: "bg-red-50 text-red-700 border-red-200",
  not_sent: "bg-gray-50 text-gray-600 border-gray-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export function TransmissionsDashboard({ recent, dpms, problems, lifecycleCounts, lastSync }: Props) {
  const [tab, setTab] = useState<"recent" | "problems" | "dpms" | "stale">("recent");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of lifecycleCounts) {
      const k = `${r.edi_type}:${r.lifecycle}`;
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  }, [lifecycleCounts]);

  // Stale = WAWF 810 sent > 30 days ago (LL never records acks, so staleness
  // is the only signal we have that something needs attention)
  const stale = useMemo(() => {
    const threshold = Date.now() - 30 * 86_400_000;
    return recent.filter(
      (t) => t.edi_type === "810" && t.lifecycle === "sent" && new Date(t.transmitted_at).getTime() < threshold
    );
  }, [recent]);

  const filtered = useMemo(() => {
    const base =
      tab === "recent" ? recent : tab === "problems" ? problems : tab === "dpms" ? dpms : stale;
    if (typeFilter === "all") return base;
    return base.filter((t) => t.edi_type === typeFilter);
  }, [tab, typeFilter, recent, problems, dpms, stale]);

  const total90d = lifecycleCounts.length;
  const wawf810Sent = (counts["810:sent"] ?? 0);
  const wawf856Sent = (counts["856:sent"] ?? 0);
  const dpmsPending =
    (counts["DPMS:sent"] ?? 0) + (counts["DPMS:not_sent"] ?? 0) + (counts["DPMS:other"] ?? 0);
  const problemsCount = lifecycleCounts.filter((r) => r.lifecycle === "problem").length;

  return (
    <>
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/ops/lamlinks" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Ops LamLinks
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Transmissions</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">EDI Transmissions</h1>
        <p className="text-muted mt-1 text-sm">
          WAWF 810/856/857 + DPMS transmission health from LL kbr_tab. LL only records{" "}
          <em>outgoing</em> transmissions — acks come from DLA via email/portal and are never
          written back. Staleness and problem counts are the actionable signals here.
          {lastSync && <span className="ml-2 text-[10px]">Last sync: {formatDateTime(lastSync)}</span>}
        </p>
      </div>

      {/* Top-level counts, last 90 days */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="rounded-lg border border-card-border bg-card-bg p-3">
          <div className="text-2xl font-bold">{total90d.toLocaleString()}</div>
          <div className="text-xs text-muted flex items-center gap-1"><Activity className="h-3 w-3" /> Last 90d</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-2xl font-bold text-blue-700">{wawf810Sent.toLocaleString()}</div>
          <div className="text-xs text-muted">WAWF 810 sent</div>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
          <div className="text-2xl font-bold text-sky-700">{wawf856Sent.toLocaleString()}</div>
          <div className="text-xs text-muted">WAWF 856 sent</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-2xl font-bold text-amber-700">{dpmsPending.toLocaleString()}</div>
          <div className="text-xs text-muted flex items-center gap-1"><Clock className="h-3 w-3" /> DPMS pending</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="text-2xl font-bold text-red-700">{problemsCount.toLocaleString()}</div>
          <div className="text-xs text-muted flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Problems</div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {[
          { k: "recent", label: `Recent (${recent.length})` },
          { k: "problems", label: `Problems (${problems.length})`, danger: true },
          { k: "dpms", label: `DPMS (${dpms.length})` },
          { k: "stale", label: `Stale 810 >30d (${stale.length})` },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as any)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
              tab === t.k
                ? "ring-2 ring-accent border-accent"
                : t.danger
                ? "border-red-200 text-red-700 hover:bg-red-50"
                : "border-card-border"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex gap-1 items-center text-xs">
          <span className="text-muted">Type:</span>
          {["all", "810", "856", "857", "DPMS"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded border px-2 py-0.5 ${
                typeFilter === t ? "ring-1 ring-accent border-accent" : "border-card-border"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-3 py-2 font-medium">Transmitted</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Lifecycle</th>
                <th className="px-3 py-2 font-medium">Parent</th>
                <th className="px-3 py-2 font-medium">Scenario</th>
                <th className="px-3 py-2 font-medium">By</th>
                <th className="px-3 py-2 font-medium text-right">Days</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-muted">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">Nothing here</p>
                    <p className="text-xs mt-1">
                      {tab === "problems"
                        ? "No problem transmissions — good news."
                        : tab === "stale"
                        ? "No 810s over 30 days old in the synced window."
                        : "Run scripts/sync-ll-edi-transmissions.ts to pull more."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 300).map((t) => {
                  const d = daysAgo(t.transmitted_at);
                  const lc = LIFECYCLE_COLOR[t.lifecycle] ?? LIFECYCLE_COLOR.other;
                  return (
                    <tr key={t.id} className="border-b border-card-border/50 hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-[10px]">
                        {formatDateShort(t.transmitted_at)}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] font-medium">{t.edi_type}</td>
                      <td className="px-3 py-2 text-[10px]">{t.status.trim()}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${lc}`}>
                          {t.lifecycle}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted">
                        {t.parent_table}:{t.parent_id}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted">
                        {t.scenario || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted text-[10px]">{t.added_by || "—"}</td>
                      <td className="px-3 py-2 text-right text-muted text-[10px]">
                        {d !== null ? `${d}d` : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-3 py-2 border-t border-card-border text-xs text-muted flex items-center justify-between">
            <span>
              Showing {Math.min(filtered.length, 300)} of {filtered.length} {tab} transmissions
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span>Data: ll_edi_transmissions (from kbr_tab)</span>
            </span>
          </div>
        )}
      </div>
    </>
  );
}
