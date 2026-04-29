import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data } = await sb
    .from("dibbs_solicitations")
    .select("solicitation_number, nsn, bid_uom, sol_uom, our_cost, suggested_price, lamlinks_estimated_value, quantity, last_bid_price, price_source")
    .eq("is_sourceable", true)
    .ilike("bid_uom", "B%")
    .eq("sol_uom", "EA")
    .not("lamlinks_estimated_value", "is", null)
    .gt("quantity", 0)
    .limit(500);
  if (!data) { console.log("none"); return; }
  // LL est is the LINE total, so per-EA market signal = est/qty
  type Row = (typeof data)[number] & { perEaMarket: number; ratio: number };
  const rows = (data as Row[])
    .filter(r => r.suggested_price > 0 && r.lamlinks_estimated_value > 0 && r.quantity > 0)
    .map(r => {
      const perEaMarket = r.lamlinks_estimated_value! / r.quantity!;
      return { ...r, perEaMarket, ratio: r.suggested_price! / perEaMarket };
    });
  rows.sort((a, b) => a.ratio - b.ratio);

  console.log(`Sample of ${rows.length} B-prefix EA sols (sug vs LL-est-per-EA):\n`);
  console.log("--- Lowest 5 ratio (undercutting most) ---");
  for (const r of rows.slice(0, 5)) {
    console.log(`  ${r.solicitation_number}  sug=$${r.suggested_price}/EA  market(per-EA)=$${r.perEaMarket.toFixed(2)}  ratio=${r.ratio.toFixed(3)}  cost=$${r.our_cost?.toFixed(4)}  src="${(r.price_source||'').slice(0,60)}"`);
  }
  console.log("\n--- Median 5 ---");
  const mid = Math.floor(rows.length / 2);
  for (const r of rows.slice(mid - 2, mid + 3)) {
    console.log(`  ${r.solicitation_number}  sug=$${r.suggested_price}/EA  market=$${r.perEaMarket.toFixed(2)}  ratio=${r.ratio.toFixed(3)}  cost=$${r.our_cost?.toFixed(4)}  src="${(r.price_source||'').slice(0,60)}"`);
  }
  console.log("\n--- Highest 5 (over market — hold from prior win?) ---");
  for (const r of rows.slice(-5)) {
    console.log(`  ${r.solicitation_number}  sug=$${r.suggested_price}/EA  market=$${r.perEaMarket.toFixed(2)}  ratio=${r.ratio.toFixed(3)}  cost=$${r.our_cost?.toFixed(4)}  src="${(r.price_source||'').slice(0,60)}"`);
  }
  // Distribution: now ratio = sug / per-EA market (1.0 = at market)
  const buckets = { veryUnder: 0, under: 0, sane: 0, over: 0, veryOver: 0 };
  for (const r of rows) {
    if (r.ratio < 0.5) buckets.veryUnder++;
    else if (r.ratio < 0.85) buckets.under++;
    else if (r.ratio < 1.5) buckets.sane++;
    else if (r.ratio < 3) buckets.over++;
    else buckets.veryOver++;
  }
  console.log(`\n--- Distribution (suggest / LL-est-per-EA) ---`);
  console.log(`  <0.5   (50%+ under market):  ${buckets.veryUnder}`);
  console.log(`  0.5-0.85 (undercutting):     ${buckets.under}`);
  console.log(`  0.85-1.5 (at/near market):   ${buckets.sane}`);
  console.log(`  1.5-3   (somewhat over):     ${buckets.over}`);
  console.log(`  >3     (way over):           ${buckets.veryOver}`);
})();
