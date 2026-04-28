import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  // Fuzzy search sol
  const { data } = await sb
    .from("dibbs_solicitations")
    .select("nsn, nomenclature, quantity, solicitation_number, imported_at, return_by_date")
    .ilike("solicitation_number", "SPE7M1-26-T-004%");
  console.log("ilike SPE7M1-26-T-004%:", JSON.stringify(data, null, 2));
})();
