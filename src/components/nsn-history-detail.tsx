"use client";

import { useEffect, useState } from "react";
import { formatDateShort } from "@/lib/dates";

type Award = {
  unit_price: number | null;
  quantity: number | null;
  award_date: string | null;
  contract_number: string | null;
  cage: string | null;
};

type Bid = {
  bid_price: number | null;
  bid_qty: number | null;
  bid_date: string | null;
  lead_time_days: number | null;
  fob: string | null;
};

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

type ApiResponse = {
  awards: Award[];
  competitor_awards?: Award[];
  bids: Bid[];
  itemSpec: ItemSpec;
  matches: Match[];
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
        console.warn(`History fetch failed for ${nsn}: HTTP ${res.status}`);
        const empty: ApiResponse = { awards: [], competitor_awards: [], bids: [], itemSpec: null, matches: [] };
        cache.set(nsn, empty);
        return empty;
      }
      const data: ApiResponse = await res.json();
      data.competitor_awards = data.competitor_awards || [];
      cache.set(nsn, data);
      return data;
    } catch (err) {
      console.warn(`History fetch error for ${nsn}:`, err);
      const empty: ApiResponse = { awards: [], competitor_awards: [], bids: [], itemSpec: null, matches: [] };
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
 * Shared NSN history panel. Lazy-fetches `/api/awards/search?nsn=...`,
 * shows our awards + our bids side by side, plus any P/N matches.
 *
 * Used in both /solicitations (detail panel) and /bids/today (expand
 * a bid row to see what we know about that NSN).
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

  // Dedupe awards (same contract+date can appear twice)
  const seenAw = new Set<string>();
  const awards = data.awards.filter((a) => {
    const k = `${a.contract_number}_${a.award_date}`;
    if (seenAw.has(k)) return false;
    seenAw.add(k);
    return true;
  });
  const totalAwardValue = awards.reduce((s, a) => s + (a.unit_price || 0) * (a.quantity || 1), 0);
  const totalBidValue = data.bids.reduce((s, b) => s + (b.bid_price || 0) * (b.bid_qty || 1), 0);

  return (
    <div className="space-y-3">
      {data.itemSpec && (
        <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-muted">
          <span className="font-medium text-foreground">{data.itemSpec.item_name || "Item"}</span>
          {data.itemSpec.unit_of_issue && <span> · UoM {data.itemSpec.unit_of_issue}</span>}
          {data.itemSpec.part_number && <span> · P/N <code className="text-[10px]">{data.itemSpec.part_number}</code></span>}
          {data.itemSpec.cage_code && <span> · CAGE {data.itemSpec.cage_code}</span>}
          {data.itemSpec.unit_price != null && <span> · ref ${data.itemSpec.unit_price.toFixed(2)}</span>}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {/* Our Awards */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-green-700 mb-1">
            <span>Our Awards ({awards.length})</span>
            {totalAwardValue > 0 && (
              <span className="font-mono">${totalAwardValue.toLocaleString()}</span>
            )}
          </div>
          {awards.length === 0 ? (
            <p className="text-xs text-muted py-2">No awards on record for this NSN.</p>
          ) : (
            <div className="max-h-48 overflow-auto rounded border border-card-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted bg-gray-50">
                    <th className="text-left px-2 py-1">Date</th>
                    <th className="text-right px-2 py-1">Price</th>
                    <th className="text-right px-2 py-1">Qty</th>
                    <th className="text-right px-2 py-1">Total</th>
                    <th className="text-left px-2 py-1">Contract</th>
                  </tr>
                </thead>
                <tbody>
                  {awards.slice(0, 30).map((a, i) => (
                    <tr key={i} className="border-t border-card-border/30">
                      <td className="px-2 py-0.5 text-muted">{formatDateShort(a.award_date)}</td>
                      <td className="px-2 py-0.5 text-right font-mono text-green-700">${a.unit_price?.toFixed(2)}</td>
                      <td className="px-2 py-0.5 text-right">{a.quantity}</td>
                      <td className="px-2 py-0.5 text-right font-mono">
                        ${((a.unit_price || 0) * (a.quantity || 1)).toLocaleString()}
                      </td>
                      <td className="px-2 py-0.5 font-mono text-[9px] text-muted truncate max-w-[100px]">
                        {a.contract_number?.trim() || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Our Bids */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-blue-700 mb-1">
            <span>Our Bids ({data.bids.length})</span>
            {totalBidValue > 0 && (
              <span className="font-mono">${totalBidValue.toLocaleString()}</span>
            )}
          </div>
          {data.bids.length === 0 ? (
            <p className="text-xs text-muted py-2">No bids on record for this NSN.</p>
          ) : (
            <div className="max-h-48 overflow-auto rounded border border-card-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted bg-gray-50">
                    <th className="text-left px-2 py-1">Date</th>
                    <th className="text-right px-2 py-1">Price</th>
                    <th className="text-right px-2 py-1">Qty</th>
                    <th className="text-right px-2 py-1">Total</th>
                    <th className="text-right px-2 py-1">Lead</th>
                    <th className="text-left px-2 py-1">FOB</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bids.slice(0, 30).map((b, i) => (
                    <tr key={i} className="border-t border-card-border/30">
                      <td className="px-2 py-0.5 text-muted">{formatDateShort(b.bid_date)}</td>
                      <td className="px-2 py-0.5 text-right font-mono text-blue-700">${b.bid_price?.toFixed(2)}</td>
                      <td className="px-2 py-0.5 text-right">{b.bid_qty}</td>
                      <td className="px-2 py-0.5 text-right font-mono">
                        ${((b.bid_price || 0) * (b.bid_qty || 1)).toLocaleString()}
                      </td>
                      <td className="px-2 py-0.5 text-right text-muted">{b.lead_time_days}d</td>
                      <td className="px-2 py-0.5 text-muted">{b.fob || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Competitor awards (other CAGE codes who won this NSN) */}
      {(() => {
        const comps = data.competitor_awards || [];
        // dedupe by contract_number+date+cage
        const seen = new Set<string>();
        const dedupComps = comps.filter((a) => {
          const k = `${a.contract_number}_${a.award_date}_${a.cage}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        const compTotal = dedupComps.reduce(
          (s, a) => s + (a.unit_price || 0) * (a.quantity || 1),
          0
        );
        return (
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-orange-700 mb-1">
              <span>Competitor Awards ({dedupComps.length})</span>
              {compTotal > 0 && (
                <span className="font-mono">${compTotal.toLocaleString()}</span>
              )}
            </div>
            {dedupComps.length === 0 ? (
              <p className="text-xs text-muted py-2">
                No competitor awards on record. Run the DIBBS awards
                scrape for this NSN to populate (
                <code className="text-[10px]">/api/dibbs/awards</code>).
              </p>
            ) : (
              <div className="max-h-48 overflow-auto rounded border border-orange-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted bg-orange-50/40">
                      <th className="text-left px-2 py-1">Date</th>
                      <th className="text-left px-2 py-1">Winner CAGE</th>
                      <th className="text-right px-2 py-1">Price</th>
                      <th className="text-right px-2 py-1">Qty</th>
                      <th className="text-right px-2 py-1">Total</th>
                      <th className="text-left px-2 py-1">Contract</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dedupComps.slice(0, 30).map((a, i) => (
                      <tr key={i} className="border-t border-card-border/30">
                        <td className="px-2 py-0.5 text-muted">{formatDateShort(a.award_date)}</td>
                        <td className="px-2 py-0.5 font-mono text-[10px] text-orange-700">{a.cage?.trim()}</td>
                        <td className="px-2 py-0.5 text-right font-mono">${a.unit_price?.toFixed(2)}</td>
                        <td className="px-2 py-0.5 text-right">{a.quantity}</td>
                        <td className="px-2 py-0.5 text-right font-mono">
                          ${((a.unit_price || 0) * (a.quantity || 1)).toLocaleString()}
                        </td>
                        <td className="px-2 py-0.5 font-mono text-[9px] text-muted truncate max-w-[100px]">
                          {a.contract_number?.trim() || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

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
                          m.confidence === "HIGH" ? "bg-green-100 text-green-700" :
                          m.confidence === "MEDIUM" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-600"
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
