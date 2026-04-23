"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CheckCircle2, Circle, AlertCircle, XCircle, ArrowRight } from "lucide-react";
import { formatDateShort, formatDateTime } from "@/lib/dates";

interface Bid {
  bid_id: number;
  solicitation_number: string;
  nsn: string;
  bid_price: number;
  bid_qty: number;
  bid_time: string;
  lead_days: number | null;
  fob: string | null;
  bid_status: string;
}

interface Award {
  contract_number: string;
  solicitation_number: string;
  unit_price: number;
  quantity: number;
  award_date: string;
  cage: string;
}

interface Shipment {
  idnkaj: number | null;
  ship_number: string;
  contract_number: string;
  ship_status: string;
  ship_date: string;
  sell_value: number;
  quantity: number;
}

interface Transmission {
  parent_id: number;
  edi_type: string;
  lifecycle: string;
  status: string;
  transmitted_at: string;
}

type Props = {
  bids: Bid[];
  awardsBySol: Record<string, Award>;
  shipmentsByContract: Record<string, Shipment[]>;
  ediByKaj: Record<number, Transmission[]>;
};

type Stage = "bid" | "posted" | "awarded" | "lost" | "shipped" | "transmitted" | "complete";

function bidOutcome(bid: Bid, awardsBySol: Record<string, Award>): { stage: Stage; detail: string; isWin: boolean | null } {
  const award = awardsBySol[bid.solicitation_number];
  if (!award) {
    // No award yet
    if (bid.bid_status === "submitted" || bid.bid_status === "sent") {
      return { stage: "posted", detail: "posted, awaiting award", isWin: null };
    }
    return { stage: "bid", detail: "quoted", isWin: null };
  }
  const cage = (award.cage || "").trim();
  if (cage === "0AG09") {
    return {
      stage: "awarded",
      detail: `WON @ $${Number(award.unit_price).toFixed(2)} × ${award.quantity}`,
      isWin: true,
    };
  }
  return {
    stage: "lost",
    detail: `lost to ${cage} @ $${Number(award.unit_price).toFixed(2)}`,
    isWin: false,
  };
}

const STAGE_LABEL: Record<Stage, string> = {
  bid: "Quoted",
  posted: "Posted",
  awarded: "Won",
  lost: "Lost",
  shipped: "Shipped",
  transmitted: "Transmitted",
  complete: "Complete",
};
const STAGE_COLOR: Record<Stage, string> = {
  bid: "text-blue-700 bg-blue-50 border-blue-200",
  posted: "text-purple-700 bg-purple-50 border-purple-200",
  awarded: "text-green-700 bg-green-50 border-green-200",
  lost: "text-red-700 bg-red-50 border-red-200",
  shipped: "text-indigo-700 bg-indigo-50 border-indigo-200",
  transmitted: "text-sky-700 bg-sky-50 border-sky-200",
  complete: "text-emerald-700 bg-emerald-50 border-emerald-200",
};

