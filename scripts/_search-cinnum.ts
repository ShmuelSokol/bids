import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Search ALL string-type columns across LL tables for value "0066169" (Abe's CIN0066169 invoice)
  // to find which field stores it.
  const tables = await pool.request().query(`
    SELECT t.name AS table_name, c.name AS col_name, c.system_type_id
    FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
    WHERE t.name LIKE 'k%_tab' AND c.system_type_id IN (167, 175, 231, 239)
    AND (c.name LIKE '%inv%' OR c.name LIKE '%cin%' OR c.name LIKE '%cilnum%')
  `);
  console.log("=== Columns with 'inv' or 'cin' in name on string cols ===");
  for (const r of tables.recordset.slice(0, 30)) console.log(`  ${r.table_name}.${r.col_name}`);

  // Search for the actual value "0066169" in a few likely places
  const searchTables = ["kaj_tab", "k80_tab", "kbr_tab", "kbb_tab", "kad_tab", "kae_tab"];
  console.log("\n=== Where is '0066169' stored? (Abe's CIN0066169 from earlier) ===");
  for (const t of searchTables) {
    const c = await pool.request().query(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('${t}') AND system_type_id IN (167,175,231,239)`);
    for (const col of c.recordset) {
      try {
        const r = await pool.request().query(`SELECT TOP 2 * FROM ${t} WHERE LTRIM(RTRIM(${col.name})) = '0066169'`);
        if (r.recordset.length > 0) {
          const idCol = Object.keys(r.recordset[0]).find(k => k.startsWith("idn"));
          console.log(`  ${t}.${col.name}: ${r.recordset.length} match(es), e.g. ${idCol}=${r.recordset[0][idCol!]}`);
        }
      } catch { /* skip */ }
    }
  }
  await pool.close();
})();
