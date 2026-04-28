import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // ka6 rows for our kaj vs Abe's
  for (const k of [353349, 353327, 353275]) {
    const r = await pool.request().query(`
      SELECT * FROM ka6_tab WHERE LTRIM(RTRIM(gdutbl_ka6)) = 'kaj' AND idngdu_ka6 = ${k}
    `);
    console.log(`\n=== ka6 rows for kaj ${k}: ${r.recordset.length} ===`);
    for (const row of r.recordset.slice(0, 5)) {
      const summary = Object.entries(row).filter(([_, v]) => v != null && v !== "" && v !== 0).map(([key, v]) => `${key}=${String(v).trim().slice(0,30)}`).join(" ");
      console.log(`  ${summary}`);
    }
  }
  await pool.close();
})();
