import "./env";
import { createServiceClient } from "../src/lib/supabase-server";
(async () => {
  const sb = createServiceClient();

  // queue rows
  const { data: rows, error: e1 } = await sb.from("lamlinks_invoice_queue").select("*");
  console.log(`queue rows: ${rows?.length ?? "ERR"} err=${e1?.message || "-"}`);
  if (rows) {
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.state] = (counts[r.state] || 0) + 1;
    console.log("  states:", counts);
    for (const r of rows.filter((x: any) => x.state === "error")) console.log("  ERR:", r.ax_invoice_number, "→", r.error_message?.slice(0, 100));
  }

  // heartbeats — try different patterns
  const { data: hb1 } = await sb.from("system_settings").select("*").or("key.like.daemon%,key.like.%heartbeat%,key.like.worker%");
  console.log(`\nheartbeat-ish keys: ${hb1?.length ?? 0}`);
  for (const h of hb1 || []) console.log(`  ${h.key} = ${String(h.value).slice(0, 60)}`);

  // recent rescue actions (any status)
  const { data: rA } = await sb.from("lamlinks_rescue_actions").select("id, action, status, requested_by, created_at, completed_at, error_message").order("created_at", { ascending: false }).limit(10);
  console.log(`\nrecent rescue actions:`);
  for (const a of rA || []) console.log(`  [${a.status}] ${a.action} by ${a.requested_by} at ${a.created_at}`);
})().catch((e) => { console.error(e); process.exit(1); });
