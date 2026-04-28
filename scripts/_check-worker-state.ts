import "./env";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
(async () => {
  const { data: hb } = await sb
    .from("system_settings")
    .select("*")
    .eq("key", "lamlinks_worker_last_heartbeat")
    .single();
  const ageMin = hb?.value ? Math.round((Date.now() - new Date(hb.value).getTime()) / 60000) : null;
  console.log("Last heartbeat:", hb?.value, `(${ageMin} min ago)`);
  console.log("Updated_at row:", hb?.updated_at);

  // Check the writeback queue for stuck rows
  const { data: queue } = await sb
    .from("lamlinks_writeback_queue")
    .select("id, state, enqueued_at, sol_no, bid_price")
    .in("state", ["pending", "running"])
    .order("enqueued_at", { ascending: false })
    .limit(10);
  console.log("\nPending/running queue rows:", queue?.length ?? 0);
  if (queue?.length) console.table(queue);

  // Latest pipeline snapshot
  const { data: snap } = await sb
    .from("ll_pipeline_snapshots")
    .select("created_at, staged_envelopes_count, unshipped_envelopes_count")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snap) {
    const snapAge = Math.round((Date.now() - new Date(snap.created_at).getTime()) / 60000);
    console.log(`\nLatest LL snapshot: ${snap.created_at} (${snapAge} min ago)`);
  }
})();
