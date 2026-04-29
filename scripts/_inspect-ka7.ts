import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  const cols = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='ka7_tab' ORDER BY ORDINAL_POSITION`);
  console.log("ka7_tab cols:", cols.recordset.map((r:any)=>r.COLUMN_NAME).join(", "));

  // Look for any column named *cage*
  const cageCol = cols.recordset.find((c:any) => /cage/i.test(c.COLUMN_NAME));
  console.log("\nCAGE column:", cageCol?.COLUMN_NAME);

  // Sample rows where d_name contains USNS or the consignee
  const r = await pool.request().query(`
    SELECT TOP 3 * FROM ka7_tab
    WHERE d_name_ka7 LIKE '%USNS SOJOURNER%' OR d_name_ka7 LIKE '%0129 CS%'
  `);
  console.log(`\nFound ${r.recordset.length} matching rows. Showing first:`);
  for (const row of r.recordset.slice(0, 2)) {
    console.log("---");
    for (const [k, v] of Object.entries(row)) {
      if (v != null && v !== "" && v !== 0) console.log(`  ${k.padEnd(15)} = ${String(v).trim().slice(0, 80)}`);
    }
  }
  await pool.close();
})().catch(e => { console.error(e); process.exit(1); });
