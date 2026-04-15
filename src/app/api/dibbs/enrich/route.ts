import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/dibbs/enrich
 * Matches DIBBS solicitation NSNs against AX (Supabase nsn_catalog) then Master DB
 * to identify sourceable items, look up costs, and suggest prices.
 *
 * All data comes from Supabase — no local file reads. Works on Railway.
 */

/**
 * Empirical bracket markup with boundary hysteresis.
 *
 * The brackets were originally fit against 2,591 historical wins. Recalibrated
 * 2026-04-14 against 466 of Abe's last 14 days of bids (where we had cost
 * data). Abe's empirical medians:
 *   <$25:    2.29x (was 1.64x — bumped to 2.00x, closer to truth but still
 *            conservative to avoid overpricing the tail)
 *   $25-100: 1.40x (model says 1.36x — keep, within 3%)
 *   $100-500: 1.19x (model says 1.21x — keep, within 2%)
 *   $500+:   1.18x (model says 1.16x — keep, within 2%)
 *
 * The <$25 bump is the big fix: cheap items need more margin to clear fixed
 * handling + shipping costs. At 1.64x a $10-cost item was suggested $16.40
 * but Abe bid $22.90 — ~140 bids/day were systematically too low.
 *
 * We linearly interpolate within a $BAND-wide window on each side of each
 * boundary so nearby costs produce nearby prices (avoids 17% jumps on 1¢
 * cost changes).
 */
function interpolateMarkup(cost: number): number {
  const brackets: [number, number][] = [
    [0, 2.00],    // recalibrated from 1.64 based on Abe's 14-day median of 2.29
    [25, 1.36],
    [100, 1.21],
    [500, 1.16],
  ];
  const BAND = 5; // smooth over ±$5 around each boundary

  // Find the bracket this cost is in
  for (let i = 0; i < brackets.length - 1; i++) {
    const [loCost, loMul] = brackets[i];
    const [hiCost, hiMul] = brackets[i + 1];
    if (cost < hiCost) {
      // If we're near the upper boundary, blend toward the next bracket
      const distToUpper = hiCost - cost;
      if (distToUpper < BAND) {
        const t = 1 - distToUpper / BAND; // 0 at boundary-BAND, 1 at boundary
        return loMul + (hiMul - loMul) * (t / 2); // halfway blend at boundary
      }
      // If we're near the lower boundary (not applicable at i=0)
      if (i > 0) {
        const distToLower = cost - loCost;
        if (distToLower < BAND) {
          const [, prevMul] = brackets[i - 1];
          const t = distToLower / BAND;
          return prevMul + (loMul - prevMul) * (0.5 + t / 2);
        }
      }
      return loMul;
    }
  }
  // Over the top bracket
  return brackets[brackets.length - 1][1];
}

