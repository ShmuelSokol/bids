import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data, error } = await sb
    .from("dibbs_solicitations")
    .select("*")
    .ilike("solicitation_number", "SPE2DS-26-T-021J")
    .maybeSingle();
  if (error) { console.error(error); process.exit(1); }
  if (!data) { console.log("no row"); return; }
  // Print UoM-relevant fields
  for (const k of Object.keys(data).sort()) {
    if (/uom|unit|qty|quantity|price|value/i.test(k)) {
      console.log(`${k}: ${JSON.stringify(data[k])}`);
    }
  }
  console.log("---");
  console.log("nsn:", data.nsn, "fsc:", data.fsc);
})();
