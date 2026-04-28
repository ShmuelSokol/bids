import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  const queued: any[] = [];
  for (let p = 0; p < 10; p++) {
    const { data } = await sb.from("nsn_research_status").select("nsn").eq("queue_status", "queued").range(p * 1000, (p + 1) * 1000 - 1);
    if (!data?.length) break;
    queued.push(...data);
    if (data.length < 1000) break;
  }
  const todayIso = new Date().toISOString().split("T")[0];
  const hasBidableSol = new Set<string>();
  const nsns = queued.map(q => q.nsn);
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
  const waste = queued.filter(q => !hasBidableSol.has(q.nsn)).map(q => q.nsn);
  console.log(`Purging ${waste.length} NSNs from queue (no bidable sol).`);

  for (let i = 0; i < waste.length; i += 500) {
    const chunk = waste.slice(i, i + 500);
    const { error } = await sb
      .from("nsn_research_status")
      .update({ queue_status: "idle", updated_at: new Date().toISOString() })
      .in("nsn", chunk)
      .eq("queue_status", "queued");  // guard against race
    if (error) { console.error(error.message); break; }
  }
  console.log(`Done — ${waste.length} reset to idle.`);
})();
