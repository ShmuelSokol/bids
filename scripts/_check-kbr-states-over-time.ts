import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Look at distinct xtcsta values in kbr_tab — maybe there's an "acked" state
  const r = await pool.request().query(`
    SELECT DISTINCT LTRIM(RTRIM(xtcsta_kbr)) AS sta, COUNT(*) AS n,
      MIN(addtme_kbr) AS oldest, MAX(addtme_kbr) AS newest
    FROM kbr_tab WHERE idnkap_kbr IN (24, 25)
    GROUP BY LTRIM(RTRIM(xtcsta_kbr))
    ORDER BY n DESC
  `);
  console.log("=== distinct kbr xtcsta values for WAWF 810/856 ===");
  for (const row of r.recordset) {
    console.log(`  "${row.sta}": ${row.n} (oldest=${row.oldest?.toISOString?.()?.slice(0,10)} newest=${row.newest?.toISOString?.()?.slice(0,10)})`);
  }
  await pool.close();
})();