export async function POST() {
  const supabase = createServiceClient();

  // Load NSN catalog (AX source — 24K NSNs, need to paginate past 1K default)
  const axNsnSet = new Set<string>();
  let catalogPage = 0;
  while (true) {
    const { data } = await supabase
      .from("nsn_catalog")
      .select("nsn")
      .range(catalogPage * 1000, (catalogPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach((c) => axNsnSet.add(c.nsn));
    catalogPage++;
  }

  // Load NSN costs (also paginate)
  const costMap = new Map<string, { cost: number; source: string }>();
  let costPage = 0;
  while (true) {
    const { data } = await supabase
      .from("nsn_costs")
      .select("nsn, cost, cost_source")
      .range(costPage * 1000, (costPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach((c) => {
      if (c.cost > 0) costMap.set(c.nsn, { cost: c.cost, source: c.cost_source });
    });
    costPage++;
  }

  // Load award history for pricing (last award price per NSN) — paginate
  const pricingMap = new Map<string, number>();
  let awardPage = 0;
  while (true) {
    const { data: awards } = await supabase
      .from("awards")
      .select("fsc, niin, unit_price")
      .order("award_date", { ascending: false })
      .range(awardPage * 1000, (awardPage + 1) * 1000 - 1);
    if (!awards || awards.length === 0) break;
    for (const a of awards) {
      const nsn = `${a.fsc}-${a.niin}`;
      if (!pricingMap.has(nsn)) pricingMap.set(nsn, a.unit_price);
    }
    if (awards.length < 1000) break;
    awardPage++;
  }

  // Load Master DB NSNs via API (optional — may timeout).
  // Track failures so they surface in the sync_log instead of silently
  // shrinking the sourceable set.
  const mdbNsnSet = new Set<string>();
  const mdbErrors: string[] = [];
  try {
    const KEY = process.env.MASTERDB_API_KEY;
    if (!KEY) {
      mdbErrors.push("MASTERDB_API_KEY not configured");
    } else {
      const resp = await fetch(
        "https://masterdb.everreadygroup.com/api/dibs/items/export?has_nsn=1",
        { headers: { "X-Api-Key": KEY }, signal: AbortSignal.timeout(30000) }
      );
      if (!resp.ok) {
        mdbErrors.push(`MDB fetch ${resp.status}`);
      } else {
        const text = await resp.text();
        for (const line of text.split("\n")) {
          try {
            const item = JSON.parse(line);
            if (item.nsn) mdbNsnSet.add(item.nsn);
          } catch {}
        }
      }
    }
  } catch (e: any) {
    mdbErrors.push(`MDB fetch failed: ${e?.message || "unknown"}`);
  }

  // Load NDC→NSN mappings for pharma items
  const ndcToNsn = new Map<string, string>();
  let ndcPage = 0;
  while (true) {
    const { data: ndcs } = await supabase
      .from("ndc_nsn_map")
      .select("ndc, nsn")
      .range(ndcPage * 1000, (ndcPage + 1) * 1000 - 1);
    if (!ndcs || ndcs.length === 0) break;
    ndcs.forEach((n) => ndcToNsn.set(n.ndc, n.nsn));
    ndcPage++;
  }

  // Load active LamLinks FSCs (hot + warm) — paginate (could exceed 1K eventually)
  const activeLLFscs = new Set<string>();
  let heatPage = 0;
  while (true) {
    const { data: heatmap } = await supabase
      .from("fsc_heatmap")
      .select("fsc_code")
      .in("bucket", ["hot", "warm"])
      .range(heatPage * 1000, (heatPage + 1) * 1000 - 1);
    if (!heatmap || heatmap.length === 0) break;
    heatmap.forEach((h) => activeLLFscs.add(h.fsc_code));
    if (heatmap.length < 1000) break;
    heatPage++;
  }

  // Load FOB data from awards — paginate
  const fobByNsn = new Map<string, string>();
  let fobPage = 0;
  while (true) {
    const { data: fobData } = await supabase
      .from("awards")
      .select("fsc, niin, fob")
      .range(fobPage * 1000, (fobPage + 1) * 1000 - 1);
    if (!fobData || fobData.length === 0) break;
    for (const w of fobData) {
      const nsn = `${w.fsc}-${w.niin}`;
      if (w.fob && !fobByNsn.has(nsn)) fobByNsn.set(nsn, w.fob);
    }
    if (fobData.length < 1000) break;
    fobPage++;
  }

  // Load Abe's bids by exact solicitation number
  const bidsBySol = new Map<string, { price: number; date: string }>();
  let bidPage = 0;
  while (true) {
    const { data: bids } = await supabase
      .from("abe_bids")
      .select("solicitation_number, bid_price, bid_date")
      .range(bidPage * 1000, (bidPage + 1) * 1000 - 1);
    if (!bids || bids.length === 0) break;
    bids.forEach((b) => {
      if (b.solicitation_number) {
        bidsBySol.set(b.solicitation_number, { price: b.bid_price, date: b.bid_date });
      }
    });
    bidPage++;
  }

  // Get unenriched solicitations. Cap the batch size to stay well under
  // Railway's ~30s request timeout. With 17K+ rows we'd hit a 502; this
  // way each call processes up to MAX_PAGES * 1000 rows and the caller
  // can chain calls until `remaining` hits 0.
  const MAX_PAGES = 2; // process up to 2,000 unsourced rows per call (Railway 30s budget)
  const solicitations: Array<{
    id: number;
    nsn: string;
    nomenclature: string;
    quantity: number;
    fsc: string;
    solicitation_number: string;
  }> = [];
  let solPage = 0;
  while (solPage < MAX_PAGES) {
    const { data: batch } = await supabase
      .from("dibbs_solicitations")
      .select("id, nsn, nomenclature, quantity, fsc, solicitation_number")
      .eq("is_sourceable", false)
      .range(solPage * 1000, (solPage + 1) * 1000 - 1);
    if (!batch || batch.length === 0) break;
    solicitations.push(...batch);
    if (batch.length < 1000) break;
    solPage++;
  }
  // Quick count of how many unsourced rows still exist after this batch
  // so the caller knows whether to call again.
  const { count: stillUnsourced } = await supabase
    .from("dibbs_solicitations")
    .select("id", { count: "exact", head: true })
    .eq("is_sourceable", false);
  const remainingAfterThisCall = Math.max(0, (stillUnsourced || 0) - solicitations.length);

  if (solicitations.length === 0) {
    return NextResponse.json({
      success: true,
      enriched: 0,
      message: "No new solicitations to enrich",
    });
  }

  let sourceableCount = 0;
  let withCostCount = 0;

  for (const sol of solicitations) {
    const nsn = sol.nsn;
    let source: string | null = null;

    // AX first (authoritative)
    if (axNsnSet.has(nsn)) {
      source = "ax";
    } else if (mdbNsnSet.has(nsn)) {
      source = "masterdb";
    }

    if (!source) continue;

    // Cost lookup
    const costData = costMap.get(nsn);
    const cost = costData?.cost || null;
    const costSource = costData?.source || null;
    const lastAward = pricingMap.get(nsn);

    // Pricing logic — winning history takes priority over generic markup
    let suggestedPrice: number | null = null;
    let priceSource: string | null = null;
    const lastWinPrice = pricingMap.get(nsn); // our last winning bid price

    // Suspicious-cost guardrail: if our cost data is wildly off vs the
    // last winning price, trust history over cost. Recalibration against
    // Abe's last 14 days showed a cluster of bids where cost was clearly
    // wrong (cost $210, Abe bid $6) — those broke the model. Ratio >10 or
    // <0.1 means one of the two numbers is lying; the winning-bid price
    // is usually the truth since it cleared the market.
    const costLooksWrong =
      cost && cost > 0 && lastWinPrice && lastWinPrice > 0 &&
      (cost / lastWinPrice > 10 || cost / lastWinPrice < 0.1);

    if (lastWinPrice && lastWinPrice > 0 && cost && cost > 0 && !costLooksWrong) {
      // We won before — use last winning price if it's profitable
      const winMargin = (lastWinPrice - cost) / lastWinPrice;
      if (winMargin > 0.05) {
        // Last win was profitable (>5% margin) — bid same or slightly adjusted
        suggestedPrice = Math.round(lastWinPrice * 100) / 100;
        priceSource = `Last winning bid ($${lastWinPrice.toFixed(2)}) — ${Math.round(winMargin * 100)}% margin on $${cost.toFixed(2)} cost`;
      } else {
        // Margin was thin — anchor to the winning price + a token bump,
        // and floor at cost × 1.15 so we always have SOME margin.
        // Previous version collapsed to cost × 1.10 which undershot by
        // a median of ~30% vs Abe's actual bids (he doesn't slash to
        // bare-minimum margin just because the last win was thin).
        const flooredAtCost = cost * 1.15;
        const anchoredAtLastWin = lastWinPrice * 1.01;
        const safePrice = Math.max(flooredAtCost, anchoredAtLastWin);
        suggestedPrice = Math.round(safePrice * 100) / 100;
        priceSource = `Last win $${lastWinPrice.toFixed(2)} +1% or cost × 1.15 (thin-margin fallback)`;
      }
      withCostCount++;
    } else if (costLooksWrong && lastWinPrice && lastWinPrice > 0) {
      // Cost data looks wrong — trust history. Price off last winning
      // bid + 2% increment (same pattern as the no-cost branch below).
      suggestedPrice = Math.round(lastWinPrice * 1.02 * 100) / 100;
      priceSource = `Last winning bid $${lastWinPrice.toFixed(2)} +2% (cost $${cost!.toFixed(2)} looked wrong, ignored)`;
      withCostCount++;
    } else if (cost && cost > 0) {
      // No winning history — use bracket markup with linear interpolation
      // between adjacent brackets instead of a hard step.
      //
      // Empirical brackets (fit against 2,591 historical wins):
      //   cost $0-25   → 1.64x
      //   cost $25-100 → 1.36x
      //   cost $100-500 → 1.21x
      //   cost $500+   → 1.16x
      //
      // A hard step produces ugly jumps: cost $24.99 → 1.64x = $40.98
      // vs cost $25.01 → 1.36x = $34.01 (a 17% suggested-price drop
      // from a 1¢ cost change). That's a real bug we hit in production.
      // Interpolate within a $5 band on each side of the boundary so
      // nearby costs produce nearby suggested prices.
      const markup = interpolateMarkup(cost);
      suggestedPrice = Math.round(cost * markup * 100) / 100;
      priceSource = `${costSource} × ${markup.toFixed(3)}x markup (no win history)`;
      withCostCount++;
    } else if (lastAward) {
      let increment: number;
      if (lastAward < 25) increment = 1.03;
      else if (lastAward < 100) increment = 1.02;
      else if (lastAward < 500) increment = 1.015;
      else increment = 1.01;
      suggestedPrice = Math.round(lastAward * increment * 100) / 100;
      priceSource = `Last award $${lastAward.toFixed(2)} + ${((increment - 1) * 100).toFixed(1)}%`;
    }

    const marginPct =
      suggestedPrice && cost && cost > 0
        ? Math.round(((suggestedPrice - cost) / suggestedPrice) * 100)
        : null;

    // Channel: lamlinks if FSC is active in LL, dibbs_only if not
    const fsc = sol.fsc || nsn.slice(0, 4);
    const channel = activeLLFscs.has(fsc) ? "lamlinks" : "dibbs_only";

    // FOB from award history
    const fob = fobByNsn.get(nsn) || null;

    // Estimated shipping (FOB Dest = we pay, rough estimate based on price bracket)
    // Average shipping: <$25=~$5, $25-100=~$8, $100-500=~$12, $500+=~$20
    let estShipping: number | null = null;
    if (fob === "D" && suggestedPrice) {
      if (suggestedPrice < 25) estShipping = 5;
      else if (suggestedPrice < 100) estShipping = 8;
      else if (suggestedPrice < 500) estShipping = 12;
      else estShipping = 20;
    }

    // Adjusted margin (subtract shipping from profit)
    const adjMarginPct =
      suggestedPrice && cost && cost > 0 && estShipping !== null
        ? Math.round(((suggestedPrice - cost - estShipping) / suggestedPrice) * 100)
        : marginPct;

    const potentialValue = suggestedPrice ? suggestedPrice * (sol.quantity || 1) : null;

    // Check if Abe already bid on this exact solicitation via LamLinks
    const recentBid = bidsBySol.get(sol.solicitation_number || "");

    await supabase
      .from("dibbs_solicitations")
      .update({
        is_sourceable: true,
        source,
        source_item: nsn,
        suggested_price: suggestedPrice,
        our_cost: cost,
        margin_pct: adjMarginPct,
        cost_source: costSource,
        price_source: priceSource,
        channel,
        fob,
        est_shipping: estShipping,
        potential_value: potentialValue,
        already_bid: !!recentBid,
        last_bid_price: recentBid?.price || null,
        last_bid_date: recentBid?.date || null,
      })
      .eq("id", sol.id);

    sourceableCount++;
  }

  const alreadyBidCount = solicitations.filter(
    (s) => bidsBySol.has(s.solicitation_number || "")
  ).length;

  const result = {
    success: true,
    total_checked: solicitations.length,
    sourceable: sourceableCount,
    with_cost_data: withCostCount,
    already_bid: alreadyBidCount,
    ax_nsns_loaded: axNsnSet.size,
    masterdb_nsns_loaded: mdbNsnSet.size,
    costs_loaded: costMap.size,
    remaining_unsourced: remainingAfterThisCall,
    warnings: mdbErrors,
  };

  // Log sync
  await supabase.from("sync_log").insert({
    action: "enrich",
    details: result,
  });

  return NextResponse.json(result);
}
