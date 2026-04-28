import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  const todayIso = new Date().toISOString().split("T")[0];
  const targetNsn = "6625-01-426-2651";
  console.log("today:", todayIso);

  // mimic loadOpenByFlag(false)
  let foundInLoad = false;
  let totalLoaded = 0;
  for (let p = 0; p < 25; p++) {
    const { data, error } = await sb
      .from("dibbs_solicitations")
      .select("id, nsn, solicitation_number, return_by_date_iso, is_sourceable, quantity")
      .eq("is_sourceable", false)
      .gte("return_by_date_iso", todayIso)
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (error) { console.error(p, error.message); break; }
    if (!data || data.length === 0) break;
    totalLoaded += data.length;
    if (data.some((r: any) => r.nsn === targetNsn)) {
      foundInLoad = true;
      console.log(`✓ Found ${targetNsn} on page ${p}`);
    }
    if (data.length < 1000) break;
  }
  console.log(`Total non-sourceable open loaded: ${totalLoaded}`);
  console.log(`${targetNsn} present in load? ${foundInLoad}`);

  // Direct probe
  const { data } = await sb
    .from("dibbs_solicitations")
    .select("id, nsn, solicitation_number, return_by_date, return_by_date_iso, is_sourceable, already_bid, quantity, imported_at, file_reference")
    .eq("nsn", targetNsn);
  console.log("\nAll rows for NSN:");
  console.log(JSON.stringify(data, null, 2));
})();
