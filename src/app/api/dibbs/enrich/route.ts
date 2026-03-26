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

  // Get unenriched solicitations
  const { data: solicitations } = await supabase
    .from("dibbs_solicitations")
    .select("id, nsn, nomenclature, quantity")
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

    await supabase
      .from("dibbs_solicitations")
      .update({
        is_sourceable: true,
        source,
        source_item: nsn,
        suggested_price: suggestedPrice,
        our_cost: cost,
        margin_pct: marginPct,
        cost_source: costSource,
        price_source: priceSource,
      })
      .eq("id", sol.id);

    sourceableCount++;
  }

  return NextResponse.json({
    success: true,
    total_checked: solicitations.length,
    sourceable: sourceableCount,
    with_cost_data: withCostCount,
    ax_nsns_loaded: axNsnSet.size,
    masterdb_nsns_loaded: mdbNsnSet.size,
    costs_loaded: costMap.size,
  });
}
