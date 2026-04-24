"use client";

import { useState, useMemo } from "react";
import { Truck, Package, MapPin, Clock, ChevronLeft, Search } from "lucide-react";
import Link from "next/link";
import { formatDateShort, formatDateTime } from "@/lib/dates";

interface Shipment {
  id: number;
  idnkaj: number | null;
  ship_number: string;
  ship_status: string;
  ship_date: string;
  transport_mode: string;
  tracking_number: string | null;
  weight_lbs: number;
  box_count: number;
  quantity: number;
  sell_value: number;
  job_status: string;
  clin: string;
  fob: string;
  required_delivery: string | null;
  contract_number: string;
  nsn: string | null;
  description: string;
  // WAWF/EDI status from ll_shipments_with_edi view
  wawf_810_status?: string;
  wawf_810_at?: string | null;
  wawf_856_status?: string;
  wawf_856_at?: string | null;
  edi_health?: "complete" | "problem" | "pending_ack" | "asn_ack_only" | "in_flight" | "not_started";
}

const EDI_HEALTH_LABEL: Record<string, string> = {
  complete: "✓ Acked",
  pending_ack: "810 Sent",
  asn_ack_only: "856 Ack",
  in_flight: "856 Sent",
  not_started: "Not Sent",
  problem: "Problem",
};
const EDI_HEALTH_COLOR: Record<string, string> = {
  complete: "bg-green-100 text-green-800 border-green-300",
  pending_ack: "bg-blue-100 text-blue-800 border-blue-300",
  asn_ack_only: "bg-sky-100 text-sky-800 border-sky-300",
  in_flight: "bg-amber-100 text-amber-800 border-amber-300",
  not_started: "bg-gray-100 text-gray-600 border-gray-200",
  problem: "bg-red-100 text-red-800 border-red-300",
};

function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

const statusColors: Record<string, string> = {
  Shipped: "bg-green-100 text-green-700",
  Packing: "bg-blue-100 text-blue-700",
  Shipping: "bg-purple-100 text-purple-700",
  Delivered: "bg-gray-100 text-gray-500",
};

