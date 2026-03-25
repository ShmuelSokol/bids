import sql from "mssql/msnodesqlv8";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(__dirname, "..", "data", "llk-discovery");

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("Connecting to NYEVRVSQL001/llk_db1 (Windows Auth)...");
  const pool = await sql.connect(config);
  console.log("Connected!\n");

  console.log("Running: FSC bid heatmap...");
  const start = Date.now();
  const result = await pool.request().query(`
    SELECT fsc_k08 AS fsc_code,
           COUNT(*) AS total_bids,
           MAX(k34.uptime_k34) AS most_recent_bid,
           MIN(k34.uptime_k34) AS oldest_bid,
           COUNT(CASE WHEN k34.uptime_k34 >= DATEADD(month, -6, GETDATE()) THEN 1 END) AS bids_last_6_months,
           COUNT(CASE WHEN k34.uptime_k34 >= DATEADD(month, -1, GETDATE()) THEN 1 END) AS bids_last_month
    FROM k34_tab k34
    JOIN k11_tab k11 ON k34.idnk11_k34 = k11.idnk11_k11
    JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
    GROUP BY fsc_k08
    ORDER BY bids_last_6_months DESC
  `);
  const rows = result.recordset;
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`  -> ${rows.length} FSC codes returned (${elapsed}s)\n`);

  writeFileSync(
    join(OUTPUT_DIR, "fsc-heatmap.json"),
    JSON.stringify(rows, null, 2)
  );

  // Bucket analysis
  const hot = rows.filter((r) => r.bids_last_month > 0);
  const warm = rows.filter(
    (r) => r.bids_last_month === 0 && r.bids_last_6_months > 0
  );
  const cold = rows.filter((r) => r.bids_last_6_months === 0);

  console.log("=== FSC HEATMAP SUMMARY ===\n");
  console.log(`Total FSC codes with bids: ${rows.length}`);
  console.log(`  HOT  (bids last month):     ${hot.length} FSCs`);
  console.log(`  WARM (bids last 6mo only):  ${warm.length} FSCs`);
  console.log(`  COLD (no bids in 6mo):      ${cold.length} FSCs\n`);

  console.log("--- HOT FSCs (top 20 by last-month volume) ---");
  hot
    .sort((a, b) => b.bids_last_month - a.bids_last_month)
    .slice(0, 20)
    .forEach((r, i) => {
      console.log(
        `  ${(i + 1).toString().padStart(2)}. FSC ${r.fsc_code.trim()} — ${r.bids_last_month} bids last month, ${r.total_bids.toLocaleString()} total`
      );
    });

  console.log("\n--- WARM FSCs (top 20 by 6-month volume) ---");
  warm
    .sort((a, b) => b.bids_last_6_months - a.bids_last_6_months)
    .slice(0, 20)
    .forEach((r, i) => {
      console.log(
        `  ${(i + 1).toString().padStart(2)}. FSC ${r.fsc_code.trim()} — ${r.bids_last_6_months} bids last 6mo, last bid ${new Date(r.most_recent_bid).toISOString().split("T")[0]}`
      );
    });

  console.log("\n--- COLD FSCs (top 20 by historical volume) ---");
  cold
    .sort((a, b) => b.total_bids - a.total_bids)
    .slice(0, 20)
    .forEach((r, i) => {
      console.log(
        `  ${(i + 1).toString().padStart(2)}. FSC ${r.fsc_code.trim()} — ${r.total_bids.toLocaleString()} historical bids, last bid ${new Date(r.most_recent_bid).toISOString().split("T")[0]}`
      );
    });

  // Totals by bucket
  const hotBids = hot.reduce((s, r) => s + r.total_bids, 0);
  const warmBids = warm.reduce((s, r) => s + r.total_bids, 0);
  const coldBids = cold.reduce((s, r) => s + r.total_bids, 0);
  console.log("\n--- BID VOLUME BY BUCKET ---");
  console.log(`  HOT:  ${hotBids.toLocaleString()} bids across ${hot.length} FSCs`);
  console.log(`  WARM: ${warmBids.toLocaleString()} bids across ${warm.length} FSCs`);
  console.log(`  COLD: ${coldBids.toLocaleString()} bids across ${cold.length} FSCs`);

  await pool.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
