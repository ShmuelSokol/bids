"use client";

import { useEffect, useState } from "react";
import { formatDateShort } from "@/lib/dates";
import { Trophy, X, Clock } from "lucide-react";

type ItemSpec = {
  item_name: string | null;
  unit_price: number | null;
  unit_of_issue: string | null;
  cage_code: string | null;
  part_number: string | null;
} | null;

type Match = {
  match_type: string;
  confidence: string;
  matched_part_number: string | null;
  matched_description: string | null;
  matched_source: string | null;
};

type LinkedBid = {
  price: number | null;
  date: string | null;
  lead_days: number | null;
  sol_no: string | null;
};

type TimelineEvent = {
  date: string | null;
  kind: "our_win" | "competitor_win" | "our_bid";
  identifier: string;
  cage: string | null;
  price: number | null;
  qty: number | null;
  fob: string | null;
  lead_days: number | null;
  description: string | null;
  our_bid_for_this?: LinkedBid | null;
};

type AxSupplier = {
  vendor: string;
  vendor_part_number: string | null;
  vendor_description: string | null;
  ax_item: string | null;
  price: number | null;
  price_source: string | null;
  uom: string | null;
};

type AxReceipt = {
  vendor: string;
  purchase_price: number | null;
  quantity: number | null;
  uom: string | null;
  po_number: string | null;
  delivery_date: string | null;
  line_status: string | null;
};

type AxData = {
  item_number: string | null;
  description: string | null;
  waterfall_cost: { cost: number; source: string; vendor: string; uom: string } | null;
  suppliers: AxSupplier[];
  receipts: AxReceipt[];
};

type ApiResponse = {
  awards: any[];
  competitor_awards?: any[];
  bids: any[];
  timeline?: TimelineEvent[];
  itemSpec: ItemSpec;
  matches: Match[];
  ax?: AxData;
};

const cache = new Map<string, ApiResponse>();
const inflight = new Map<string, Promise<ApiResponse>>();

function fetchHistory(nsn: string): Promise<ApiResponse> {
  if (cache.has(nsn)) return Promise.resolve(cache.get(nsn)!);
  if (inflight.has(nsn)) return inflight.get(nsn)!;
  const p = (async (): Promise<ApiResponse> => {
    try {
      const res = await fetch(`/api/awards/search?nsn=${encodeURIComponent(nsn)}`);
      if (!res.ok) {
        const empty: ApiResponse = { awards: [], competitor_awards: [], bids: [], timeline: [], itemSpec: null, matches: [] };
        cache.set(nsn, empty);
        return empty;
      }
      const data: ApiResponse = await res.json();
      data.competitor_awards = data.competitor_awards || [];
      data.timeline = data.timeline || [];
      cache.set(nsn, data);
      return data;
    } catch {
      const empty: ApiResponse = { awards: [], competitor_awards: [], bids: [], timeline: [], itemSpec: null, matches: [] };
      cache.set(nsn, empty);
      return empty;
    } finally {
      inflight.delete(nsn);
    }
  })();
  inflight.set(nsn, p);
  return p;
}

/**
 * Unified per-NSN history. One row per event (our win, competitor win,
 * or our bid), sorted by date desc. Where we bid on the same NSN before
 * a competitor won, the competitor row shows our prior bid inline so
 * you can see "we bid $X, they got it for $Y".
 *
 * Used in /solicitations and /bids/today detail panels.
 */
