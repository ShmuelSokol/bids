import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // All k33 envelopes currently in staging (not yet posted)
  const envs = await pool.request().query(`
    SELECT k33.idnk33_k33, k33.upname_k33, k33.uptime_k33, k33.o_stat_k33, k33.t_stat_k33, k33.itmcnt_k33,
           (SELECT COUNT(*) FROM k34_tab WHERE idnk33_k34 = k33.idnk33_k33) AS actual_lines
    FROM k33_tab k33
    WHERE LTRIM(RTRIM(o_stat_k33)) = 'adding quotes'
       OR LTRIM(RTRIM(t_stat_k33)) = 'not sent'
    ORDER BY k33.uptime_k33 DESC
  `);

  console.log(`Staging envelopes (k33 rows NOT yet posted): ${envs.recordset.length}\n`);
  for (const r of envs.recordset as any[]) {
    console.log(`  idnk33=${r.idnk33_k33}  user=${r.upname_k33?.trim()}  saved=${r.uptime_k33?.toISOString?.()?.slice(0, 16)}  o_stat="${r.o_stat_k33?.trim()}"  t_stat="${r.t_stat_k33?.trim()}"  itmcnt=${r.itmcnt_k33}  actual_lines=${r.actual_lines}`);
  }

  // For each staging envelope, show the sols
  for (const r of envs.recordset as any[]) {
    const lines = await pool.request().query(`
      SELECT k10.sol_no_k10, k08.niin_k08, k34.pn_k34, k34.mcage_k34, k34.solqty_k34, k34.qty_ui_k34,
             k35.qty_k35, k35.up_k35, k35.daro_k35
      FROM k34_tab k34
      INNER JOIN k11_tab k11 ON k34.idnk11_k34 = k11.idnk11_k11
      INNER JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
      INNER JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
      LEFT JOIN k35_tab k35 ON k35.idnk34_k35 = k34.idnk34_k34
      WHERE k34.idnk33_k34 = ${r.idnk33_k33}
      ORDER BY k34.idnk34_k34
    `);
    console.log(`\n  envelope ${r.idnk33_k33} lines:`);
    for (const L of lines.recordset as any[]) {
      console.log(`    ${L.sol_no_k10?.trim().padEnd(20)}  NIIN ${L.niin_k08}  PN "${L.pn_k34?.trim()}"  mcage ${L.mcage_k34}  solqty ${L.solqty_k34} ${L.qty_ui_k34?.trim()}  →  $${L.up_k35} × ${L.qty_k35}, ${L.daro_k35}d`);
    }
  }

  await pool.close();
}
main().catch(console.error);
