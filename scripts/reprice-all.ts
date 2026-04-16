/**
 * Reprice all sourceable solicitations locally — no Railway timeout.
 * Applies the full pricing pipeline: our wins → competitor wins → bracket markup.
 *
 *   npx tsx scripts/reprice-all.ts
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function interpolateMarkup(cost: number): number {
  const brackets: [number, number][] = [[0, 2.00], [25, 1.36], [100, 1.21], [500, 1.16]];
  for (let i = 0; i < brackets.length - 1; i++) {
    const [lo, loMul] = brackets[i];
    const [hi, hiMul] = brackets[i + 1];
    if (cost >= lo && cost < hi) {
      const band = 5;
      if (cost > hi - band) {
        const t = (cost - (hi - band)) / band;
        return loMul * (1 - t) + hiMul * t;
      }
      if (i > 0 && cost < lo + band) {
        const [, prevMul] = brackets[i - 1];
        const t = (cost - lo) / band;
        return prevMul * (1 - t) + loMul * t;
      }
      return loMul;
    }
  }
  return brackets[brackets.length - 1][1];
}

async function loadAll(table: string, select: string, filter?: (q: any) => any) {
  const all: any[] = [];
  for (let p = 0; p < 200; p++) {
    let q = sb.from(table).select(select).range(p * 1000, (p + 1) * 1000 - 1);
    if (filter) q = filter(q);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

async function main() {
  console.log("=== REPRICE ALL SOURCEABLE ===\n");

  // Load pricing data
  console.log("Loading costs...");
  const costs = await loadAll("nsn_costs", "nsn, cost, cost_source, vendor, item_number, unit_of_measure");
  const costMap = new Map(costs.map(c => [c.nsn, c]));
  console.log(`  ${costs.length} costs loaded`);

  console.log("Loading awards for win maps...");
  const awards = await loadAll("awards", "fsc, niin, unit_price, cage, award_date", q => q.order("award_date", { ascending: false }));
  const ourWinMap = new Map<string, number>();
  const compWinMap = new Map<string, number>();
  for (const a of awards) {
    if (!a.unit_price || a.unit_price <= 0) continue;
    const nsn = `${a.fsc}-${a.niin}`;
    const cage = a.cage?.trim();
    if (cage === "0AG09") { if (!ourWinMap.has(nsn)) ourWinMap.set(nsn, a.unit_price); }
    else if (cage) { if (!compWinMap.has(nsn)) compWinMap.set(nsn, a.unit_price); }
  }
  console.log(`  ${ourWinMap.size} our wins, ${compWinMap.size} competitor wins`);

  // Load bids for already_bid
  console.log("Loading bids...");
  const bids = await loadAll("abe_bids", "solicitation_number, bid_price, bid_date");
  const liveBids = await loadAll("abe_bids_live", "solicitation_number, bid_price, bid_time");
  const bidsBySol = new Map<string, { price: number; date: string }>();
  for (const b of bids) { if (b.solicitation_number && !bidsBySol.has(b.solicitation_number)) bidsBySol.set(b.solicitation_number, { price: b.bid_price, date: b.bid_date }); }
  for (const b of liveBids) { if (b.solicitation_number && !bidsBySol.has(b.solicitation_number)) bidsBySol.set(b.solicitation_number, { price: b.bid_price, date: b.bid_time }); }
  console.log(`  ${bidsBySol.size} bid dedup keys`);

  // Load sourceable solicitations
  console.log("Loading sourceable solicitations...");
  const sols = await loadAll("dibbs_solicitations", "id, nsn, solicitation_number, quantity, fsc", q => q.eq("is_sourceable", true));
  console.log(`  ${sols.length} to reprice\n`);

  let updated = 0, belowCost = 0, compAnchored = 0, bracketMarkup = 0;

  for (const sol of sols) {
    const nsn = sol.nsn;
    const costData = costMap.get(nsn);
    const cost = costData?.cost || null;
    const costSource = costData?.cost_source || null;
    const ourLastWin = ourWinMap.get(nsn);
    const compLastWin = compWinMap.get(nsn);

    let suggestedPrice: number | null = null;
    let priceSource: string | null = null;

    if (ourLastWin && ourLastWin > 0 && cost && cost > 0) {
      if (ourLastWin <= cost) {
        suggestedPrice = Math.round(cost * 1.15 * 100) / 100;
        priceSource = `Cost increased to $${cost.toFixed(2)} — last win $${ourLastWin.toFixed(2)} is now below cost, using cost × 1.15`;
        belowCost++;
      } else {
        const winMargin = (ourLastWin - cost) / ourLastWin;
        if (winMargin > 0.05) {
          suggestedPrice = Math.round(ourLastWin * 100) / 100;
          priceSource = `Our last win ($${ourLastWin.toFixed(2)}) — ${Math.round(winMargin * 100)}% margin on $${cost.toFixed(2)} cost`;
        } else {
          suggestedPrice = Math.round(Math.max(cost * 1.15, ourLastWin * 1.01) * 100) / 100;
          priceSource = `Our last win $${ourLastWin.toFixed(2)} +1% or cost × 1.15 (thin-margin)`;
        }
      }
    } else if (compLastWin && compLastWin > 0 && cost && cost > 0) {
      const compMargin = (compLastWin - cost) / compLastWin;
      if (compMargin > 0.08) {
        suggestedPrice = Math.round(compLastWin * 0.98 * 100) / 100;
        priceSource = `Competitor won at $${compLastWin.toFixed(2)}, undercut -2% (${Math.round(((suggestedPrice! - cost) / suggestedPrice!) * 100)}% margin)`;
      } else if (compMargin > 0) {
        suggestedPrice = Math.round(cost * 1.10 * 100) / 100;
        priceSource = `Competitor won at $${compLastWin.toFixed(2)}, margin tight → cost × 1.10`;
      } else {
        const markup = interpolateMarkup(cost);
        suggestedPrice = Math.round(cost * markup * 100) / 100;
        priceSource = `Competitor won at $${compLastWin.toFixed(2)} (below our cost $${cost.toFixed(2)}) → ${markup.toFixed(3)}x markup`;
      }
      compAnchored++;
    } else if (cost && cost > 0) {
      const markup = interpolateMarkup(cost);
      suggestedPrice = Math.round(cost * markup * 100) / 100;
      if (compLastWin && compLastWin > 0 && suggestedPrice > compLastWin * 0.98) {
        const capped = Math.round(compLastWin * 0.98 * 100) / 100;
        if (capped > cost * 1.05) { suggestedPrice = capped; priceSource = `Capped at competitor win $${compLastWin.toFixed(2)} -2%`; }
        else priceSource = `${costSource} × ${markup.toFixed(3)}x markup`;
      } else {
        priceSource = `${costSource} × ${markup.toFixed(3)}x markup`;
      }
      bracketMarkup++;
    }

    if (!suggestedPrice) continue;

    const marginPct = cost && cost > 0 ? Math.round(((suggestedPrice - cost) / suggestedPrice) * 100) : null;
    const recentBid = bidsBySol.get(sol.solicitation_number || "");

    const { error } = await sb.from("dibbs_solicitations").update({
      suggested_price: suggestedPrice,
      our_cost: cost,
      cost_source: costSource,
      price_source: priceSource,
      margin_pct: marginPct,
      already_bid: !!recentBid,
      last_bid_price: recentBid?.price || null,
      last_bid_date: recentBid?.date || null,
      bid_vendor: costData?.vendor || null,
      bid_item_number: costData?.item_number || null,
      bid_cost: cost,
      bid_cost_source: costSource,
      bid_uom: costData?.unit_of_measure || null,
    }).eq("id", sol.id);

    if (!error) updated++;
    if (updated % 500 === 0 && updated > 0) console.log(`  ...${updated} updated`);
  }

  console.log(`\nDone! ${updated} repriced`);
  console.log(`  Below-cost catches: ${belowCost}`);
  console.log(`  Competitor-anchored: ${compAnchored}`);
  console.log(`  Bracket markup: ${bracketMarkup}`);

  await sb.from("sync_log").insert({ action: "reprice_all", details: { updated, below_cost: belowCost, comp_anchored: compAnchored, bracket: bracketMarkup } });
}
main().catch(e => { console.error(e); process.exit(1); });
