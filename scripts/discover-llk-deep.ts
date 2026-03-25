import sql from "mssql/msnodesqlv8";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(__dirname, "..", "data", "llk-discovery");

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const queries: { name: string; file: string; sql: string }[] = [
  {
    name: "Bid history (k34 + k35 join)",
    file: "bid-history.json",
    sql: `SELECT k34.idnk34_k34 AS bid_id,
       k34.solqty_k34 AS solicitation_qty,
       k34.fobcod_k34 AS fob_code,
       k34.bidtyp_k34 AS bid_type,
       k34.mcage_k34 AS manufacturer_cage,
       k34.scage_k34 AS supplier_cage,
       k34.shpcty_k34 AS ship_city,
       k34.idpo_k34 AS idpo_flag,
       k34.cuntor_k34 AS contracting_officer,
       k34.uptime_k34 AS last_updated,
       k35.qty_k35 AS quote_qty,
       k35.up_k35 AS unit_price,
       k35.daro_k35 AS lead_time_days,
       k35.clin_k35 AS clin
FROM k34_tab k34
JOIN k35_tab k35 ON k34.idnk34_k34 = k35.idnk34_k35
ORDER BY k34.uptime_k34 DESC`,
  },
  {
    name: "Awards/orders (clin_basic_1_view)",
    file: "awards-recent.json",
    sql: `SELECT TOP 5000 *
FROM clin_basic_1_view
ORDER BY addtme_k81 DESC`,
  },
  {
    name: "Quote transmissions (aq_quote_transmission_1_view)",
    file: "quote-transmissions.json",
    sql: `SELECT TOP 5000 *
FROM aq_quote_transmission_1_view
ORDER BY q_time_kd8 DESC`,
  },
  {
    name: "Item master (k08_tab NSN catalog)",
    file: "item-master.json",
    sql: `SELECT fsc_k08, niin_k08, partno_k08, p_cage_k08 AS manufacturer_cage,
       p_desc_k08 AS description, p_up_k08 AS unit_price,
       p_um_k08 AS unit_of_measure, weight_k08
FROM k08_tab
WHERE fsc_k08 != '' AND LTRIM(RTRIM(fsc_k08)) != ''
ORDER BY fsc_k08, niin_k08`,
  },
];

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("Connecting to NYEVRVSQL001/llk_db1 (Windows Auth)...");
  const pool = await sql.connect(config);
  console.log("Connected!\n");

  for (const q of queries) {
    console.log(`Running: ${q.name}...`);
    const start = Date.now();
    try {
      const result = await pool.request().query(q.sql);
      const rows = result.recordset;
      const outPath = join(OUTPUT_DIR, q.file);
      writeFileSync(outPath, JSON.stringify(rows, null, 2));
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  -> ${rows.length.toLocaleString()} rows saved to ${q.file} (${elapsed}s)\n`);
    } catch (err: any) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.error(`  ERROR on "${q.name}" (${elapsed}s): ${err.message}\n`);
      const outPath = join(OUTPUT_DIR, q.file);
      writeFileSync(outPath, JSON.stringify({ error: err.message }, null, 2));
    }
  }

  await pool.close();
  console.log("Done. All results saved to data/llk-discovery/");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