export function BidLifecycleTable({ bids, awardsBySol, shipmentsByContract, ediByKaj }: Props) {
  const [filter, setFilter] = useState<"all" | "won" | "lost" | "pending" | "shipped">("all");

  const rows = useMemo(() => {
    return bids.map((b) => {
      const outcome = bidOutcome(b, awardsBySol);
      const award = awardsBySol[b.solicitation_number];
      const shipments = award?.contract_number ? shipmentsByContract[award.contract_number] || [] : [];
      const kaj = shipments[0]?.idnkaj;
      const edi = kaj != null ? ediByKaj[kaj] || [] : [];
      const w810 = edi.find((e) => e.edi_type === "810");
      const w856 = edi.find((e) => e.edi_type === "856");
      const shipped = shipments.some((s) =>
        ["Shipped", "Delivered"].some((k) => (s.ship_status || "").toLowerCase().includes(k.toLowerCase()))
      );

      // Compute final stage
      let stage: Stage = outcome.stage;
      if (outcome.isWin && w810?.lifecycle === "acknowledged") stage = "complete";
      else if (outcome.isWin && shipped && (w810 || w856)) stage = "transmitted";
      else if (outcome.isWin && shipped) stage = "shipped";

      return { bid: b, outcome, award, shipments, edi, w810, w856, shipped, stage };
    });
  }, [bids, awardsBySol, shipmentsByContract, ediByKaj]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "won") return rows.filter((r) => r.outcome.isWin === true);
    if (filter === "lost") return rows.filter((r) => r.outcome.isWin === false);
    if (filter === "pending") return rows.filter((r) => r.outcome.isWin == null);
    if (filter === "shipped") return rows.filter((r) => r.shipped);
    return rows;
  }, [rows, filter]);

  const stats = useMemo(() => {
    const won = rows.filter((r) => r.outcome.isWin === true).length;
    const lost = rows.filter((r) => r.outcome.isWin === false).length;
    const pending = rows.filter((r) => r.outcome.isWin == null).length;
    const shipped = rows.filter((r) => r.shipped).length;
    const winRate = won + lost === 0 ? 0 : Math.round((won / (won + lost)) * 100);
    return { won, lost, pending, shipped, winRate };
  }, [rows]);

  return (
    <>
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
        <span>/</span>
        <Link href="/bids/today" className="hover:text-accent">Bids</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Lifecycle</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Bid Lifecycle</h1>
        <p className="text-muted text-sm mt-1">
          Our bids over the last 30 days, joined through awards → shipments → WAWF transmissions. Cradle to grave for each quote.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="rounded-lg border border-card-border bg-card-bg p-3">
          <div className="text-2xl font-bold">{rows.length}</div>
          <div className="text-xs text-muted">Total bids (30d)</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="text-2xl font-bold text-green-700">{stats.won}</div>
          <div className="text-xs text-muted">Won</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="text-2xl font-bold text-red-700">{stats.lost}</div>
          <div className="text-xs text-muted">Lost</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-2xl font-bold text-amber-700">{stats.pending}</div>
          <div className="text-xs text-muted">Pending decision</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-2xl font-bold text-blue-700">{stats.winRate}%</div>
          <div className="text-xs text-muted">Win rate (decided)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(["all", "won", "lost", "pending", "shipped"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
              filter === f ? "ring-2 ring-accent border-accent" : "border-card-border"
            }`}
          >
            {f === "all"
              ? `All (${rows.length})`
              : f === "won"
              ? `Won (${stats.won})`
              : f === "lost"
              ? `Lost (${stats.lost})`
              : f === "pending"
              ? `Pending (${stats.pending})`
              : `Shipped (${stats.shipped})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-3 py-2 font-medium">Bid Date</th>
                <th className="px-3 py-2 font-medium">Sol #</th>
                <th className="px-3 py-2 font-medium">NSN</th>
                <th className="px-3 py-2 font-medium text-right">Our Price</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Award</th>
                <th className="px-3 py-2 font-medium">Shipment</th>
                <th className="px-3 py-2 font-medium">WAWF</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-muted">
                    No bids match this filter.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 300).map((r) => {
                  const Icon =
                    r.outcome.isWin === true ? CheckCircle2 :
                    r.outcome.isWin === false ? XCircle :
                    r.outcome.isWin == null ? Circle : AlertCircle;
                  return (
                    <tr key={r.bid.bid_id} className="border-b border-card-border/50 hover:bg-gray-50">
                      <td className="px-3 py-2 text-muted text-[10px]" title={formatDateTime(r.bid.bid_time)}>
                        {formatDateShort(r.bid.bid_time)}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px]">
                        <Link href={`/solicitations?search=${encodeURIComponent(r.bid.solicitation_number || "")}`} className="hover:text-accent">
                          {r.bid.solicitation_number}
                        </Link>
                      </td>
                      <td className="px-3 py-2 font-mono text-accent text-[10px]">
                        <Link href={`/lookup?nsn=${encodeURIComponent(r.bid.nsn || "")}`} className="hover:underline">
                          {r.bid.nsn}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        ${Number(r.bid.bid_price).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right">{r.bid.bid_qty}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${STAGE_COLOR[r.stage]}`}>
                          <Icon className="h-3 w-3" />
                          {STAGE_LABEL[r.stage]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[10px]">
                        {r.award ? (
                          <>
                            <span className={(r.award.cage || "").trim() === "0AG09" ? "text-green-700 font-bold" : "text-red-700"}>
                              {(r.award.cage || "").trim()}
                            </span>
                            <span className="text-muted ml-1">@ ${Number(r.award.unit_price).toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[10px]">
                        {r.shipments.length > 0 ? (
                          <>
                            <span className="font-mono">{r.shipments[0].ship_number}</span>
                            <span className="ml-1 text-muted">{r.shipments[0].ship_status}</span>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[10px]">
                        {r.w856 && <span className="mr-1 text-blue-700">856{r.w856.lifecycle === "acknowledged" ? "✓" : ""}</span>}
                        {r.w810 && <span className="text-purple-700">810{r.w810.lifecycle === "acknowledged" ? "✓" : ""}</span>}
                        {!r.w856 && !r.w810 && <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-3 py-2 border-t border-card-border text-xs text-muted">
            Showing {Math.min(filtered.length, 300)} of {filtered.length} bids
          </div>
        )}
      </div>
    </>
  );
}
