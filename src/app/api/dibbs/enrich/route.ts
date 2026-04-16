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

export async function POST(req: Request) {
  const supabase = createServiceClient();

  // Optional injected MDB NSN set. The LamLinks import chain fetches
  // the MDB export ONCE at the top, then passes the array here so 30
  // chained enrich calls don't all re-fetch the same 681 rows. Shape:
  //   { mdbNsns: ["1234-12-123-4567", ...] }
  // If absent we fall through to the per-call fetch (for /api/dibbs/
  // scrape-now, manual Sync Data clicks, etc.).
  let injectedMdbNsns: string[] | null = null;
  try {
    const body = await req.json();
    if (body && Array.isArray(body.mdbNsns)) {
      injectedMdbNsns = body.mdbNsns;
    }
  } catch {
    // Empty body / non-JSON is fine — default to per-call fetch.
  }

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

  // Load NSN costs with vendor + item_number + UoM (also paginate).
  // These fields get stored on the solicitation so PO generation uses
  // the SAME vendor the bid was based on, not a re-queried waterfall.
  const costMap = new Map<string, { cost: number; source: string; vendor: string | null; itemNumber: string | null; uom: string | null }>();
  let costPage = 0;
  while (true) {
    const { data } = await supabase
      .from("nsn_costs")
      .select("nsn, cost, cost_source, vendor, item_number, unit_of_measure")
      .range(costPage * 1000, (costPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach((c) => {
      if (c.cost > 0) costMap.set(c.nsn, { cost: c.cost, source: c.cost_source, vendor: c.vendor || null, itemNumber: c.item_number || null, uom: c.unit_of_measure || null });
    });
    costPage++;
  }

  // Load award history for pricing — separate our wins from competitor wins.
  // pricingMap = most recent award per NSN (any winner, for general anchor)
  // competitorWinMap = most recent competitor win per NSN (cage != 0AG09)
  // ourWinMap = most recent OUR win per NSN (cage = 0AG09)
  const pricingMap = new Map<string, number>();
  const competitorWinMap = new Map<string, number>();
  const ourWinMap = new Map<string, number>();
  let awardPage = 0;
  while (true) {
    const { data: awards } = await supabase
      .from("awards")
      .select("fsc, niin, unit_price, cage")
      .order("award_date", { ascending: false })
      .range(awardPage * 1000, (awardPage + 1) * 1000 - 1);
    if (!awards || awards.length === 0) break;
    for (const a of awards) {
      if (!a.unit_price || a.unit_price <= 0) continue;
      const nsn = `${a.fsc}-${a.niin}`;
      if (!pricingMap.has(nsn)) pricingMap.set(nsn, a.unit_price);
      const cage = a.cage?.trim();
      if (cage === "0AG09") {
        if (!ourWinMap.has(nsn)) ourWinMap.set(nsn, a.unit_price);
      } else if (cage) {
        if (!competitorWinMap.has(nsn)) competitorWinMap.set(nsn, a.unit_price);
      }
    }
    if (awards.length < 1000) break;
    awardPage++;
  }

  // Load Master DB NSNs. Prefer the set injected by the LamLinks
  // import chain (one fetch serves all 30 chained calls); otherwise
  // fetch directly (manual Sync Data / one-off invocations).
  const mdbNsnSet = new Set<string>();
  const mdbErrors: string[] = [];
  if (injectedMdbNsns) {
    for (const n of injectedMdbNsns) if (n) mdbNsnSet.add(n);
  } else {
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

  // Load Abe's bids by exact solicitation number — check BOTH tables.
  // abe_bids = historical (updated by sync script, was one-time capped at 10K)
  // abe_bids_live = last 30 days from LamLinks (synced every 5 min)
  const bidsBySol = new Map<string, { price: number; date: string }>();
  for (const table of ["abe_bids", "abe_bids_live"] as const) {
    const dateCol = table === "abe_bids" ? "bid_date" : "bid_time";
    const priceCol = table === "abe_bids" ? "bid_price" : "bid_price";
    const solCol = "solicitation_number";
    let bidPage = 0;
    while (true) {
      const { data: bids } = await supabase
        .from(table)
        .select(`${solCol}, ${priceCol}, ${dateCol}`)
        .range(bidPage * 1000, (bidPage + 1) * 1000 - 1);
      if (!bids || bids.length === 0) break;
      bids.forEach((b: any) => {
        const sol = b[solCol];
        if (sol && !bidsBySol.has(sol)) {
          bidsBySol.set(sol, { price: b[priceCol], date: b[dateCol] });
        }
      });
      if (bids.length < 1000) break;
      bidPage++;
    }
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

    // Pricing logic — three tiers of history:
    //   1. Our own winning price (strongest signal)
    //   2. Competitor winning price (market price ceiling)
    //   3. Cost × bracket markup (blind bid)
    let suggestedPrice: number | null = null;
    let priceSource: string | null = null;
    const ourLastWin = ourWinMap.get(nsn);
    const compLastWin = competitorWinMap.get(nsn);
    const lastWinPrice = pricingMap.get(nsn); // any winner's last price

    const costLooksWrong =
      cost && cost > 0 && lastWinPrice && lastWinPrice > 0 &&
      (cost / lastWinPrice > 10 || cost / lastWinPrice < 0.1);

    if (ourLastWin && ourLastWin > 0 && cost && cost > 0 && !costLooksWrong) {
      // Tier 1: We won before — anchor to our winning price
      const winMargin = (ourLastWin - cost) / ourLastWin;
      if (winMargin > 0.05) {
        suggestedPrice = Math.round(ourLastWin * 100) / 100;
        priceSource = `Our last win ($${ourLastWin.toFixed(2)}) — ${Math.round(winMargin * 100)}% margin`;
      } else {
        const flooredAtCost = cost * 1.15;
        const anchoredAtLastWin = ourLastWin * 1.01;
        const safePrice = Math.max(flooredAtCost, anchoredAtLastWin);
        suggestedPrice = Math.round(safePrice * 100) / 100;
        priceSource = `Our last win $${ourLastWin.toFixed(2)} +1% or cost × 1.15 (thin-margin fallback)`;
      }
      withCostCount++;
    } else if (compLastWin && compLastWin > 0 && cost && cost > 0 && !costLooksWrong) {
      // Tier 2: Competitor won — anchor just below their price if profitable
      const compMargin = (compLastWin - cost) / compLastWin;
      if (compMargin > 0.08) {
        // Undercut competitor by 2% — we need to beat their price to win
        suggestedPrice = Math.round(compLastWin * 0.98 * 100) / 100;
        priceSource = `Competitor won at $${compLastWin.toFixed(2)}, undercut -2% (${Math.round(((suggestedPrice! - cost) / suggestedPrice!) * 100)}% margin)`;
      } else if (compMargin > 0) {
        // Tight margin vs competitor — bid at cost + 10% minimum
        suggestedPrice = Math.round(cost * 1.10 * 100) / 100;
        priceSource = `Competitor won at $${compLastWin.toFixed(2)}, margin tight → cost × 1.10`;
      } else {
        // Competitor won below our cost — can't compete on price, use markup
        const markup = interpolateMarkup(cost);
        suggestedPrice = Math.round(cost * markup * 100) / 100;
        priceSource = `Competitor won at $${compLastWin.toFixed(2)} (below our cost $${cost.toFixed(2)}) → ${markup.toFixed(3)}x markup`;
      }
      withCostCount++;
    } else if (costLooksWrong && lastWinPrice && lastWinPrice > 0) {
      suggestedPrice = Math.round(lastWinPrice * 1.02 * 100) / 100;
      priceSource = `Last award $${lastWinPrice.toFixed(2)} +2% (cost $${cost!.toFixed(2)} looked wrong)`;
      withCostCount++;
    } else if (cost && cost > 0) {
      // Tier 3: No win history at all — bracket markup
      const markup = interpolateMarkup(cost);
      suggestedPrice = Math.round(cost * markup * 100) / 100;
      // Cap at competitor win if available (e.g. loaded from pricingMap but no cage data)
      if (compLastWin && compLastWin > 0 && suggestedPrice > compLastWin * 0.98) {
        const capped = Math.round(compLastWin * 0.98 * 100) / 100;
        if (capped > cost * 1.05) {
          suggestedPrice = capped;
          priceSource = `Capped at competitor win $${compLastWin.toFixed(2)} -2% (markup would've been $${(cost * markup).toFixed(2)})`;
        } else {
          priceSource = `${costSource} × ${markup.toFixed(3)}x markup (competitor won below margin floor)`;
        }
      } else {
        priceSource = `${costSource} × ${markup.toFixed(3)}x markup (no win history)`;
      }
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
        bid_vendor: costData?.vendor || null,
        bid_item_number: costData?.itemNumber || null,
        bid_cost: cost,
        bid_cost_source: costSource,
        bid_uom: costData?.uom || null,
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
