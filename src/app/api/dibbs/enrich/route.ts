import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/dibbs/enrich
 * Matches DIBBS solicitation NSNs against AX (Supabase nsn_catalog) then Master DB
 * to identify sourceable items, look up costs, and suggest prices.
 *
 * All data comes from Supabase — no local file reads. Works on Railway.
 */

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

  // Load award history for pricing (last award price per NSN)
  const { data: awards } = await supabase
    .from("awards")
    .select("fsc, niin, unit_price")
    .order("award_date", { ascending: false })
    .limit(5000);
  const pricingMap = new Map<string, number>();
  for (const a of awards || []) {
    const nsn = `${a.fsc}-${a.niin}`;
    if (!pricingMap.has(nsn)) pricingMap.set(nsn, a.unit_price);
  }

  // Load Master DB NSNs via API (optional — may timeout)
  const mdbNsnSet = new Set<string>();
  try {
    const KEY = process.env.MASTERDB_API_KEY;
    if (KEY) {
      const resp = await fetch(
        "https://masterdb.everreadygroup.com/api/dibs/items/export?has_nsn=1",
        { headers: { "X-Api-Key": KEY }, signal: AbortSignal.timeout(15000) }
      );
      if (resp.ok) {
        const text = await resp.text();
        for (const line of text.split("\n")) {
          try {
            const item = JSON.parse(line);
            if (item.nsn) mdbNsnSet.add(item.nsn);
          } catch {}
        }
      }
    }
  } catch {}

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

  // Load active LamLinks FSCs (hot + warm)
  const activeLLFscs = new Set<string>();
  const { data: heatmap } = await supabase
    .from("fsc_heatmap")
    .select("fsc_code")
    .in("bucket", ["hot", "warm"]);
  (heatmap || []).forEach((h) => activeLLFscs.add(h.fsc_code));

  // Load item weights from awards for shipping estimate
  const { data: weightData } = await supabase
    .from("awards")
    .select("fsc, niin, fob")
    .limit(5000);
  const fobByNsn = new Map<string, string>();
  for (const w of weightData || []) {
    const nsn = `${w.fsc}-${w.niin}`;
    if (w.fob && !fobByNsn.has(nsn)) fobByNsn.set(nsn, w.fob);
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

  // Get unenriched solicitations
  const { data: solicitations } = await supabase
    .from("dibbs_solicitations")
    .select("id, nsn, nomenclature, quantity, fsc, solicitation_number")
    .eq("is_sourceable", false);

  if (!solicitations || solicitations.length === 0) {
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

    // Pricing logic
    let suggestedPrice: number | null = null;
    let priceSource: string | null = null;

    if (cost && cost > 0) {
      let markup: number;
      if (cost < 25) markup = 1.64;
      else if (cost < 100) markup = 1.36;
      else if (cost < 500) markup = 1.21;
      else markup = 1.16;
      suggestedPrice = Math.round(cost * markup * 100) / 100;
      priceSource = `${costSource} × ${markup}x markup`;
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
  };

  // Log sync
  await supabase.from("sync_log").insert({
    action: "enrich",
    details: result,
  });

  return NextResponse.json(result);
}
