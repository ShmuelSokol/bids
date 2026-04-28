import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data } = await sb
    .from("dibbs_solicitations")
    .select("nsn, nomenclature, quantity, fob, ship_to_locations, solicitation_number, data_source, lamlinks_estimated_value, potential_value")
    .eq("solicitation_number", "SPE2DH-26-T-3287");
  console.log(JSON.stringify(data, null, 2));
})();
