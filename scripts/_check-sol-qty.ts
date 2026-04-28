import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  for (const sol of ["SPE2DS-26-T-021R", "SPE2DS-26-T-021Q"]) {
    const { data } = await sb.from("dibbs_solicitations")
      .select("solicitation_number, quantity, ship_to_locations")
      .ilike("solicitation_number", sol)
      .maybeSingle();
    if (!data) { console.log(`${sol}: not in DIBS`); continue; }
    const ship = (data.ship_to_locations || []) as any[];
    const sum = ship.reduce((s,x) => s + (Number(x.qty)||0), 0);
    console.log(`${sol}: dibs.quantity=${data.quantity}, ship_to=${ship.length} CLINs, sum=${sum}`);
  }
})();
