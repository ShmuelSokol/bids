"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
} from "lucide-react";
import { formatDateShort, formatDateTime } from "@/lib/dates";

interface Transmission {
  id: number;
  idnkbr: number;
  parent_table: string;
  parent_id: number;
  edi_type: string;
  lifecycle: string;
  status: string;
  transmitted_at: string;
  added_by: string | null;
  scenario: string | null;
}

interface Shipment {
  idnkaj: number;
  ship_number: string;
  contract_number: string;
  clin: string;
  nsn: string | null;
  description: string | null;
  quantity: number;
  sell_value: number;
  ship_status: string;
  ship_date: string;
  fob: string;
}

type Bucket = "awaiting" | "aging" | "stale" | "probable_reject";

const BUCKET_RANGES: Record<Bucket, { min: number; max: number; label: string; days: string }> = {
  awaiting: { min: 0, max: 14, label: "Awaiting", days: "0–14 days" },
  aging: { min: 15, max: 29, label: "Aging", days: "15–29 days" },
  stale: { min: 30, max: 44, label: "Stale", days: "30–44 days" },
  probable_reject: { min: 45, max: Infinity, label: "Probable reject", days: "45+ days" },
};

const BUCKET_COLOR: Record<Bucket, string> = {
  awaiting: "bg-green-50 text-green-700 border-green-200",
  aging: "bg-blue-50 text-blue-700 border-blue-200",
  stale: "bg-amber-50 text-amber-700 border-amber-300",
  probable_reject: "bg-red-50 text-red-700 border-red-300",
};

const BUCKET_BG: Record<Bucket, string> = {
  awaiting: "bg-green-50",
  aging: "bg-blue-50",
  stale: "bg-amber-50",
  probable_reject: "bg-red-50",
};

function daysAgo(iso: string): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return -1;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function bucketize(days: number): Bucket {
  if (days < 15) return "awaiting";
  if (days < 30) return "aging";
  if (days < 45) return "stale";
  return "probable_reject";
}

