import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data: sol } = await sb
    .from("dibbs_solicitations")
    .select("nsn, nomenclature, quantity, fsc, fob, solicitation_number, award_count, last_award_price, last_award_winner, last_bid_price, last_bid_date")
    .eq("solicitation_number", "SPE7M1-26-T-004E")
    .maybeSingle();
  console.log("SOL:", JSON.stringify(sol, null, 2));
  if (!sol?.nsn) return;
  const nsn = sol.nsn;
  const [fsc, ...niinParts] = nsn.split("-");
  const niin = niinParts.join("-");

  const { data: awards, count: awardCount } = await sb
    .from("awards")
    .select("cage, unit_price, quantity, award_date, contract_number", { count: "exact" })
    .eq("fsc", fsc)
    .eq("niin", niin)
    .order("award_date", { ascending: false })
    .limit(10);
  console.log(`\nawards table: ${awardCount} total for ${nsn}`);
  for (const a of awards || []) console.log(`  ${a.award_date?.slice(0,10)}  CAGE=${a.cage}  qty=${a.quantity}  $${a.unit_price}  contract=${a.contract_number}`);

  const { data: abeBids, count: abeCount } = await sb
    .from("abe_bids")
    .select("bid_date, bid_price, bid_qty, lead_days, solicitation_number", { count: "exact" })
    .eq("nsn", nsn)
    .order("bid_date", { ascending: false })
    .limit(10);
  console.log(`\nabe_bids: ${abeCount} total for ${nsn}`);
  for (const b of abeBids || []) console.log(`  ${(b.bid_date||"").slice(0,10)}  $${b.bid_price}  qty=${b.bid_qty}  days=${b.lead_days}  sol=${b.solicitation_number}`);

  const { data: abeLive, count: liveCount } = await sb
    .from("abe_bids_live")
    .select("bid_time, bid_price, bid_qty, lead_days, solicitation_number", { count: "exact" })
    .eq("nsn", nsn)
    .order("bid_time", { ascending: false })
    .limit(10);
  console.log(`\nabe_bids_live: ${liveCount} total for ${nsn}`);
  for (const b of abeLive || []) console.log(`  ${(b.bid_time||"").slice(0,19)}  $${b.bid_price}  qty=${b.bid_qty}  days=${b.lead_days}  sol=${b.solicitation_number}`);
})();
