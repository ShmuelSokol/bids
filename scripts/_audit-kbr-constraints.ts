import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  for (const tbl of ["kbr_tab", "kad_tab", "kae_tab"]) {
    console.log(`\n=== ${tbl} indexes ===`);
    const idx = await pool.request().query(`
      SELECT i.name AS idx_name, i.is_unique, i.type_desc, i.index_id
      FROM sys.indexes i WHERE i.object_id = OBJECT_ID('${tbl}') AND i.is_hypothetical = 0
    `);
    for (const r of idx.recordset) {
      const cols = await pool.request().query(`
        SELECT c.name FROM sys.index_columns ic
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = OBJECT_ID('${tbl}') AND ic.index_id = ${r.index_id}
        ORDER BY ic.key_ordinal
      `);
      const colList = cols.recordset.map((x:any) => x.name).join(",");
      console.log(`  ${r.idx_name || "(heap)"} ${r.is_unique ? "UNIQUE " : ""}${r.type_desc} cols=${colList}`);
    }
  }
  // Check kdy_tab for invoice-relevant counters
  const cols = await pool.request().query(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('kdy_tab')`);
  console.log("\n=== kdy_tab column names: ===", cols.recordset.map((x:any)=>x.name).join(", "));
  await pool.close();
})();
