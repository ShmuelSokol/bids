import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  const SOL = "SPE2DS-26-T-9795";

  // DIBS bid_decisions
  console.log(`=== DIBS bid_decisions for ${SOL} ===`);
  const { data: bd } = await supabase.from("bid_decisions").select("*").eq("solicitation_number", SOL);
  for (const r of bd || []) console.log(" ", JSON.stringify(r));

  // DIBS solicitation (for reference — qty, etc.)
  console.log(`\n=== DIBS dibbs_solicitations for ${SOL} ===`);
  const { data: sol } = await supabase
    .from("dibbs_solicitations")
    .select("nsn, solicitation_number, quantity, fsc, nomenclature, suggested_price, price_source, margin_pct, est_shipping, fob, return_by_date")
    .eq("solicitation_number", SOL);
  for (const r of sol || []) console.log(" ", JSON.stringify(r));

  // LamLinks k10/k11/k08
  console.log(`\n=== LamLinks lookup for ${SOL} ===`);
  const r = await pool.request().query(`
    SELECT k10.idnk10_k10, k11.idnk11_k11, k11.solqty_k11, k11.sol_um_k11,
           k08.idnk08_k08, k08.niin_k08, k08.fsc_k08, k08.partno_k08, k08.p_cage_k08, k08.p_desc_k08
    FROM k10_tab k10
    INNER JOIN k11_tab k11 ON k11.idnk10_k11 = k10.idnk10_k10
    INNER JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
    WHERE k10.sol_no_k10 = '${SOL}'
  `);
  for (const row of r.recordset as any[]) {
    console.log(`  idnk11=${row.idnk11_k11}  NIIN=${row.niin_k08}  FSC=${row.fsc_k08}  qty=${row.solqty_k11} ${row.sol_um_k11?.trim()}`);
    console.log(`  part="${row.partno_k08?.trim()}"  cage=${row.p_cage_k08}  desc="${row.p_desc_k08?.trim().slice(0,80)}"`);
  }

  // Envelope 46853 state + current MAX for id peek
  console.log(`\n=== Envelope 46853 current state ===`);
  const env = await pool.request().query(`
    SELECT o_stat_k33, itmcnt_k33, uptime_k33,
           (SELECT COUNT(*) FROM k34_tab WHERE idnk33_k34 = 46853) AS actual_lines
    FROM k33_tab WHERE idnk33_k33 = 46853
  `);
  console.log(" ", JSON.stringify(env.recordset[0]));

  const max = await pool.request().query(`SELECT MAX(idnk34_k34) AS m34, (SELECT MAX(idnk35_k35) FROM k35_tab) AS m35 FROM k34_tab`);
  console.log(`\n=== MAX ids right now ===`);
  console.log(`  k34 MAX=${max.recordset[0].m34}  →  next=${max.recordset[0].m34+1}`);
  console.log(`  k35 MAX=${max.recordset[0].m35}  →  next=${max.recordset[0].m35+1}`);

  await pool.close();
}
main().catch(console.error);
