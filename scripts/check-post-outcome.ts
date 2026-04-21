import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  const env = await pool.request().query(`
    SELECT idnk33_k33, upname_k33, uptime_k33, o_stat_k33, t_stat_k33, a_stat_k33, s_stat_k33, o_stme_k33, t_stme_k33, itmcnt_k33
    FROM k33_tab WHERE idnk33_k33 = 46852
  `);
  console.log(`Envelope 46852 now:`);
  const e = env.recordset[0];
  console.log(`  o_stat="${e.o_stat_k33?.trim()}"  t_stat="${e.t_stat_k33?.trim()}"  a_stat="${e.a_stat_k33?.trim()}"  s_stat="${e.s_stat_k33?.trim()}"`);
  console.log(`  itmcnt=${e.itmcnt_k33}  uptime=${e.uptime_k33?.toISOString?.()}  o_stme=${e.o_stme_k33?.toISOString?.()}  t_stme=${e.t_stme_k33?.toISOString?.()}`);

  const lines = await pool.request().query(`
    SELECT k34.idnk34_k34, k34.uptime_k34, k10.sol_no_k10, k08.niin_k08, k34.pn_k34, k34.mcage_k34,
           k34.solqty_k34, k34.qty_ui_k34, k35.qty_k35, k35.up_k35, k35.daro_k35
    FROM k34_tab k34
    INNER JOIN k11_tab k11 ON k34.idnk11_k34 = k11.idnk11_k11
    INNER JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
    INNER JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
    LEFT JOIN k35_tab k35 ON k35.idnk34_k35 = k34.idnk34_k34
    WHERE k34.idnk33_k34 = 46852
    ORDER BY k34.idnk34_k34
  `);
  console.log(`\n${lines.recordset.length} lines in envelope 46852:`);
  for (const L of lines.recordset as any[]) {
    const marker = L.idnk34_k34 === 495751 ? " ← OUR TEST" : "";
    console.log(`  k34=${L.idnk34_k34}  ${L.uptime_k34?.toISOString?.().slice(11,19)}  ${L.sol_no_k10?.trim().padEnd(20)}  pn="${L.pn_k34?.trim()}"  →  $${L.up_k35} × ${L.qty_k35}, ${L.daro_k35}d${marker}`);
  }
  await pool.close();
}
main().catch(console.error);
