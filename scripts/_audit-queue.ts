import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  // Queued NSNs
  const queued: any[] = [];
  for (let p = 0; p < 10; p++) {
    const { data } = await sb
      .from("nsn_research_status")
      .select("nsn, priority_score, queue_status")
      .eq("queue_status", "queued")
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data?.length) break;
    queued.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`Total queued: ${queued.length}`);
  if (!queued.length) return;

  const nsns = queued.map(q => q.nsn);

  // For each queued NSN, check: does it have any currently-open SPE* + not-bid sol?
  const hasBidableSol = new Set<string>();
  const todayIso = new Date().toISOString().split("T")[0];
  for (let i = 0; i < nsns.length; i += 500) {
    const chunk = nsns.slice(i, i + 500);
    const { data } = await sb
      .from("dibbs_solicitations")
      .select("nsn")
      .in("nsn", chunk)
      .ilike("solicitation_number", "SPE%")
      .eq("already_bid", false)
      .gte("return_by_date_iso", todayIso);
    for (const r of data || []) hasBidableSol.add(r.nsn);
  }

  const waste = queued.filter(q => !hasBidableSol.has(q.nsn));
  const keep  = queued.filter(q =>  hasBidableSol.has(q.nsn));
  console.log(`Queued w/ bidable SPE sol: ${keep.length}`);
  console.log(`Queued WITHOUT (waste):    ${waste.length}`);
  if (waste.length) {
    console.log(`\nSample waste (first 10):`);
    for (const w of waste.slice(0, 10)) console.log(`  ${w.nsn}  priority=${w.priority_score}`);
  }
})();