export function NsnHistoryDetail({ nsn }: { nsn: string }) {
  const [data, setData] = useState<ApiResponse | null>(cache.get(nsn) || null);
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    if (cache.has(nsn)) {
      setData(cache.get(nsn)!);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchHistory(nsn).then((d) => {
      if (alive) {
        setData(d);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [nsn]);

  if (loading) {
    return <div className="text-center py-4 text-xs text-muted">Loading history for {nsn}...</div>;
  }
  if (!data) return null;

  const timeline = data.timeline || [];
  const wins = (data.awards || []).length;
  const losses = (data.competitor_awards || []).length;
  const totalBids = (data.bids || []).length;

  return (
    <div className="space-y-3">
      {data.itemSpec && (
        <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-muted">
          <span className="font-medium text-foreground">{data.itemSpec.item_name || "Item"}</span>
          {data.itemSpec.unit_of_issue && <span> · UoM {data.itemSpec.unit_of_issue}</span>}
          {data.itemSpec.part_number && (
            <span> · P/N <code className="text-[10px]">{data.itemSpec.part_number}</code></span>
          )}
          {data.itemSpec.cage_code && <span> · CAGE {data.itemSpec.cage_code}</span>}
          {data.itemSpec.unit_price != null && <span> · ref ${data.itemSpec.unit_price.toFixed(2)}</span>}
        </div>
      )}

      {/* AX Data — SKU, suppliers, receipts */}
      {data.ax && (data.ax.item_number || data.ax.suppliers.length > 0 || data.ax.receipts.length > 0) && (
        <div className="rounded border border-blue-200 bg-blue-50/30 overflow-hidden">
          <div className="px-3 py-1.5 bg-blue-100/50 text-xs font-bold text-blue-800 border-b border-blue-200">
            AX / D365 Data
            {data.ax.item_number && <span className="font-mono ml-2 font-normal">SKU: {data.ax.item_number}</span>}
            {data.ax.waterfall_cost && (
              <span className="ml-2 font-normal">
                · Best cost: <span className="font-mono font-medium">${data.ax.waterfall_cost.cost.toFixed(2)}</span>
                {" "}from {data.ax.waterfall_cost.vendor} ({data.ax.waterfall_cost.source})
              </span>
            )}
          </div>

          {data.ax.suppliers.length > 0 && (
            <div className="border-b border-blue-200">
              <div className="px-3 py-1 text-[10px] font-semibold text-blue-700">Suppliers ({data.ax.suppliers.length}) <span className="font-normal text-[8px] text-muted">AX VendorProductDescriptionsV2</span></div>
              <table className="w-full text-[11px]">
                <thead className="text-muted bg-blue-50/50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Vendor<div className="text-[8px] font-normal text-muted">AX VendorProductDescriptionsV2</div></th>
                    <th className="px-2 py-1 text-left font-medium">Vendor P/N<div className="text-[8px] font-normal text-muted">AX VendorProductDescriptionsV2</div></th>
                    <th className="px-2 py-1 text-left font-medium">Description<div className="text-[8px] font-normal text-muted">AX VendorProductDescriptionsV2</div></th>
                    <th className="px-2 py-1 text-right font-medium">Price<div className="text-[8px] font-normal text-muted">AX VendorProductDescriptionsV2</div></th>
                    <th className="px-2 py-1 text-left font-medium">UoM<div className="text-[8px] font-normal text-muted">AX VendorProductDescriptionsV2</div></th>
                    <th className="px-2 py-1 text-left font-medium">Source<div className="text-[8px] font-normal text-muted">AX VendorProductDescriptionsV2</div></th>
                  </tr>
                </thead>
                <tbody>
                  {data.ax.suppliers.map((s, i) => (
                    <tr key={i} className="border-t border-blue-100">
                      <td className="px-2 py-1 font-mono font-medium">{s.vendor}</td>
                      <td className="px-2 py-1 font-mono">{s.vendor_part_number || "—"}</td>
                      <td className="px-2 py-1 text-muted truncate max-w-[180px]">{s.vendor_description || "—"}</td>
                      <td className="px-2 py-1 text-right font-mono">{s.price ? `$${s.price.toFixed(2)}` : "—"}</td>
                      <td className="px-2 py-1">{s.uom || "—"}</td>
                      <td className="px-2 py-1 text-muted text-[9px]">{s.price_source || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.ax.receipts.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-semibold text-blue-700">Recent PO Receipts ({data.ax.receipts.length}) <span className="font-normal text-[8px] text-muted">AX PurchaseOrderLinesV2</span></div>
              <table className="w-full text-[11px]">
                <thead className="text-muted bg-blue-50/50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Vendor<div className="text-[8px] font-normal text-muted">AX PurchaseOrderLinesV2</div></th>
                    <th className="px-2 py-1 text-left font-medium">PO #<div className="text-[8px] font-normal text-muted">AX PurchaseOrderLinesV2</div></th>
                    <th className="px-2 py-1 text-right font-medium">Price<div className="text-[8px] font-normal text-muted">AX PurchaseOrderLinesV2</div></th>
                    <th className="px-2 py-1 text-right font-medium">Qty<div className="text-[8px] font-normal text-muted">AX PurchaseOrderLinesV2</div></th>
                    <th className="px-2 py-1 text-left font-medium">UoM<div className="text-[8px] font-normal text-muted">AX PurchaseOrderLinesV2</div></th>
                    <th className="px-2 py-1 text-left font-medium">Delivery<div className="text-[8px] font-normal text-muted">AX PurchaseOrderLinesV2</div></th>
                    <th className="px-2 py-1 text-left font-medium">Status<div className="text-[8px] font-normal text-muted">AX PurchaseOrderLinesV2</div></th>
                  </tr>
                </thead>
                <tbody>
                  {data.ax.receipts.map((r, i) => (
                    <tr key={i} className="border-t border-blue-100">
                      <td className="px-2 py-1 font-mono font-medium">{r.vendor}</td>
                      <td className="px-2 py-1 font-mono text-muted">{r.po_number || "—"}</td>
                      <td className="px-2 py-1 text-right font-mono">{r.purchase_price ? `$${r.purchase_price.toFixed(2)}` : "—"}</td>
                      <td className="px-2 py-1 text-right">{r.quantity || "—"}</td>
                      <td className="px-2 py-1">{r.uom || "—"}</td>
                      <td className="px-2 py-1 text-muted">{r.delivery_date && r.delivery_date !== "1900-01-01T12:00:00Z" ? formatDateShort(r.delivery_date) : "—"}</td>
                      <td className="px-2 py-1">
                        <span className={`text-[9px] px-1 rounded ${r.line_status === "Received" ? "bg-green-100 text-green-700" : r.line_status === "Invoiced" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{r.line_status || "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Stat strip — quick read on the win/loss/bid counts */}
      <div className="flex gap-2 text-xs">
        <span className="rounded px-2 py-1 bg-green-50 text-green-700 border border-green-200 inline-flex items-center gap-1">
          <Trophy className="h-3 w-3" /> {wins} won
        </span>
        <span className="rounded px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 inline-flex items-center gap-1">
          <X className="h-3 w-3" /> {losses} lost (competitor)
        </span>
        <span className="rounded px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
          <Clock className="h-3 w-3" /> {totalBids} bids on record
        </span>
      </div>

      {timeline.length === 0 ? (
        <p className="text-xs text-muted py-3">No history on record for this NSN yet.</p>
      ) : (
        <div className="rounded border border-card-border max-h-96 overflow-auto">
          <div className="px-2 py-1 text-[10px] text-muted bg-gray-50 border-b border-card-border">
            Sources — <span className="text-purple-700">LL</span> = LamLinks (our awards, our bids, competitor awards via k81/kc4); <span className="text-green-700">PUB</span> = PUB LOG
          </div>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="text-muted text-left">
                <th className="px-2 py-1 font-medium">Date<div className="text-[8px] font-normal text-muted">LL k81 + kc4 + k34</div></th>
                <th className="px-2 py-1 font-medium">Event<div className="text-[8px] font-normal text-muted">LL k81 + kc4 + k34</div></th>
                <th className="px-2 py-1 font-medium">Sol / Contract<div className="text-[8px] font-normal text-muted">LL k81 + kc4 + k34</div></th>
                <th className="px-2 py-1 font-medium">Winner<div className="text-[8px] font-normal text-muted">LL k81 + kc4 + k34</div></th>
                <th className="px-2 py-1 text-right font-medium">Price<div className="text-[8px] font-normal text-muted">LL k81 + kc4 + k34</div></th>
                <th className="px-2 py-1 text-right font-medium">Qty<div className="text-[8px] font-normal text-muted">LL k81 + kc4 + k34</div></th>
                <th className="px-2 py-1 text-right font-medium">Total<div className="text-[8px] font-normal text-muted">computed</div></th>
                <th className="px-2 py-1 font-medium">Our bid (vs winner)<div className="text-[8px] font-normal text-muted">LL k34/k35</div></th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((ev, i) => {
                const rawPrice = Number(ev?.price);
                const hasPrice = Number.isFinite(rawPrice) && rawPrice > 0;
                const qty = Number(ev?.qty) || 1;
                const total = hasPrice ? rawPrice * qty : 0;
                const linked = ev.our_bid_for_this;
                const linkedPrice = linked ? Number(linked.price) : NaN;
                const delta =
                  linked && Number.isFinite(linkedPrice) && hasPrice
                    ? (((linkedPrice - rawPrice) / rawPrice) * 100).toFixed(0)
                    : null;

                let bg = "";
                let badge = null;
                if (ev.kind === "our_win") {
                  bg = "bg-green-50/50";
                  badge = (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700 inline-flex items-center gap-0.5">
                      <Trophy className="h-2.5 w-2.5" /> We won
                    </span>
                  );
                } else if (ev.kind === "competitor_win") {
                  bg = "bg-orange-50/40";
                  badge = (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-orange-100 text-orange-700">
                      Comp won
                    </span>
                  );
                } else {
                  bg = "bg-blue-50/30";
                  badge = (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-700">
                      Our bid (no award yet)
                    </span>
                  );
                }

                return (
                  <tr key={i} className={`border-t border-card-border/40 ${bg}`}>
                    <td className="px-2 py-1 text-muted whitespace-nowrap">
                      {formatDateShort(ev.date)}
                    </td>
                    <td className="px-2 py-1">{badge}</td>
                    <td className="px-2 py-1 font-mono text-[10px] text-muted">
                      {ev.identifier?.trim() || "—"}
                    </td>
                    <td className="px-2 py-1 font-mono text-[10px]">
                      {ev.kind === "our_win" ? (
                        <span className="text-green-700">0AG09 (us)</span>
                      ) : ev.kind === "competitor_win" ? (
                        <span className="text-orange-700">{ev.cage?.trim() || "—"}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {hasPrice ? (
                        `$${rawPrice.toFixed(2)}`
                      ) : (
                        <span className="text-muted italic" title="LamLinks didn't capture a price for this award">
                          n/a
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">{ev.qty ?? "—"}</td>
                    <td className="px-2 py-1 text-right font-mono">
                      {hasPrice ? `$${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                    </td>
                    <td className="px-2 py-1 text-[10px]">
                      {linked && Number.isFinite(linkedPrice) ? (
                        <span className="text-muted">
                          We bid <span className="font-mono text-foreground">${linkedPrice.toFixed(2)}</span>
                          {delta !== null && (
                            <span
                              className={`ml-1 ${
                                Number(delta) > 0 ? "text-red-600" : "text-green-600"
                              }`}
                            >
                              ({Number(delta) > 0 ? "+" : ""}
                              {delta}%)
                            </span>
                          )}
                          {linked.date && (
                            <span className="text-muted/70"> on {formatDateShort(linked.date)}</span>
                          )}
                        </span>
                      ) : ev.kind === "our_bid" ? (
                        <span className="text-muted">
                          {ev.lead_days ? `${ev.lead_days}d lead` : ""}
                          {ev.fob ? ` · FOB ${ev.fob}` : ""}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data.matches.length > 0 && (
        <div>
          <div className="text-xs font-bold text-purple-700 mb-1">
            Part-number Matches ({data.matches.length})
          </div>
          <div className="rounded border border-card-border overflow-auto max-h-32">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted bg-gray-50">
                  <th className="text-left px-2 py-1">Match</th>
                  <th className="text-left px-2 py-1">P/N</th>
                  <th className="text-left px-2 py-1">Description</th>
                  <th className="text-left px-2 py-1">Source</th>
                </tr>
              </thead>
              <tbody>
                {data.matches.map((m, i) => (
                  <tr key={i} className="border-t border-card-border/30">
                    <td className="px-2 py-0.5">
                      <span
                        className={`text-[9px] px-1 rounded font-medium ${
                          m.confidence === "HIGH"
                            ? "bg-green-100 text-green-700"
                            : m.confidence === "MEDIUM"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {m.confidence}
                      </span>
                    </td>
                    <td className="px-2 py-0.5 font-mono text-[10px]">{m.matched_part_number || "—"}</td>
                    <td className="px-2 py-0.5 truncate max-w-[260px]">{m.matched_description || "—"}</td>
                    <td className="px-2 py-0.5 text-muted">{m.matched_source || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
