import "./env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await s
    .from("system_settings")
    .select("key, value, updated_at")
    .in("key", ["lamlinks_writeback_enabled", "lamlinks_worker_last_heartbeat"]);
  for (const r of data || []) console.log(`  ${r.key} = ${r.value}  (updated ${r.updated_at})`);
  const hb = data?.find((r: any) => r.key === "lamlinks_worker_last_heartbeat");
  if (hb) {
    const age = Math.round((Date.now() - new Date(hb.value).getTime()) / 1000);
    console.log(`\n  Heartbeat age: ${age}s ${age < 120 ? "(HEALTHY)" : "(STALE)"}`);
  } else {
    console.log("\n  No heartbeat row yet — worker may still be starting up");
  }
}
main().catch(console.error);
