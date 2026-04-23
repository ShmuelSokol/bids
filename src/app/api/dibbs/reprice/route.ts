import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/dibbs/reprice
 *
 * Re-prices all sourceable solicitations by looking at the MOST RECENT award
 * for their NSN in `awards` (both our wins + competitor wins from kc4).
 *
 * Rules (confirmed with Abe 2026-04-23):
 *   1. Most recent was a COMPETITOR win (cage != 0AG09):
 *      suggested = competitor_price - $1  (undercut — we want to win back)
 *      Floor at max(cost * 1.10, $2) so we don't bid below any margin.
 *      price_source: "Competitor {CAGE} won at ${X} ({date}) — undercutting by $1"
 *
 *   2. Most recent was OUR win (cage = 0AG09):
 *      suggested = our_last_price  (hold — our price was accepted)
 *      If our margin was >5%, keep as-is; else cost*1.10 floor.
 *      price_source: "Our last win (${X}) — {margin}% margin on ${cost}"
 *
 *   3. No award history:
 *      suggested = cost * 1.30  (standard 30% markup fallback — matches
 *      Abe's empirical median from 2,591 bid→cost matches)
 *      price_source: "No history — cost + 30%"
 *
 * Also populates `last_award_winner` and `competitor_cage` on the
 * solicitation so the UI can surface who won and at what price.
 */
export async function POST() {
  const supabase = createServiceClient();
  const OUR_CAGE = "0AG09";
  const UNDERCUT_BY = 1.00;

  // Pass 1 — load every award, ordered newest first, capture the single
  // most recent per NSN with its winner + date + price + cage.
  type AwardMark = { price: number; cage: string; date: string; isOurs: boolean };
  const mostRecent = new Map<string, AwardMark>();
  const ourMostRecent = new Map<string, AwardMark>();
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from("awards")
      .select("fsc, niin, unit_price, cage, award_date")
      .order("award_date", { ascending: false })
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const a of data) {
      if (!a.fsc || !a.niin || !(a.unit_price > 0)) continue;
      const nsn = `${a.fsc}-${a.niin}`;
      const cage = String(a.cage || "").trim().toUpperCase();
      const isOurs = cage === OUR_CAGE;
      const mark: AwardMark = { price: Number(a.unit_price), cage, date: a.award_date, isOurs };
      if (!mostRecent.has(nsn)) mostRecent.set(nsn, mark);
      if (isOurs && !ourMostRecent.has(nsn)) ourMostRecent.set(nsn, mark);
    }
    if (data.length < 1000) break;
    page++;
  }

  // Load costs.
  const costs = new Map<string, number>();
  let costPage = 0;
  while (true) {
    const { data } = await supabase
      .from("nsn_costs")
      .select("nsn, cost")
      .range(costPage * 1000, (costPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const c of data) if (c.cost > 0) costs.set(c.nsn, c.cost);
    if (data.length < 1000) break;
    costPage++;
  }

  // Load sourceable solicitations — paginate so we don't silently cap.
  const sols: any[] = [];
  let sPage = 0;
  while (true) {
    const { data } = await supabase
      .from("dibbs_solicitations")
      .select("id, nsn, suggested_price, our_cost")
      .eq("is_sourceable", true)
      .range(sPage * 1000, (sPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    sols.push(...data);
    if (data.length < 1000) break;
    sPage++;
  }

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const fmtDate = (d: string | null) => d ? new Date(d).toISOString().slice(0, 10) : "?";

  let updated = 0;
  let skipped = 0;
  const strategies: Record<string, number> = {};

  for (const sol of sols) {
    const cost = costs.get(sol.nsn) || Number(sol.our_cost) || 0;
    const recent = mostRecent.get(sol.nsn);
    const ourRecent = ourMostRecent.get(sol.nsn);

    let newPrice: number;
    let priceSource: string;
    let marginPct: number;
    let strategy: string;
    let updateFields: Record<string, any> = {};

    // Competitor just won → undercut
    if (recent && !recent.isOurs) {
      strategy = "UNDERCUT_COMPETITOR";
      const floor = Math.max(cost * 1.10, 2);
      newPrice = Math.max(recent.price - UNDERCUT_BY, floor);
      newPrice = Math.round(newPrice * 100) / 100;
      marginPct = cost > 0 ? Math.round(((newPrice - cost) / newPrice) * 100) : 0;
      priceSource = `Competitor ${recent.cage} won at ${fmt(recent.price)} (${fmtDate(recent.date)}) — undercut by ${fmt(UNDERCUT_BY)}${newPrice === floor ? " (cost-floor applied)" : ""}`;
      updateFields.last_award_winner = recent.cage;
      updateFields.competitor_cage = recent.cage;
    }
    // Our last award → hold
    else if (ourRecent) {
      strategy = "HOLD_OUR_WIN";
      const winMargin = cost > 0 ? (ourRecent.price - cost) / ourRecent.price : 0;
      if (winMargin > 0.05) {
        newPrice = Math.round(ourRecent.price * 100) / 100;
        marginPct = Math.round(winMargin * 100);
        priceSource = `Our last win (${fmt(ourRecent.price)}, ${fmtDate(ourRecent.date)}) — ${marginPct}% margin on ${fmt(cost)} cost`;
      } else {
        newPrice = Math.round(cost * 1.10 * 100) / 100;
        marginPct = 10;
        priceSource = `Cost + 10% (our last win margin was thin)`;
      }
      updateFields.last_award_winner = OUR_CAGE;
    }
    // No history → standard markup
    else if (cost > 0) {
      strategy = "NO_HISTORY_MARKUP";
      newPrice = Math.round(cost * 1.30 * 100) / 100;
      marginPct = 23;
      priceSource = `No award history — cost + 30% (Abe's empirical median)`;
    }
    // No cost either — can't suggest
    else {
      skipped++;
      continue;
    }

    strategies[strategy] = (strategies[strategy] || 0) + 1;

    if (Math.abs((Number(sol.suggested_price) || 0) - newPrice) < 0.01 &&
        (sol as any).price_source === priceSource) {
      skipped++;
      continue;
    }

    updateFields.suggested_price = newPrice;
    updateFields.price_source = priceSource;
    updateFields.margin_pct = marginPct;

    await supabase
      .from("dibbs_solicitations")
      .update(updateFields)
      .eq("id", sol.id);
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
  });
}
