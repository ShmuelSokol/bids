/**
 * Sync Abe's live bidding activity from LamLinks → Supabase.
 * Shows pending (unbatched) and submitted bids from today.
 *
 * Run locally every 5 min via Windows Task Scheduler:
 *   npx tsx scripts/sync-abe-bids-live.ts
 */
import "dotenv/config";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const pool = await sql.connect(config);

  // Get today's bids with full details
  const result = await pool.request().query(`
    SELECT
      k34.idnk34_k34 AS bid_id,
      k34.uptime_k34 AS bid_time,
      k34.upname_k34 AS bidder,
      k34.pn_k34 AS part_number,
      k34.mcage_k34 AS mfr_cage,
      k34.fobcod_k34 AS fob,
      k34.solqty_k34 AS sol_qty,
      k34.qty_ui_k34 AS uom,
      k35.up_k35 AS bid_price,
      k35.qty_k35 AS bid_qty,
      k35.daro_k35 AS lead_days,
      k10.sol_no_k10 AS solicitation_number,
      k10.closes_k10 AS due_date,
      k08.fsc_k08 AS fsc,
      k08.niin_k08 AS niin,
      k08.p_desc_k08 AS item_desc,
      k33.qotref_k33 AS batch_ref,
      k33.t_stat_k33 AS transmit_status,
      k33.a_stat_k33 AS ack_status,
      CASE
        WHEN k33.t_stat_k33 LIKE 'sent%' THEN 'submitted'
        WHEN k33.o_stat_k33 LIKE 'quotes added%' THEN 'pending'
        ELSE 'unknown'
      END AS bid_status
    FROM k34_tab k34
    JOIN k35_tab k35 ON k35.idnk34_k35 = k34.idnk34_k34
    JOIN k11_tab k11 ON k11.idnk11_k11 = k34.idnk11_k34
    JOIN k10_tab k10 ON k10.idnk10_k10 = k11.idnk10_k11
    JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
    LEFT JOIN k33_tab k33 ON k33.idnk33_k33 = k34.idnk33_k34
    WHERE k34.uptime_k34 >= CAST(GETDATE() AS DATE)
    ORDER BY k34.uptime_k34 DESC
  `);

  const bids = result.recordset.map((r: any) => ({
    bid_id: r.bid_id,
    bid_time: r.bid_time,
    bidder: r.bidder?.trim(),
    nsn: r.fsc && r.niin ? `${r.fsc.trim()}-${r.niin.trim()}` : null,
    fsc: r.fsc?.trim(),
    item_desc: r.item_desc?.trim(),
    part_number: r.part_number?.trim(),
    mfr_cage: r.mfr_cage?.trim(),
    solicitation_number: r.solicitation_number?.trim(),
    due_date: r.due_date,
    bid_price: r.bid_price,
    bid_qty: r.bid_qty,
    lead_days: r.lead_days,
    fob: r.fob?.trim(),
    bid_status: r.bid_status,
    batch_ref: r.batch_ref?.trim(),
    transmit_status: r.transmit_status?.trim(),
    synced_at: new Date().toISOString(),
  }));

  await pool.close();

  console.log(`${bids.length} bids today (${bids.filter(b => b.bid_status === 'submitted').length} submitted, ${bids.filter(b => b.bid_status === 'pending').length} pending)`);

  // Upsert to Supabase
  if (bids.length > 0) {
    for (let i = 0; i < bids.length; i += 100) {
      const batch = bids.slice(i, i + 100);
      await sb.from("abe_bids_live").upsert(batch, { onConflict: "bid_id" });
    }
  }

  // Log sync
  await sb.from("sync_log").insert({
    action: "abe_bids_live_sync",
    details: {
      total: bids.length,
      submitted: bids.filter(b => b.bid_status === "submitted").length,
      pending: bids.filter(b => b.bid_status === "pending").length,
    },
  });
}

main().catch(console.error);
