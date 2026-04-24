/**
 * Snapshot LL-side pipeline health into Supabase for /ops/dibs-pipeline.
 * Runs on NYEVRVSQL001 (the only box with msnodesqlv8). Called by the
 * dibs-recurring-daemon every 5 min.
 *
 * Emits one row into ll_pipeline_snapshots per run with:
 * - stuck_staged: ajoseph envelopes at o_stat='adding quotes' older than 5 min
 *   (should be near-zero after the 2026-04-24 envelope-finalization patch)
 * - unshipped: envelopes at o_stat='quotes added' + t_stat='not sent' older
 *   than 10 min (LL transmit daemon stuck, or envelope needs Abe's Post)
 * - recent_envelopes: last 24h ajoseph envelopes for the activity feed
 *
 * Phase 2: award-link orphans (k81_tab awards with no matching k34). Requires
 * mapping k81 → contract → sol_no → k10 → k11 → k34 which is multi-table
 * and not yet modelled.
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const startedAt = new Date().toISOString();

  let pool: sql.ConnectionPool | null = null;
  try {
    pool = await sql.connect({
      connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
    });

    // 1. Stuck staged — ajoseph at 'adding quotes' older than 5 min
    const stuck = await pool.request().query(`
      SELECT TOP 20
        idnk33_k33, qotref_k33, o_stat_k33, t_stat_k33, itmcnt_k33,
        DATEDIFF(MINUTE, uptime_k33, GETDATE()) AS age_min, uptime_k33
      FROM k33_tab
      WHERE LTRIM(RTRIM(upname_k33)) = 'ajoseph'
        AND LTRIM(RTRIM(o_stat_k33)) = 'adding quotes'
        AND DATEDIFF(MINUTE, uptime_k33, GETDATE()) >= 5
      ORDER BY uptime_k33 ASC
    `);

    // 2. Unshipped — quotes added + not sent + >10min
    const unshipped = await pool.request().query(`
      SELECT TOP 20
        idnk33_k33, qotref_k33, o_stat_k33, t_stat_k33, s_stat_k33, itmcnt_k33,
        DATEDIFF(MINUTE, uptime_k33, GETDATE()) AS age_min, uptime_k33
      FROM k33_tab
      WHERE LTRIM(RTRIM(upname_k33)) = 'ajoseph'
        AND LTRIM(RTRIM(o_stat_k33)) = 'quotes added'
        AND LTRIM(RTRIM(t_stat_k33)) = 'not sent'
        AND DATEDIFF(MINUTE, uptime_k33, GETDATE()) >= 10
      ORDER BY uptime_k33 ASC
    `);

    // 3. Recent envelopes — last 24h for Abe
    const recent = await pool.request().query(`
      SELECT TOP 40
        idnk33_k33, qotref_k33, o_stat_k33, t_stat_k33, s_stat_k33, itmcnt_k33,
        uptime_k33, t_stme_k33
      FROM k33_tab
      WHERE LTRIM(RTRIM(upname_k33)) = 'ajoseph'
        AND uptime_k33 >= DATEADD(HOUR, -24, GETDATE())
      ORDER BY idnk33_k33 DESC
    `);

    await sb.from("ll_pipeline_snapshots").insert({
      snapshot_time: startedAt,
      stuck_staged_count: stuck.recordset.length,
      stuck_staged_samples: stuck.recordset,
      unshipped_count: unshipped.recordset.length,
      unshipped_samples: unshipped.recordset,
      orphan_awards_count: 0,
      orphan_awards_samples: null,
      recent_envelopes: recent.recordset,
    });

    // Keep only the most recent 200 snapshots (housekeeping)
    const { data: old } = await sb
      .from("ll_pipeline_snapshots")
      .select("id")
      .order("snapshot_time", { ascending: false })
      .range(200, 2000);
    if (old && old.length > 0) {
      const ids = old.map((r: any) => r.id);
      await sb.from("ll_pipeline_snapshots").delete().in("id", ids);
    }

    console.log(`[${startedAt}] snapshot ok — stuck=${stuck.recordset.length} unshipped=${unshipped.recordset.length} recent=${recent.recordset.length}`);
  } catch (e: any) {
    console.error(`[${startedAt}] snapshot error:`, e.message);
    await sb.from("ll_pipeline_snapshots").insert({
      snapshot_time: startedAt,
      snapshot_error: String(e.message || e).slice(0, 500),
    });
    process.exitCode = 1;
  } finally {
    await pool?.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
