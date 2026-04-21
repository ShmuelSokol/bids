import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  console.log("=== Current MAX(idnk34), MAX(idnk35) ===");
  const m = await pool.request().query(`SELECT MAX(idnk34_k34) AS m34, (SELECT MAX(idnk35_k35) FROM k35_tab) AS m35 FROM k34_tab`);
  console.log(`  MAX k34=${m.recordset[0].m34}, MAX k35=${m.recordset[0].m35}`);

  console.log("\n=== Most recent 15 k34 rows (any envelope) ===");
  const rec = await pool.request().query(`
    SELECT TOP 15 k34.idnk34_k34, k34.uptime_k34, k34.upname_k34, k34.idnk33_k34,
           k33.o_stat_k33, k33.t_stat_k33,
           k10.sol_no_k10
    FROM k34_tab k34
    LEFT JOIN k33_tab k33 ON k34.idnk33_k34 = k33.idnk33_k33
    LEFT JOIN k11_tab k11 ON k34.idnk11_k34 = k11.idnk11_k11
    LEFT JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
    ORDER BY k34.idnk34_k34 DESC
  `);
  for (const r of rec.recordset as any[]) {
    console.log(`  k34=${r.idnk34_k34}  env=${r.idnk33_k34}  ${r.uptime_k34?.toISOString?.().slice(11,19)}  ${r.upname_k34?.trim()}  ${r.o_stat_k33?.trim()}/${r.t_stat_k33?.trim()}  sol=${r.sol_no_k10?.trim()}`);
  }

  console.log("\n=== Current staged envelopes (ajoseph, adding quotes) ===");
  const st = await pool.request().query(`
    SELECT idnk33_k33, uptime_k33, itmcnt_k33,
           (SELECT COUNT(*) FROM k34_tab WHERE idnk33_k34 = k33.idnk33_k33) AS actual_lines
    FROM k33_tab k33
    WHERE LTRIM(RTRIM(o_stat_k33))='adding quotes' AND LTRIM(RTRIM(upname_k33))='ajoseph'
  `);
  for (const r of st.recordset as any[]) {
    console.log(`  env=${r.idnk33_k33}  itmcnt=${r.itmcnt_k33}  actual_lines=${r.actual_lines}  uptime=${r.uptime_k33?.toISOString?.()}`);
    const lines = await pool.request().query(`
      SELECT k34.idnk34_k34, k34.uptime_k34, k10.sol_no_k10
      FROM k34_tab k34
      LEFT JOIN k11_tab k11 ON k34.idnk11_k34 = k11.idnk11_k11
      LEFT JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
      WHERE k34.idnk33_k34 = ${r.idnk33_k33}
      ORDER BY k34.idnk34_k34
    `);
    for (const L of lines.recordset as any[]) {
      console.log(`    k34=${L.idnk34_k34}  ${L.uptime_k34?.toISOString?.().slice(11,19)}  sol=${L.sol_no_k10?.trim()}`);
    }
  }

  console.log("\n=== lamlinks_write_queue state ===");
  // can't easily hit supabase here without import — skip. User can check /settings/lamlinks-writeback.

  console.log("\n=== Our orphaned posted rows at 495751 / 495752 still present? ===");
  const orph = await pool.request().query(`
    SELECT idnk34_k34, idnk33_k34, uptime_k34 FROM k34_tab WHERE idnk34_k34 IN (495751, 495752)
  `);
  for (const r of orph.recordset as any[]) console.log(`  ${JSON.stringify(r)}`);

  await pool.close();
}
main().catch(console.error);
