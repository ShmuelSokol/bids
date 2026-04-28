import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  // 1. Worker heartbeat
  const { data: hb } = await sb.from("system_settings").select("value").eq("key", "lamlinks_worker_last_heartbeat").maybeSingle();
  const hbAge = hb?.value ? Math.floor((Date.now() - new Date(hb.value).getTime()) / 1000) : null;
  console.log(`worker heartbeat: ${hb?.value} (${hbAge}s ago)`);

  // 2. Recent snapshots (last 10 min)
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: snaps } = await sb.from("ll_pipeline_snapshots").select("id, snapshot_time, stuck_staged_count, unshipped_count, snapshot_error").gte("snapshot_time", since).order("snapshot_time", { ascending: false });
  console.log(`snapshots in last 10 min: ${snaps?.length || 0}`);
  for (const s of snaps || []) {
    const age = Math.floor((Date.now() - new Date(s.snapshot_time).getTime()) / 1000);
    console.log(`  #${s.id} @ ${s.snapshot_time} (${age}s ago) stuck=${s.stuck_staged_count} unshipped=${s.unshipped_count} ${s.snapshot_error ? "ERR:" + s.snapshot_error : ""}`);
  }
})();
