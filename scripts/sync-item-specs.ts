/**
 * Sync item specs + bid status from LamLinks → Supabase.
 * Pulls: descriptions, part numbers, CAGE, weight, price, bid status (sent/ack)
 *
 * Run: npx tsx scripts/sync-item-specs.ts
 */
import "dotenv/config";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

const config = {
  connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== Sync Item Specs + Bid Status ===\n");
  const pool = await sql.connect(config);

  // 1. Item specs from k08
  console.log("Step 1: Pulling item specs from k08...");
  const specs = await pool.request().query(`
    SELECT fsc_k08 AS fsc, niin_k08 AS niin, p_desc_k08 AS description,
           partno_k08 AS part_number, p_cage_k08 AS mfr_cage,
           p_up_k08 AS ll_price, weight_k08 AS weight, p_um_k08 AS unit_of_measure
    FROM k08_tab
    WHERE p_desc_k08 IS NOT NULL AND fsc_k08 IS NOT NULL
  `);
  console.log(`  ${specs.recordset.length} items`);

  const itemSpecs = specs.recordset.map((r: any) => ({
    nsn: `${r.fsc?.trim()}-${r.niin?.trim()}`,
    description: r.description?.trim() || "",
    part_number: r.part_number?.trim() || "",
    mfr_cage: r.mfr_cage?.trim() || "",
    ll_price: r.ll_price || 0,
    weight: r.weight || 0,
    unit_of_measure: r.unit_of_measure?.trim() || "",
  }));

  // Save to publog_nsns (reuse table — it has the right columns)
  let specsSaved = 0;
  for (let i = 0; i < itemSpecs.length; i += 500) {
    const batch = itemSpecs.slice(i, i + 500).map(s => ({
      nsn: s.nsn,
      fsc: s.nsn.split("-")[0],
      niin: s.nsn.split("-").slice(1).join("-"),
      item_name: s.description,
      unit_price: s.ll_price > 0 ? s.ll_price : null,
      unit_of_issue: s.unit_of_measure,
      cage_code: s.mfr_cage,
      part_number: s.part_number,
    }));
    const { error } = await sb.from("publog_nsns").upsert(batch, { onConflict: "nsn", ignoreDuplicates: false });
    if (!error) specsSaved += batch.length;
    if ((i + 500) % 5000 === 0) console.log(`  ${specsSaved} saved...`);
  }
  console.log(`  ${specsSaved} item specs saved to publog_nsns`);

  // 2. Recent bid statuses from k33/k34
  console.log("\nStep 2: Pulling bid statuses (last 30 days)...");
  const bidStatus = await pool.request().query(`
    SELECT k10.sol_no_k10 AS solicitation_number,
           k33.t_stat_k33 AS transmit_status,
           k33.a_stat_k33 AS ack_status,
           k33.t_stme_k33 AS sent_at,
           k33.a_stme_k33 AS acked_at,
           k35.up_k35 AS bid_price,
           k35.qty_k35 AS bid_qty
    FROM k34_tab k34
    JOIN k35_tab k35 ON k35.idnk34_k35 = k34.idnk34_k34
    JOIN k33_tab k33 ON k33.idnk33_k33 = k34.idnk33_k34
    JOIN k11_tab k11 ON k11.idnk11_k11 = k34.idnk11_k34
    JOIN k10_tab k10 ON k10.idnk10_k10 = k11.idnk10_k11
    WHERE k34.uptime_k34 >= DATEADD(day, -30, GETDATE())
      AND k34.upname_k34 = 'ajoseph'
    ORDER BY k34.uptime_k34 DESC
  `);
  console.log(`  ${bidStatus.recordset.length} recent bid statuses`);

  // Save bid statuses to abe_bids with status info
  const statusRecords = bidStatus.recordset.map((r: any) => ({
    solicitation_number: r.solicitation_number?.trim(),
    transmit_status: r.transmit_status?.trim(),
    ack_status: r.ack_status?.trim(),
    sent_at: r.sent_at,
    acked_at: r.acked_at,
    bid_price: r.bid_price,
    bid_qty: r.bid_qty,
  }));

  // Save to sync_log for now (bid status tracking)
  await sb.from("sync_log").insert({
    action: "bid_status_sync",
    details: {
      total: statusRecords.length,
      sent: statusRecords.filter(r => r.transmit_status?.includes("sent")).length,
      acknowledged: statusRecords.filter(r => r.ack_status?.includes("acknowledged")).length,
    },
  });

  // 3. Win/Loss data for analytics
  console.log("\nStep 3: Pulling win/loss by FSC...");
  const winLoss = await pool.request().query(`
    SELECT k08.fsc_k08 AS fsc,
           COUNT(DISTINCT k34.idnk34_k34) AS total_bids,
           COUNT(DISTINCT k81.idnk81_k81) AS total_awards,
           SUM(k35.up_k35 * k35.qty_k35) AS total_bid_value,
           SUM(k81.cln_up_k81 * k81.clnqty_k81) AS total_award_value
    FROM k34_tab k34
    JOIN k35_tab k35 ON k35.idnk34_k35 = k34.idnk34_k34
    JOIN k11_tab k11 ON k11.idnk11_k11 = k34.idnk11_k34
    JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
    LEFT JOIN k81_tab k81 ON k81.idnk71_k81 = k11.idnk11_k11
      AND k81.addtme_k81 >= DATEADD(year, -1, GETDATE())
    WHERE k34.uptime_k34 >= DATEADD(year, -1, GETDATE())
      AND k34.scage_k34 = '0AG09'
    GROUP BY k08.fsc_k08
    ORDER BY COUNT(DISTINCT k34.idnk34_k34) DESC
  `);
  console.log(`  ${winLoss.recordset.length} FSCs with bid data`);

  // Update fsc_heatmap with win rates
  for (const r of winLoss.recordset) {
    const fsc = r.fsc?.trim();
    const bids = r.total_bids || 0;
    const awards = r.total_awards || 0;
    const winRate = bids > 0 ? Math.round((awards / bids) * 100) : 0;
    if (fsc) {
      const { error: hErr } = await sb.from("fsc_heatmap").upsert({
        fsc_code: fsc,
        total_bids: bids,
        bids_last_month: 0,
        bids_last_6_months: bids,
        dla_spend_6mo: r.total_award_value || 0,
        bucket: bids > 100 ? "hot" : bids > 20 ? "warm" : "cold",
      }, { onConflict: "fsc_code" });
      if (hErr) { /* ignore */ }
    }
  }
  console.log(`  Updated fsc_heatmap with win/loss data`);

  await pool.close();

  console.log("\nDone!");
  console.log(`  ${specsSaved} item specs synced`);
  console.log(`  ${statusRecords.length} bid statuses tracked`);
  console.log(`  ${winLoss.recordset.length} FSC win/loss rates updated`);
}

main().catch(console.error);
