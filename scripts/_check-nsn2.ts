import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const todayIso = new Date().toISOString().split("T")[0];
  const target = "6240-01-262-5787";
  const { data } = await sb
    .from("dibbs_solicitations")
    .select("id, nsn, solicitation_number, return_by_date, return_by_date_iso, is_sourceable, already_bid, quantity, imported_at, file_reference, last_award_price")
    .eq("nsn", target);
  console.log(`All dibbs_solicitations rows for ${target}:`);
  console.log(JSON.stringify(data, null, 2));

  // Would it be loaded by server-side paginate? It's non-sourceable → loadOpenByFlag(false)
  const { data: pagedMatch } = await sb
    .from("dibbs_solicitations")
    .select("id")
    .eq("nsn", target)
    .eq("is_sourceable", false)
    .gte("return_by_date_iso", todayIso);
  console.log(`loadOpenByFlag(false) would include? ${pagedMatch && pagedMatch.length > 0}`);

  const { data: pagedMatch2 } = await sb
    .from("dibbs_solicitations")
    .select("id")
    .eq("nsn", target)
    .eq("is_sourceable", true)
    .gte("return_by_date_iso", todayIso);
  console.log(`loadOpenByFlag(true) would include?  ${pagedMatch2 && pagedMatch2.length > 0}`);
})();
