import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  console.log("=== ALL k07 rows touched in last 24h ===");
  const r = await pool.request().query(`
    SELECT idnk07_k07, LTRIM(RTRIM(ss_key_k07)) AS k, LTRIM(RTRIM(ss_tid_k07)) AS tid,
           LTRIM(RTRIM(upname_k07)) AS upname, uptime_k07
    FROM k07_tab
    WHERE uptime_k07 >= DATEADD(hour, -24, GETDATE())
    ORDER BY uptime_k07 DESC
  `);
  console.log(`Found ${r.recordset.length} k07 updates in last 24h`);
  for (const row of r.recordset.slice(0, 30)) {
    console.log(`  ${row.uptime_k07?.toISOString?.()}  k07=${row.idnk07_k07}  ${row.upname.padEnd(12)} ${row.tid.padEnd(2)} ${row.k.slice(0, 50)}`);
  }
  await pool.close();
})();
