import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Search ALL string columns across ALL k*_tab for tonight's invoice numbers
  const tables = await pool.request().query(`
    SELECT t.name AS table_name FROM sys.tables t WHERE t.name LIKE 'k%_tab'
  `);
  const targets = ["0066229", "0066217", "0066211", "0066186"];
  for (const target of targets) {
    console.log(`\n=== Searching for "${target}" ===`);
    for (const tr of tables.recordset) {
      const t = tr.table_name;
      const c = await pool.request().query(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('${t}') AND system_type_id IN (167,175,231,239) AND max_length BETWEEN 6 AND 64`);
      for (const col of c.recordset) {
        try {
          const r = await pool.request().query(`SELECT TOP 1 * FROM ${t} WHERE LTRIM(RTRIM(${col.name})) = '${target}'`);
          if (r.recordset.length > 0) {
            const idCol = Object.keys(r.recordset[0]).find(k => k.startsWith("idn") && !k.includes("_k") || k.endsWith(`_${t.replace("_tab","")}`));
            console.log(`  ${t}.${col.name}: idn=${r.recordset[0][idCol!]}`);
          }
        } catch { /* skip */ }
      }
    }
  }
  await pool.close();
})();
