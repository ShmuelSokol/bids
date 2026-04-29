import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/dibbs/reprice
 *
 * Re-prices all sourceable solicitations from Abe's empirical logic (2026-04-23).
 *
 * BASE STRATEGY (picks the starting number):
 *   1. Most recent award went to a COMPETITOR (cage != 0AG09):
 *      base = competitor_price - $1  ("undercut" — we want to win back)
 *      Floor at max(cost * 1.10, $2).
 *   2. Most recent was OUR win:
 *      base = our_last_price  ("hold" — accepted price)
 *      cost*1.10 floor if our-margin was thin.
 *   3. No award history:
 *      base = cost * 1.30  (Abe's empirical median).
 *
 * OVERLAY ADJUSTMENTS (stacked after the base):
 *
 *   A) QUANTITY-SCALE DOWN — applied to the UNDERCUT base only.
 *      When the current solicitation's qty is materially larger than the
 *      last award's qty, competitors typically drop their price further
 *      on the bigger bid ("last win was for 2 cases, current bid is for
 *      10 cases, competitor would probably lower price" — Abe,
 *      2026-04-23). Ratio thresholds:
 *         >= 5x  → additional -3%
 *         >= 3x  → additional -2%
 *         >= 1.5x → additional -1%
 *      Stacked under the same cost-floor.
 *
 *   B) RECENT-QUOTE CLUSTER — overrides the base when strong signal.
 *      If Abe has bid on this NSN 2+ times in the last 90 days and those
 *      bids cluster tight (stddev < 7% of median), use the median as the
 *      suggested price. Reason: his recent quoting pattern is often a
 *      better forward-looking signal than the last award, especially for
 *      items where pricing is stable and quantity/freight changed
 *      between awards. Abe, 2026-04-23: "my last quotes in last 3
 *      months for similar quantities were in the 69.00 range".
 *
 * Also populates `last_award_winner` and `competitor_cage` on the
 * solicitation so the UI can show outcome pills on already-bid rows.
 */
