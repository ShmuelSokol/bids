import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Check rows in ka4/ka6/kaw/kbb that touched today around invoice times
  // Compare counts: rows linked to OUR kaj 353349 vs Abe's kaj 353327
  for (const t of ["ka4_tab", "ka6_tab", "kaw_tab"]) {
    // Find columns with idn references
    const cols = await pool.request().query(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('${t}')`);
    const colNames = cols.recordset.map((r:any) => r.name);
    console.log(`\n=== ${t} (cols: ${colNames.join(", ")}) ===`);
    // See if any has a reference to kaj
    const kajRefCol = colNames.find((n:string) => /idnkaj|idnitt/i.test(n));
    if (kajRefCol) {
      const r = await pool.request().query(`
        SELECT * FROM ${t} WHERE ${kajRefCol} IN (353349, 353327, 353275)
      `);
      console.log(`  rows linked to ours/abe kajs (col=${kajRefCol}): ${r.recordset.length}`);
      for (const row of r.recordset) {
        const summary = Object.entries(row).filter(([_, v]) => v != null && v !== "" && v !== 0).map(([k, v]) => `${k}=${String(v).trim().slice(0,30)}`).join(" ");
        console.log(`    ${summary}`);
      }
    } else {
      // No kaj ref; show recent rows
      const r = await pool.request().query(`
        SELECT TOP 5 * FROM ${t} ORDER BY 1 DESC
      `);
      console.log(`  no kaj ref column; latest 5:`);
      for (const row of r.recordset.slice(0,3)) {
        const summary = Object.entries(row).filter(([_, v]) => v != null && v !== "" && v !== 0).map(([k, v]) => `${k}=${String(v).trim().slice(0,30)}`).slice(0,8).join(" ");
        console.log(`    ${summary}`);
      }
    }
  }
  await pool.close();
})();
