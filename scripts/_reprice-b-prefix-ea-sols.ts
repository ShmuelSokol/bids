/**
 * Targeted reprice: find every sourceable sol where AX UoM is B<NN> AND
 * sol_uom is EA AND suggested_price reflects the buggy per-pack basis.
 * Apply per-each conversion and recompute suggested_price using the same
 * "Cost + 10%" path the reprice route uses for thin-margin items.
 *
 * Run AFTER scripts/backfill-sol-uom-from-ll.ts completes so sol_uom is
 * populated from LL.
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
import { parseUomMultiplier } from "../src/lib/uom";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  // Get all sourceable B-prefix-cost sols where DLA wants EA
  let page = 0;
  let scanned = 0, updated = 0, unchanged = 0;
  while (true) {
    const { data: sols } = await sb
      .from("dibbs_solicitations")
      .select("id, solicitation_number, nsn, quantity, sol_uom, bid_uom, our_cost, suggested_price")
      .eq("is_sourceable", true)
      .ilike("bid_uom", "B%")
      .eq("sol_uom", "EA")
      .range(page * 200, (page + 1) * 200 - 1);
    if (!sols || sols.length === 0) break;

    // Pull cost rows in one batch for these NSNs
    const nsns = sols.map(s => s.nsn);
    const { data: costs } = await sb
      .from("nsn_costs")
      .select("nsn, cost, cost_per_each, unit_of_measure, pack_multiplier, cost_source")
      .in("nsn", nsns);
    const costMap = new Map(costs?.map(c => [c.nsn, c]) || []);

    for (const sol of sols) {
      scanned++;
      const cost = costMap.get(sol.nsn);
      if (!cost) continue;
      const { mult } = parseUomMultiplier(cost.unit_of_measure);
      if (mult <= 1) continue; // not actually a B-prefix
      const effectiveCost = cost.cost_per_each ?? cost.cost / mult;
      // Apply +10% (thin-margin path)
      const newPrice = Math.round(effectiveCost * 1.10 * 100) / 100;
      // Skip if already correctly priced (within 1 cent)
      if (Math.abs((sol.suggested_price || 0) - newPrice) < 0.01) { unchanged++; continue; }
      const priceSource = `${cost.cost_source} ($${cost.cost.toFixed(2)}/${cost.unit_of_measure} → $${effectiveCost.toFixed(4)}/EA, ÷${mult}) × 1.10`;
      const marginPct = effectiveCost > 0 ? Math.round(((newPrice - effectiveCost) / newPrice) * 100) : null;
      const potentialValue = newPrice * (sol.quantity || 1);
      const { error } = await sb.from("dibbs_solicitations").update({
        suggested_price: newPrice,
        our_cost: effectiveCost,
        bid_cost: effectiveCost,
        bid_cost_source: priceSource,
        margin_pct: marginPct,
        potential_value: potentialValue,
        price_source: priceSource,
      }).eq("id", sol.id);
      if (error) { console.error(sol.solicitation_number, error.message); continue; }
      updated++;
    }

    if (sols.length < 200) break;
    page++;
    if (page % 5 === 0) console.log(`  scanned=${scanned} updated=${updated} unchanged=${unchanged}`);
  }
  console.log(`\n=== DONE === scanned=${scanned} updated=${updated} unchanged=${unchanged}`);
})().catch((e) => { console.error(e); process.exit(1); });