export async function POST() {
  const supabase = createServiceClient();
  const OUR_CAGE = "0AG09";
  const UNDERCUT_BY = 1.00;
  const QUOTE_WINDOW_DAYS = 90;
  const QUOTE_CLUSTER_TIGHTNESS = 0.07; // stddev <= 7% of median

  // Pass 1 — most recent award per NSN (winner + price + date + qty).
  type AwardMark = { price: number; cage: string; date: string; isOurs: boolean; qty: number };
  const mostRecent = new Map<string, AwardMark>();
  const ourMostRecent = new Map<string, AwardMark>();
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from("awards")
      .select("fsc, niin, unit_price, cage, award_date, quantity")
      .order("award_date", { ascending: false })
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const a of data) {
      if (!a.fsc || !a.niin || !(a.unit_price > 0)) continue;
      const nsn = `${a.fsc}-${a.niin}`;
      const cage = String(a.cage || "").trim().toUpperCase();
      const isOurs = cage === OUR_CAGE;
      const mark: AwardMark = {
        price: Number(a.unit_price),
        cage,
        date: a.award_date,
        isOurs,
        qty: Number(a.quantity) || 0,
      };
      if (!mostRecent.has(nsn)) mostRecent.set(nsn, mark);
      if (isOurs && !ourMostRecent.has(nsn)) ourMostRecent.set(nsn, mark);
    }
    if (data.length < 1000) break;
    page++;
  }

  // Pass 2 — recent abe_bids per NSN (last 90 days, for quote-cluster rule).
  const cutoffIso = new Date(Date.now() - QUOTE_WINDOW_DAYS * 86400000).toISOString();
  const recentBidsByNsn = new Map<string, number[]>();
  let bp = 0;
  while (true) {
    const { data } = await supabase
      .from("abe_bids")
      .select("nsn, bid_price, bid_date")
      .gte("bid_date", cutoffIso)
      .range(bp * 1000, (bp + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const b of data) {
      if (!b.nsn || !(b.bid_price > 0)) continue;
      if (!recentBidsByNsn.has(b.nsn)) recentBidsByNsn.set(b.nsn, []);
      recentBidsByNsn.get(b.nsn)!.push(Number(b.bid_price));
    }
    if (data.length < 1000) break;
    bp++;
  }

  // Costs (for floor calc) — also pull per-each + UoM so we can convert when
  // the sol is in EA but our cost is per-pack (B25 etc.).
  const costs = new Map<string, { cost: number; costPerEach: number; uom: string | null; packMult: number }>();
  let costPage = 0;
  while (true) {
    const { data } = await supabase
      .from("nsn_costs")
      .select("nsn, cost, cost_per_each, unit_of_measure, pack_multiplier")
      .range(costPage * 1000, (costPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const c of data) {
      if (c.cost > 0) costs.set(c.nsn, {
        cost: c.cost,
        costPerEach: c.cost_per_each ?? c.cost,
        uom: c.unit_of_measure || null,
        packMult: c.pack_multiplier ?? 1,
      });
    }
    if (data.length < 1000) break;
    costPage++;
  }

  // Sourceable sols — pull current quantity + sol_uom so we can apply qty-scale + UoM conversion.
  const sols: any[] = [];
  let sPage = 0;
  while (true) {
    const { data } = await supabase
      .from("dibbs_solicitations")
      .select("id, nsn, suggested_price, our_cost, quantity, price_source, sol_uom")
      .eq("is_sourceable", true)
      .range(sPage * 1000, (sPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    sols.push(...data);
    if (data.length < 1000) break;
    sPage++;
  }

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const fmtDate = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "?");

  function median(xs: number[]): number {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
  }
  function stddev(xs: number[]): number {
    if (xs.length === 0) return 0;
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
    return Math.sqrt(v);
  }

  let updated = 0;
  let skipped = 0;
  const strategies: Record<string, number> = {};

  for (const sol of sols) {
    const costInfo = costs.get(sol.nsn);
    // Convert to per-each when AX UoM is a pack (B25, B10, ...) and SOL is EA.
    // Otherwise the AX cost basis already matches the sol UoM.
    const solUom = (sol.sol_uom || "").trim().toUpperCase();
    const isAxBundle = costInfo && /^B\d+$/i.test(costInfo.uom || "") && (costInfo.packMult || 1) > 1;
    const useCostPerEach = !!isAxBundle && solUom === "EA";
    const cost = costInfo
      ? (useCostPerEach ? costInfo.costPerEach : costInfo.cost)
      : (Number(sol.our_cost) || 0);
    const recent = mostRecent.get(sol.nsn);
    const ourRecent = ourMostRecent.get(sol.nsn);
    const bids = recentBidsByNsn.get(sol.nsn) || [];
    const currentQty = Number(sol.quantity) || 0;

    let base: number;
    let baseSource: string;
    let strategy: string;
    let floor = Math.max(cost * 1.10, 2);

    // ────────────── BASE PICK ──────────────
    if (recent && !recent.isOurs) {
      // Competitor won last → undercut
      strategy = "UNDERCUT_COMPETITOR";
      base = Math.max(recent.price - UNDERCUT_BY, floor);
      baseSource = `Competitor ${recent.cage} won at ${fmt(recent.price)} (${fmtDate(recent.date)}) — undercut ${fmt(UNDERCUT_BY)}`;

      // Quantity scale-down — only when the current sol is meaningfully
      // bigger than the last award qty. Ratio bands match Abe's intuition
      // ("2 cases vs 10 cases → drop further").
      if (recent.qty > 0 && currentQty >= recent.qty * 1.5) {
        const ratio = currentQty / recent.qty;
        let extraPct = 0.01;
        if (ratio >= 5) extraPct = 0.03;
        else if (ratio >= 3) extraPct = 0.02;
        const scaled = Math.max(base * (1 - extraPct), floor);
        baseSource += ` + qty-scale ${-Math.round(extraPct * 100)}% (current ${currentQty} vs last ${recent.qty})`;
        base = scaled;
        strategy += "_QTY_SCALED";
      }
    } else if (ourRecent) {
      // We won last → hold
      strategy = "HOLD_OUR_WIN";
      const winMargin = cost > 0 ? (ourRecent.price - cost) / ourRecent.price : 0;
      if (winMargin > 0.05) {
        base = ourRecent.price;
        baseSource = `Our last win (${fmt(ourRecent.price)}, ${fmtDate(ourRecent.date)}) — ${Math.round(winMargin * 100)}% margin on ${fmt(cost)} cost`;
      } else {
        base = cost * 1.10;
        baseSource = `Cost + 10% (our last win margin was thin)`;
      }
    } else if (cost > 0) {
      strategy = "NO_HISTORY_MARKUP";
      base = cost * 1.30;
      baseSource = `No award history — cost + 30% (Abe's empirical median)`;
    } else {
      skipped++;
      continue;
    }

    // ────────────── OVERLAY: RECENT-QUOTE CLUSTER ──────────────
    // If Abe has quoted this NSN tightly multiple times in the last 90
    // days, that pattern is a stronger forward signal than the award
    // math. Only override when the cluster is lower than `base` (we
    // wouldn't raise from a conservative Abe-established price) — and
    // only when cluster is tight.
    let clusterNote = "";
    if (bids.length >= 2) {
      const med = median(bids);
      const sd = stddev(bids);
      const tight = med > 0 && sd / med <= QUOTE_CLUSTER_TIGHTNESS;
      if (tight && med < base) {
        clusterNote = ` · override to recent-quote median ${fmt(med)} (${bids.length} bids, σ=${((sd / med) * 100).toFixed(1)}%)`;
        base = Math.max(med, floor);
        strategy = "RECENT_QUOTE_CLUSTER";
      }
    }

    const newPrice = Math.round(base * 100) / 100;
    const marginPct = cost > 0 ? Math.round(((newPrice - cost) / newPrice) * 100) : 0;
    const priceSource = baseSource + clusterNote;

    strategies[strategy] = (strategies[strategy] || 0) + 1;

    // Skip no-op writes
    if (
      Math.abs((Number(sol.suggested_price) || 0) - newPrice) < 0.01 &&
      String(sol.price_source || "") === priceSource
    ) {
      skipped++;
      continue;
    }

    const updateFields: Record<string, any> = {
      suggested_price: newPrice,
      price_source: priceSource,
      margin_pct: marginPct,
      // Keep our_cost / bid_cost in sync with the per-each cost we used,
      // so PO generation + UI match what we suggested.
      our_cost: cost,
      bid_cost: cost,
    };
    if (useCostPerEach && costInfo) {
      updateFields.bid_cost_source = `${costInfo.uom}@$${costInfo.cost.toFixed(2)} → EA@$${cost.toFixed(4)} (÷${costInfo.packMult})`;
    }
    if (recent && !recent.isOurs) {
      updateFields.last_award_winner = recent.cage;
      updateFields.competitor_cage = recent.cage;
    } else if (ourRecent) {
      updateFields.last_award_winner = OUR_CAGE;
    }

    await supabase.from("dibbs_solicitations").update(updateFields).eq("id", sol.id);
    updated++;
  }

  return NextResponse.json({
    success: true,
    updated,
    skipped,
    strategies,
    awards_loaded: mostRecent.size,
    costs_loaded: costs.size,
    sourceable_checked: sols.length,
    nsns_with_recent_bids: recentBidsByNsn.size,
  });
}
