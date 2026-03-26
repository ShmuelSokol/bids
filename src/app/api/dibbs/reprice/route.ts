import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/dibbs/reprice
 * Re-prices all sourceable solicitations using winning bid history.
 * Items we've won before get the last winning price instead of generic markup.
 */
export async function POST() {
  const supabase = createServiceClient();

  // Load all awards (our winning prices) — paginate
  const winPrices = new Map<string, number>();
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from("awards")
      .select("fsc, niin, unit_price")
      .order("award_date", { ascending: false })
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const a of data) {
      const nsn = `${a.fsc}-${a.niin}`;
      if (!winPrices.has(nsn) && a.unit_price > 0) winPrices.set(nsn, a.unit_price);
    }
    if (data.length < 1000) break;
    page++;
  }

  // Load costs
  const costs = new Map<string, number>();
  let costPage = 0;
  while (true) {
    const { data } = await supabase
      .from("nsn_costs")
      .select("nsn, cost")
      .range(costPage * 1000, (costPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const c of data) {
      if (c.cost > 0) costs.set(c.nsn, c.cost);
    }
    if (data.length < 1000) break;
    costPage++;
  }

  // Load sourceable solicitations that need repricing
  const { data: solicitations } = await supabase
    .from("dibbs_solicitations")
    .select("id, nsn, suggested_price, our_cost")
    .eq("is_sourceable", true)
    .limit(5000);

  let updated = 0;
  let skipped = 0;

  for (const sol of solicitations || []) {
    const winPrice = winPrices.get(sol.nsn);
    const cost = costs.get(sol.nsn) || sol.our_cost;

    if (!winPrice || !cost) { skipped++; continue; }

    const winMargin = (winPrice - cost) / winPrice;
    let newPrice: number;
    let priceSource: string;
    let marginPct: number;

    if (winMargin > 0.05) {
      newPrice = Math.round(winPrice * 100) / 100;
      marginPct = Math.round(winMargin * 100);
      priceSource = `Last winning bid ($${winPrice.toFixed(2)}) - ${marginPct}% margin on $${cost.toFixed(2)} cost`;
    } else {
      newPrice = Math.round(cost * 1.10 * 100) / 100;
      marginPct = 10;
      priceSource = `Cost + 10% (last win margin was thin)`;
    }

    // Only update if price actually changed
    if (Math.abs((sol.suggested_price || 0) - newPrice) < 0.01) { skipped++; continue; }

    await supabase
      .from("dibbs_solicitations")
      .update({ suggested_price: newPrice, price_source: priceSource, margin_pct: marginPct })
      .eq("id", sol.id);

    updated++;
  }

  return NextResponse.json({ success: true, updated, skipped, win_prices_loaded: winPrices.size, costs_loaded: costs.size });
}
