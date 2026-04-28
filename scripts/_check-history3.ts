import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const nsn = "6665-12-193-2113";
  const [fsc, ...nParts] = nsn.split("-");
  const niin = nParts.join("-");

  const { data: awards, count: ac } = await sb
    .from("awards")
    .select("cage, unit_price, quantity, award_date, contract_number", { count: "exact" })
    .eq("fsc", fsc).eq("niin", niin)
    .order("award_date", { ascending: false }).limit(10);
  console.log(`awards: ${ac}`);
  for (const a of awards || []) console.log(`  ${(a.award_date||"").slice(0,10)}  CAGE=${a.cage}  qty=${a.quantity}  $${a.unit_price}`);

  const { data: abe, count: bc } = await sb
    .from("abe_bids").select("bid_date, bid_price, bid_qty, solicitation_number", { count: "exact" })
    .eq("nsn", nsn).order("bid_date", { ascending: false }).limit(10);
  console.log(`\nabe_bids: ${bc}`);
  for (const b of abe || []) console.log(`  ${(b.bid_date||"").slice(0,10)}  $${b.bid_price}  sol=${b.solicitation_number}`);

  const { data: live, count: lc } = await sb
    .from("abe_bids_live").select("bid_time, bid_price, solicitation_number", { count: "exact" })
    .eq("nsn", nsn).order("bid_time", { ascending: false }).limit(10);
  console.log(`\nabe_bids_live: ${lc}`);
  for (const b of live || []) console.log(`  ${(b.bid_time||"").slice(0,19)}  $${b.bid_price}  sol=${b.solicitation_number}`);

  const { data: usa, count: uc } = await sb
    .from("usaspending_awards").select("recipient_name, award_amount, action_date", { count: "exact" })
    .like("product_description", `%${niin}%`).limit(5);
  console.log(`\nusaspending: ${uc}`);
})();
