// Backfill: for any solicitation where ship_to_locations sums to a different
// qty than the stored quantity, update quantity to the correct sum. Targets
// the multi-CLIN gap fixed 2026-04-28 in import-lamlinks-solicitations.ts.
import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const PAGE = 1000;
  let from = 0;
  let fixed = 0;
  let scanned = 0;
  while (true) {
    const { data, error } = await sb
      .from("dibbs_solicitations")
      .select("id, solicitation_number, quantity, ship_to_locations")
      .range(from, from + PAGE - 1);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    for (const s of data) {
      scanned++;
      const ship = (s.ship_to_locations || []) as any[];
      if (ship.length < 2) continue;
      const sum = ship.reduce((acc, x) => acc + (Number(x.qty) || 0), 0);
      if (sum > 0 && sum !== s.quantity) {
        await sb.from("dibbs_solicitations").update({ quantity: sum }).eq("id", s.id);
        console.log(`fixed ${s.solicitation_number}: ${s.quantity} -> ${sum} (across ${ship.length} CLINs)`);
        fixed++;
      }
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`\nScanned ${scanned}, fixed ${fixed}`);
})();
