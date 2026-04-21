import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Latest 3 k33 envelopes
  const env = await pool.request().query(`
    SELECT TOP 5 idnk33_k33, upname_k33, uptime_k33, o_stat_k33, t_stat_k33, itmcnt_k33,
           t_stme_k33,
           (SELECT COUNT(*) FROM k34_tab WHERE idnk33_k34 = k33.idnk33_k33) AS actual_lines
    FROM k33_tab k33
    ORDER BY idnk33_k33 DESC
  `);
  console.log(`Latest envelopes:\n`);
  for (const r of env.recordset as any[]) {
    console.log(`  idnk33=${r.idnk33_k33}  o_stat="${r.o_stat_k33?.trim()}"  t_stat="${r.t_stat_k33?.trim()}"  itmcnt=${r.itmcnt_k33}  lines=${r.actual_lines}  uptime=${r.uptime_k33?.toISOString?.().slice(0,19)}  t_stme=${r.t_stme_k33?.toISOString?.().slice(0,19)}`);
  }

  // Lines in the most recent 3 envelopes
  for (const r of env.recordset.slice(0, 3) as any[]) {
    const lines = await pool.request().query(`
      SELECT k34.idnk34_k34, k34.uptime_k34, k10.sol_no_k10, k08.niin_k08, k34.pn_k34, k34.mcage_k34,
             k34.solqty_k34, k34.qty_ui_k34, k35.qty_k35, k35.up_k35, k35.daro_k35
      FROM k34_tab k34
      INNER JOIN k11_tab k11 ON k34.idnk11_k34 = k11.idnk11_k11
      INNER JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
      INNER JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
      LEFT JOIN k35_tab k35 ON k35.idnk34_k35 = k34.idnk34_k34
      WHERE k34.idnk33_k34 = ${r.idnk33_k33}
      ORDER BY k34.idnk34_k34
    `);
    console.log(`\nEnvelope ${r.idnk33_k33} lines:`);
    for (const L of lines.recordset as any[]) {
      console.log(`  k34=${L.idnk34_k34}  ${L.uptime_k34?.toISOString?.().slice(11,19)}  ${L.sol_no_k10?.trim().padEnd(20)}  pn="${L.pn_k34?.trim()}"  →  $${L.up_k35} × ${L.qty_k35} ${L.qty_ui_k34?.trim()}, ${L.daro_k35}d`);
    }
  }

  await pool.close();
}
main().catch(console.error);
