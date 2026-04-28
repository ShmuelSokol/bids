import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // k20 entries by ajoseph for tonight
  const r = await pool.request().query(`
    SELECT TOP 20 idnk20_k20, uptime_k20, susnam_k20, msgcls_k20, logmsg_k20
    FROM k20_tab
    WHERE upname_k20 = 'ajoseph   ' AND uptime_k20 >= DATEADD(HOUR, -1, GETDATE())
      AND LTRIM(RTRIM(susnam_k20)) = 'WAWF_edi_upload'
    ORDER BY uptime_k20 DESC
  `);
  console.log(`=== k20 WAWF_edi_upload by ajoseph last 1h: ${r.recordset.length} ===`);
  for (const row of r.recordset) {
    console.log(`  ${row.uptime_k20.toISOString()} ${String(row.msgcls_k20).trim()}: ${String(row.logmsg_k20).trim().slice(0,100)}`);
  }
  await pool.close();
})();
