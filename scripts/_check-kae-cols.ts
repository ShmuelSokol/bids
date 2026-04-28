import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  const r = await pool.request().query(`
    SELECT name, is_nullable, system_type_id, max_length
    FROM sys.columns WHERE object_id = OBJECT_ID('kae_tab')
    ORDER BY column_id
  `);
  console.log("=== kae_tab columns ===");
  for (const c of r.recordset) {
    console.log(`  ${c.name.padEnd(20)} nullable=${c.is_nullable} max_length=${c.max_length}`);
  }
  // Look at one of Abe's recent kae rows fully
  const sample = await pool.request().query(`
    SELECT TOP 1 * FROM kae_tab WHERE idnkae_kae = 307682
  `);
  console.log("\n=== Sample kae 307682 (Abe's CIN0066169) ===");
  if (sample.recordset[0]) for (const k of Object.keys(sample.recordset[0])) {
    const v = sample.recordset[0][k];
    if (v == null) continue;
    const s = v instanceof Date ? v.toISOString() : String(v).trim();
    if (s) console.log(`  ${k} = ${s.slice(0,80)}`);
  }
  await pool.close();
})();