function fmt$(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

interface DlaPayment {
  ax_voucher: string | null;
  marked_invoice: string;
  marked_invoice_normalized: string;
  payment_date: string;
  payment_amount: number | null;
  payment_reference: string | null;
}

type Props = {
  transmissions: Transmission[];
  shipmentsByKaj: Record<string, Shipment>;
  lastSync: string | null;
  unsettledDlaInvoices?: DlaPayment[];
  recentDlaSettlements?: DlaPayment[];
  axPaymentsSync?: { created_at: string; details: any } | null;
};

export function AckTrackerDashboard({
  transmissions,
  shipmentsByKaj,
  lastSync,
  unsettledDlaInvoices = [],
  recentDlaSettlements = [],
  axPaymentsSync,
}: Props) {
  const [bucket, setBucket] = useState<Bucket | "all" | "actionable">("actionable");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    return transmissions.map((t) => {
      const ship = (t.parent_table === "kaj" ? shipmentsByKaj[t.parent_id] : null) as Shipment | null;
      const d = daysAgo(t.transmitted_at);
      const b = bucketize(d);
      return { t, ship, days: d, bucket: b };
    });
  }, [transmissions, shipmentsByKaj]);

  const stats = useMemo(() => {
    const byBucket: Record<Bucket, { count: number; value: number }> = {
      awaiting: { count: 0, value: 0 },
      aging: { count: 0, value: 0 },
      stale: { count: 0, value: 0 },
      probable_reject: { count: 0, value: 0 },
    };
    for (const r of rows) {
      byBucket[r.bucket].count++;
      byBucket[r.bucket].value += r.ship?.sell_value || 0;
    }
    const actionableValue = byBucket.stale.value + byBucket.probable_reject.value;
    const totalValue = rows.reduce((s, r) => s + (r.ship?.sell_value || 0), 0);
    return { byBucket, actionableValue, totalValue };
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (bucket === "actionable") {
      out = out.filter((r) => r.bucket === "stale" || r.bucket === "probable_reject");
    } else if (bucket !== "all") {
      out = out.filter((r) => r.bucket === bucket);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (r) =>
          r.ship?.contract_number?.toLowerCase().includes(q) ||
          r.ship?.ship_number?.toLowerCase().includes(q) ||
          r.ship?.nsn?.toLowerCase().includes(q) ||
          r.ship?.description?.toLowerCase().includes(q)
      );
    }
    // Oldest first (most critical at top)
    out = [...out].sort((a, b) => b.days - a.days);
    return out;
  }, [rows, bucket, search]);

  return (
    <>
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/ops/lamlinks" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Ops LamLinks
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Ack Tracker</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">WAWF 810 Ack Tracker</h1>
        <p className="text-muted text-sm mt-1 max-w-4xl">
          DLA doesn&apos;t push acks into LL, so we don&apos;t know definitively which invoices were accepted or rejected.
          We <em>infer</em> status from how long a transmission has been aging: an 810 sent 45+ days ago with no
          payment landed is almost certainly stuck in a reject loop. This page surfaces those aging invoices so Yosef can
          investigate in WAWF and resubmit <strong>before</strong> the 60-day payment cycle fully slips.
          {lastSync && <span className="block mt-1 text-[10px]">EDI data last synced: {formatDateTime(lastSync)}</span>}
        </p>
      </div>

      {/* Bucket stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {(Object.keys(BUCKET_RANGES) as Bucket[]).map((b) => {
          const r = BUCKET_RANGES[b];
          const s = stats.byBucket[b];
          const Icon =
            b === "probable_reject" ? AlertCircle :
            b === "stale" ? AlertTriangle :
            b === "aging" ? Clock :
            CheckCircle2;
          return (
            <button
              key={b}
              onClick={() => setBucket(b)}
              className={`rounded-lg border-2 p-3 text-left ${BUCKET_BG[b]} ${
                bucket === b ? "ring-2 ring-accent border-accent" : "border-transparent"
              }`}
            >
              <div className="flex items-center gap-1 text-xs font-medium">
                <Icon className="h-3 w-3" />
                {r.label}
                <span className="text-muted ml-auto text-[10px]">{r.days}</span>
              </div>
              <div className="text-2xl font-bold mt-1">{s.count.toLocaleString()}</div>
              <div className="text-[10px] text-muted">{fmt$(s.value)} @ risk</div>
            </button>
          );
        })}
      </div>

      {/* Top-of-page action callout */}
      {(stats.byBucket.stale.count > 0 || stats.byBucket.probable_reject.count > 0) && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 mb-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-700 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-red-900">
              {stats.byBucket.stale.count + stats.byBucket.probable_reject.count} invoices need attention today
            </div>
            <div className="text-xs text-red-800 mt-1">
              {fmt$(stats.actionableValue)} in receivables aging past 30 days. Check each one in WAWF:
              <ol className="list-decimal ml-5 mt-2 space-y-1">
                <li>Open the row → copy contract # / invoice #</li>
                <li>Log into WAWF (<a href="https://wawf.eb.mil" target="_blank" rel="noopener" className="underline">wawf.eb.mil</a>) → Document Inquiry</li>
                <li>If rejected, identify reason → fix source in LL → resubmit</li>
                <li>If accepted but unpaid, escalate to DFAS for payment inquiry</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setBucket("actionable")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            bucket === "actionable" ? "ring-2 ring-red-500 border-red-500 bg-red-50 text-red-800" : "border-red-300 text-red-700 hover:bg-red-50"
          }`}
        >
          Actionable ({stats.byBucket.stale.count + stats.byBucket.probable_reject.count})
        </button>
        <button
          onClick={() => setBucket("all")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
            bucket === "all" ? "ring-2 ring-accent border-accent" : "border-card-border"
          }`}
        >
          All ({rows.length})
        </button>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Contract, ship#, NSN, description..."
          className="ml-auto text-xs border border-card-border rounded-lg px-3 py-1.5 w-72"
        />
      </div>

      {/* Phase 2 — AX payment cross-reference */}
      {(unsettledDlaInvoices.length > 0 || recentDlaSettlements.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-amber-900">DLA hasn&apos;t paid yet</h3>
              <span className="text-xs text-amber-700">{unsettledDlaInvoices.length} invoices</span>
            </div>
            <p className="text-[11px] text-amber-800 mb-2">
              From AX CustTransactions where Settlement=No. These are real unpaid DLA invoices —
              far more reliable than age-based inference. Cross-reference any aging WAWF 810 with
              this list.
            </p>
            <div className="bg-white/70 rounded border border-amber-200 max-h-48 overflow-y-auto">
              <table className="w-full text-[10px]">
                <thead className="bg-amber-100 sticky top-0">
                  <tr><th className="px-2 py-1 text-left">Invoice</th><th className="px-2 py-1 text-left">Voucher</th><th className="px-2 py-1 text-left">Date</th></tr>
                </thead>
                <tbody>
                  {unsettledDlaInvoices.slice(0, 100).map((p, i) => (
                    <tr key={i} className="border-t border-amber-100">
                      <td className="px-2 py-1 font-mono">{p.marked_invoice}</td>
                      <td className="px-2 py-1 font-mono text-muted">{p.ax_voucher}</td>
                      <td className="px-2 py-1 text-muted">{formatDateShort(p.payment_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {axPaymentsSync && (
              <div className="text-[10px] text-amber-700 mt-2">
                AX last synced: {formatDateTime(axPaymentsSync.created_at)} · ${(axPaymentsSync.details?.settled_amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} settled in window
              </div>
            )}
          </div>

          <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-green-900">DLA paid — last 14 days</h3>
              <span className="text-xs text-green-700">
                ${recentDlaSettlements.reduce((s, p) => s + (p.payment_amount || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <p className="text-[11px] text-green-800 mb-2">
              From AX CustTransactions where Settlement=Yes. These invoices ARE paid; if any aging
              810 in the table below matches one of these by invoice number, it&apos;s resolved.
            </p>
            <div className="bg-white/70 rounded border border-green-200 max-h-48 overflow-y-auto">
              <table className="w-full text-[10px]">
                <thead className="bg-green-100 sticky top-0">
                  <tr><th className="px-2 py-1 text-left">Invoice</th><th className="px-2 py-1 text-right">$</th><th className="px-2 py-1 text-left">Paid</th></tr>
                </thead>
                <tbody>
                  {recentDlaSettlements.slice(0, 100).map((p, i) => (
                    <tr key={i} className="border-t border-green-100">
                      <td className="px-2 py-1 font-mono">{p.marked_invoice}</td>
                      <td className="px-2 py-1 text-right font-mono">${(p.payment_amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="px-2 py-1 text-muted">{formatDateShort(p.payment_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-3 py-2 font-medium text-right">Days</th>
                <th className="px-3 py-2 font-medium">Bucket</th>
                <th className="px-3 py-2 font-medium">Sent</th>
                <th className="px-3 py-2 font-medium">Ship #</th>
                <th className="px-3 py-2 font-medium">Contract</th>
                <th className="px-3 py-2 font-medium">NSN</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium text-right">Value</th>
                <th className="px-3 py-2 font-medium">By</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-12 text-center text-muted">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">
                      {bucket === "actionable" ? "Nothing actionable right now" : "No matches"}
                    </p>
                    <p className="text-xs mt-1">
                      {bucket === "actionable"
                        ? "All recent 810s are within the 30-day normal payment window."
                        : "Try a different filter or search."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 300).map((r) => (
                  <tr key={r.t.id} className="border-b border-card-border/50 hover:bg-gray-50">
                    <td className="px-3 py-2 text-right font-mono text-muted">{r.days}d</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${BUCKET_COLOR[r.bucket]}`}>
                        {BUCKET_RANGES[r.bucket].label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted text-[10px]">{formatDateShort(r.t.transmitted_at)}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{r.ship?.ship_number || "—"}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{r.ship?.contract_number || "—"}</td>
                    <td className="px-3 py-2 font-mono text-accent text-[10px]">
                      {r.ship?.nsn ? (
                        <Link href={`/lookup?nsn=${encodeURIComponent(r.ship.nsn)}`} className="hover:underline">
                          {r.ship.nsn}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 truncate max-w-[180px]">{r.ship?.description || "—"}</td>
                    <td className="px-3 py-2 text-right">{r.ship?.quantity ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">{fmt$(r.ship?.sell_value)}</td>
                    <td className="px-3 py-2 text-muted text-[10px]">{r.t.added_by || "—"}</td>
                    <td className="px-3 py-2 text-[10px]">
                      <a
                        href="https://wawf.eb.mil"
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-0.5 text-accent hover:underline"
                      >
                        WAWF <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-3 py-2 border-t border-card-border text-xs text-muted flex items-center gap-2">
            <FileText className="h-3 w-3" />
            <span>Showing {Math.min(filtered.length, 300)} of {filtered.length} 810 transmissions</span>
          </div>
        )}
      </div>
    </>
  );
}
