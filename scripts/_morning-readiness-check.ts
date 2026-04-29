import "./env";
import sql from "mssql/msnodesqlv8";
import { createServiceClient } from "../src/lib/supabase-server";

(async () => {
  const sb = createServiceClient();
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  console.log("=== DIBS morning readiness check ===\n");

  // 1. Feature flags
  const { data: flags } = await sb
    .from("system_settings")
    .select("key, value")
    .in("key", ["lamlinks_writeback_enabled", "lamlinks_invoice_writeback_enabled", "lamlinks_fresh_envelope_enabled"]);
  console.log("[1] Feature flags:");
  for (const f of flags || []) console.log(`    ${f.key} = ${f.value}`);

  // 2. Bid queue depth (k33 staging count for today)
  const { data: bidQueue, count: bidPending } = await sb
    .from("dibbs_solicitations")
    .select("id", { count: "exact", head: true })
    .eq("bid_state", "submitted_pending_post");
  console.log(`\n[2] Bids awaiting post (Supabase bid_state=submitted_pending_post): ${bidPending ?? "?"}`);

  // 3. Invoice queue snapshot
  const { data: invQueue, error: invErr } = await sb
    .from("lamlinks_invoice_queue")
    .select("state, ax_invoice_number, error_message");
  console.log(`\n[3] Invoice queue (${invQueue?.length || 0} rows total):`);
  if (invErr) console.log(`    ERR: ${invErr.message}`);
  const counts: Record<string, number> = {};
  const errors: { num: string; msg: string }[] = [];
  for (const r of invQueue || []) {
    counts[r.state] = (counts[r.state] || 0) + 1;
    if (r.state === "error" && r.error_message) errors.push({ num: r.ax_invoice_number, msg: r.error_message });
  }
  for (const [k, v] of Object.entries(counts)) console.log(`    ${k}: ${v}`);
  if (errors.length) {
    console.log(`    ⚠  ${errors.length} error rows:`);
    for (const e of errors.slice(0, 5)) console.log(`        ${e.num}: ${e.msg.slice(0, 80)}`);
  }

  // 4. Worker heartbeat (key is lamlinks_worker_last_heartbeat — not daemon_*)
  const { data: hb } = await sb
    .from("system_settings")
    .select("key, value, updated_at")
    .or("key.like.%heartbeat%,key.like.%worker%,key.like.daemon%");
  console.log(`\n[4] Worker heartbeats:`);
  for (const h of hb || []) {
    const ts = h.value && /\d{4}-\d{2}-\d{2}T/.test(String(h.value)) ? new Date(String(h.value)).getTime() : (h.updated_at ? new Date(h.updated_at).getTime() : null);
    const age = ts ? Math.round((Date.now() - ts) / 1000) : null;
    const stale = age !== null && age > 300;
    console.log(`    ${h.key}: ${age ?? "?"}s ago${stale ? "  ⚠ STALE (>5min)" : ""}`);
  }

  // 5. Pending rescue actions (worker should be draining)
  const { data: rescue } = await sb
    .from("lamlinks_rescue_actions")
    .select("id, action, status, created_at, error_message")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(20);
  console.log(`\n[5] Pending rescue actions: ${rescue?.length || 0}`);
  for (const a of rescue || []) {
    const age = Math.round((Date.now() - new Date(a.created_at).getTime()) / 1000);
    console.log(`    [${a.status}] ${a.action} (${age}s ago)`);
  }

  // 6. LL k33 envelopes Abe has staged (the piggyback targets for tomorrow)
  const k33Q = await pool.request().query(`
    SELECT TOP 5 idnk33_k33, qotref_k33, upname_k33, uptime_k33, itmcnt_k33,
           LTRIM(RTRIM(o_stat_k33)) AS o_stat
    FROM k33_tab
    WHERE LTRIM(RTRIM(o_stat_k33)) = 'adding quotes'
      AND upname_k33 = 'ajoseph   '
    ORDER BY uptime_k33 DESC
  `);
  console.log(`\n[6] LL staged envelopes (ajoseph, o_stat='adding quotes'): ${k33Q.recordset.length}`);
  for (const e of k33Q.recordset) {
    console.log(`    k33=${e.idnk33_k33} qotref=${String(e.qotref_k33||'').trim()} lines=${e.itmcnt_k33} updated=${e.uptime_k33?.toISOString?.()}`);
  }

  // 7. Today's DD219 invoices in AX vs LL
  const today = new Date().toISOString().slice(0, 10);
  const { count: queuedToday } = await sb
    .from("lamlinks_invoice_queue")
    .select("id", { count: "exact", head: true })
    .gte("ax_invoice_date", today);
  console.log(`\n[7] Invoice queue rows for ${today}+: ${queuedToday ?? "?"}`);

  // 8. K07 counters (sanity check for tomorrow)
  const k07 = await pool.request().query(`
    SELECT LTRIM(RTRIM(ss_key_k07)) AS k, LTRIM(RTRIM(ss_val_k07)) AS v, uptime_k07
    FROM k07_tab WHERE ss_key_k07 IN ('CIN_NO','TRN_ID_CK5','SOL_FORM_PREFERENCES')
  `);
  console.log(`\n[8] LL k07 counters:`);
  for (const r of k07.recordset) console.log(`    ${r.k} = ${r.v} (last ${r.uptime_k07?.toISOString?.()})`);

  await pool.close();
  console.log(`\n=== Check complete ===`);
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
