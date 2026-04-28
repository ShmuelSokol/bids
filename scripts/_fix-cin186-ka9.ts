import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Update ka9 358459 (under our kaj 353349) to link to kae 307691 + flip status
  const r = await pool.request().query(`
    UPDATE ka9_tab
    SET idnkae_ka9 = 307691,
        jlnsta_ka9 = 'Shipped',
        uptime_ka9 = GETDATE()
    OUTPUT inserted.idnka9_ka9 AS id
    WHERE idnka9_ka9 = 358459
  `);
  console.log("✓ updated ka9:", r.recordset);
  await pool.close();
})();
