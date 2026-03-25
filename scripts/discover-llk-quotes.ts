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
    name: "Quote metrics (full bid+award+solicitation join)",
    file: "quote-metrics.json",
    sql: `SELECT TOP 5000
  ref_no_k09, sol_no_k10, sol_ti_k10, isudte_k10, saside_k10, closes_k10,
  fsc_k08, niin_k08, partno_k08, p_cage_k08, p_desc_k08, weight_k08,
  classa_k08, i_note_k08,
  upname_k34, bidtyp_k34, qrefno_k34, mcage_k34, pn_k34, scage_k34,
  trmdes_k34, fobcod_k34, valday_k34, solqty_k34, qty_ui_k34,
  gennte_k34, uptime_k34,
  qty_k35, up_k35, daro_k35,
  adddte_kc4, c_stat_kc4, cntrct_kc4, rel_no_kc4, reldte_kc4,
  a_cage_kc4, awdqty_kc4, awd_up_kc4,
  s_code_k39, e_name_k12, rfq_no_k42,
  untcst_k57, p_um_k56, su_lbs_k56,
  source_k09, piidno_kc4,
  prdqty_kcg, fatqty_kcg
FROM quote_metrics_1_view
ORDER BY uptime_k34 DESC`,
  },
  {
    name: "Solicitation-to-quote pipeline (5K most recent)",
    file: "sol-quote-pipeline.json",
    sql: `SELECT TOP 5000
  ref_no_k09, c_code_k31, sol_no_k10, itemno_k11, pr_num_k11,
  partno_k08, p_cage_k08, p_desc_k08, niin_k08, fsc_k08, classa_k08,
  closes_k11, solqty_k11, sol_um_k11, estval_k11,
  b_code_k10, b_name_k10, sol_ti_k10, isudte_k10, closes_k10,
  saside_k10, cntpri_k10,
  prdqty_k11, fatqty_k11, optqty_k11,
  picode_k11, amcode_k11,
  slcnam_k21, sprnam_k24,
  q_type_k56, p_um_k56, untcst_k57, dlyaro_k57, valdte_k57,
  qotdte_k55, qrefno_k55,
  idnkc4_kc4, srvqtt_kc4
FROM sol_abs_loj_rfq_quote_1_view
ORDER BY isudte_k10 DESC`,
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
  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
