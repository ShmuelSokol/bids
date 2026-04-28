import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { count: awardsCount } = await sb.from("awards").select("*", { count: "exact", head: true });
  const { count: bidsCount } = await sb.from("abe_bids").select("*", { count: "exact", head: true });
  const { count: liveCount } = await sb.from("abe_bids_live").select("*", { count: "exact", head: true });
  const { data: minMax } = await sb.from("awards").select("award_date").order("award_date", { ascending: true }).limit(1);
  const { data: maxDate } = await sb.from("awards").select("award_date").order("award_date", { ascending: false }).limit(1);
  console.log(`awards:        ${awardsCount}  range: ${minMax?.[0]?.award_date} → ${maxDate?.[0]?.award_date}`);
  console.log(`abe_bids:      ${bidsCount}`);
  console.log(`abe_bids_live: ${liveCount}`);

  // Is FSC 6665 represented at all?
  const { count: c6665 } = await sb.from("awards").select("*", { count: "exact", head: true }).eq("fsc", "6665");
  console.log(`\nawards in FSC 6665: ${c6665}`);

  // Any NSN with FSC 6665 in abe_bids?
  const { count: ab6665 } = await sb.from("abe_bids").select("*", { count: "exact", head: true }).like("nsn", "6665-%");
  console.log(`abe_bids FSC 6665: ${ab6665}`);
})();
