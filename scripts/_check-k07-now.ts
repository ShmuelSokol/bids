import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  const r = await pool.request().query(`
    SELECT ss_key_k07, ss_tid_k07, ss_val_k07, uptime_k07
    FROM k07_tab WHERE LTRIM(RTRIM(ss_key_k07)) IN ('CIN_NO', 'TRN_ID_CK5')
    AND LTRIM(RTRIM(ss_tid_k07)) = 'G'
  `);
  for (const row of r.recordset) {
    console.log(`  ${String(row.ss_key_k07).trim().padEnd(12)} = ${String(row.ss_val_k07).trim().padEnd(10)} updated ${row.uptime_k07.toISOString()}`);
  }
  await pool.close();
})();