function getStatusColor(status: string) {
  for (const [key, color] of Object.entries(statusColors)) {
    if (status.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "bg-gray-100 text-gray-600";
}

export function ShippingDashboard({
  shipments,
  lastSync,
  lastEdiSync,
  dpmsPending = 0,
  staleWawf = 0,
}: {
  shipments: Shipment[];
  lastSync: string | null;
  lastEdiSync?: string | null;
  dpmsPending?: number;
  staleWawf?: number;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let items = shipments;
    if (statusFilter !== "all") {
      items = items.filter((s) => s.ship_status?.toLowerCase().includes(statusFilter.toLowerCase()));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((s) =>
        s.contract_number?.toLowerCase().includes(q) ||
        s.nsn?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.ship_number?.toLowerCase().includes(q) ||
        s.tracking_number?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [shipments, statusFilter, searchQuery]);

  // Stats
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of shipments) {
      const st = s.ship_status?.trim() || "Unknown";
      counts[st] = (counts[st] || 0) + 1;
    }
    return counts;
  }, [shipments]);

  const totalValue = filtered.reduce((s, sh) => s + (sh.sell_value || 0), 0);
  const todayShipments = filtered.filter((s) => {
    const d = new Date(s.ship_date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });
  const fobDestCount = filtered.filter((s) => s.fob === "D").length;

  // Group by contract for consolidation
  const consolidation = useMemo(() => {
    const byContract = new Map<string, Shipment[]>();
    for (const s of filtered) {
      if (!byContract.has(s.contract_number)) byContract.set(s.contract_number, []);
      byContract.get(s.contract_number)!.push(s);
    }
    return Array.from(byContract.entries())
      .filter(([, items]) => items.length > 1)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);
  }, [filtered]);

  return (
    <>
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Shipping</span>
      </div>

      <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Shipping</h1>
          <p className="text-muted mt-1 text-sm">
            {shipments.length} shipments loaded from LamLinks
            {lastSync && <span className="ml-2 text-[10px]">Ship sync: {formatDateTime(lastSync)}</span>}
            {lastEdiSync && <span className="ml-2 text-[10px]">EDI sync: {formatDateTime(lastEdiSync)}</span>}
          </p>
        </div>
      </div>

      {/* EDI health callout */}
      {(dpmsPending > 0 || staleWawf > 0) && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {staleWawf > 0 && (
            <Link
              href="/ops/lamlinks/ack-tracker"
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 text-red-800 px-3 py-1.5 text-xs font-medium hover:bg-red-100"
            >
              ⚠ {staleWawf} WAWF 810 sent &gt;30 days, no ack
              <span className="text-[10px] opacity-70">→ Ack Tracker</span>
            </Link>
          )}
          {dpmsPending > 0 && (
            <Link
              href="/ops/lamlinks/transmissions"
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-3 py-1.5 text-xs font-medium hover:bg-amber-100"
            >
              ⏱ {dpmsPending.toLocaleString()} DPMS pending closeout
              <span className="text-[10px] opacity-70">→ Transmissions</span>
            </Link>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="rounded-lg border border-card-border bg-card-bg p-3">
          <div className="text-2xl font-bold">{shipments.length}</div>
          <div className="text-xs text-muted">Total Shipments</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-2xl font-bold text-blue-700">{todayShipments.length}</div>
          <div className="text-xs text-muted">Today</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="text-2xl font-bold text-green-700">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="text-xs text-muted">Total Value</div>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
          <div className="text-2xl font-bold text-purple-700">{fobDestCount}</div>
          <div className="text-xs text-muted">FOB Destination</div>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
          <div className="text-2xl font-bold text-orange-700">{consolidation.length}</div>
          <div className="text-xs text-muted">Multi-line Contracts</div>
        </div>
      </div>

      {/* Status filters + search */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <button onClick={() => setStatusFilter("all")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${statusFilter === "all" ? "ring-2 ring-accent border-accent" : "border-card-border"}`}>
          All ({shipments.length})
        </button>
        {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
          <button key={status} onClick={() => setStatusFilter(status)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${statusFilter === status ? "ring-2 ring-accent" : ""} ${getStatusColor(status)}`}>
            {status} ({count})
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 border border-card-border rounded-lg px-2 py-1">
          <Search className="h-3.5 w-3.5 text-muted" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contract, NSN, tracking..."
            className="text-xs border-0 outline-none bg-transparent w-48" />
        </div>
      </div>

      {/* Consolidation Opportunities */}
      {consolidation.length > 0 && statusFilter === "all" && !searchQuery && (
        <div className="rounded-xl border-2 border-green-300 bg-green-50/50 mb-4 p-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold text-green-800">Multi-Line Contracts (Consolidation)</span>
          </div>
          <div className="grid gap-2">
            {consolidation.map(([contract, items]) => (
              <div key={contract} className="flex items-center justify-between bg-white rounded-lg border border-green-200 px-3 py-2 text-xs">
                <div>
                  <span className="font-mono font-medium">{contract}</span>
                  <span className="text-muted ml-2">{items.length} CLINs</span>
                  <span className="text-muted ml-2">Wt: {items.reduce((s, i) => s + i.weight_lbs, 0).toFixed(1)} lbs</span>
                </div>
                <span className="font-mono text-green-700 font-medium">
                  ${items.reduce((s, i) => s + i.sell_value, 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipments Table */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-3 py-2 font-medium">Ship #<div className="text-[7px] font-normal text-muted">LL k81</div></th>
                <th className="px-3 py-2 font-medium">Contract<div className="text-[7px] font-normal text-muted">LL k81</div></th>
                <th className="px-3 py-2 font-medium">CLIN<div className="text-[7px] font-normal text-muted">LL k81</div></th>
                <th className="px-3 py-2 font-medium">NSN<div className="text-[7px] font-normal text-muted">LL k81</div></th>
                <th className="px-3 py-2 font-medium">Item<div className="text-[7px] font-normal text-muted">LL k81</div></th>
                <th className="px-3 py-2 font-medium text-right">Qty<div className="text-[7px] font-normal text-muted">LL k81</div></th>
                <th className="px-3 py-2 font-medium text-right">Value<div className="text-[7px] font-normal text-muted">LL k81</div></th>
                <th className="px-3 py-2 font-medium">FOB<div className="text-[7px] font-normal text-muted">LL k81</div></th>
                <th className="px-3 py-2 font-medium">Weight<div className="text-[7px] font-normal text-muted">LL k81</div></th>
                <th className="px-3 py-2 font-medium">Transport<div className="text-[7px] font-normal text-muted">LL k81</div></th>
                <th className="px-3 py-2 font-medium">Tracking<div className="text-[7px] font-normal text-muted">LL k81</div></th>
                <th className="px-3 py-2 font-medium">Ship Date<div className="text-[7px] font-normal text-muted">LL k81</div></th>
                <th className="px-3 py-2 font-medium">Status<div className="text-[7px] font-normal text-muted">LL k81</div></th>
                <th className="px-3 py-2 font-medium">WAWF<div className="text-[7px] font-normal text-muted">LL kbr</div></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-3 py-12 text-center text-muted">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No shipments found</p>
                    <p className="text-xs mt-1">Run <code className="bg-gray-100 px-1 rounded">npx tsx scripts/sync-shipping.ts</code> to sync from LamLinks</p>
                  </td>
                </tr>
              ) : filtered.map((s) => {
                const health = s.edi_health ?? "not_started";
                const healthLabel = EDI_HEALTH_LABEL[health] ?? "—";
                const healthColor = EDI_HEALTH_COLOR[health] ?? EDI_HEALTH_COLOR.not_started;
                const mostRecent = s.wawf_810_at || s.wawf_856_at;
                const daysSince = daysAgo(mostRecent);
                return (
                <tr key={s.id} className="border-b border-card-border/50 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono">{s.ship_number}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{s.contract_number}</td>
                  <td className="px-3 py-2">{s.clin}</td>
                  <td className="px-3 py-2 font-mono text-accent text-[10px]">{s.nsn || "—"}</td>
                  <td className="px-3 py-2 truncate max-w-[150px]">{s.description || "—"}</td>
                  <td className="px-3 py-2 text-right">{s.quantity}</td>
                  <td className="px-3 py-2 text-right font-mono text-green-600">${s.sell_value.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1 rounded text-[10px] font-medium ${s.fob === "D" ? "bg-orange-50 text-orange-700" : "bg-gray-50 text-gray-600"}`}>
                      {s.fob === "D" ? "Dest" : s.fob === "O" ? "Origin" : s.fob || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted">{s.weight_lbs} lbs</td>
                  <td className="px-3 py-2 text-muted text-[10px]">{s.transport_mode || "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{s.tracking_number || "—"}</td>
                  <td className="px-3 py-2 text-muted">{formatDateShort(s.ship_date)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${getStatusColor(s.ship_status)}`}>
                      {s.ship_status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${healthColor}`}
                      title={
                        `856: ${s.wawf_856_status ?? "—"}${s.wawf_856_at ? ` @ ${formatDateShort(s.wawf_856_at)}` : ""}\n` +
                        `810: ${s.wawf_810_status ?? "—"}${s.wawf_810_at ? ` @ ${formatDateShort(s.wawf_810_at)}` : ""}`
                      }
                    >
                      {healthLabel}
                      {daysSince !== null && health !== "not_started" && (
                        <span className="ml-1 opacity-70">· {daysSince}d</span>
                      )}
                    </span>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-3 py-2 border-t border-card-border text-xs text-muted">
            Showing {filtered.length} of {shipments.length} shipments
          </div>
        )}
      </div>
    </>
  );
}
