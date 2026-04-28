import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  const r = await pool.request().query(`
    SELECT name, max_length, is_nullable, system_type_id
    FROM sys.columns WHERE object_id = OBJECT_ID('k20_tab')
    ORDER BY column_id
  `);
  for (const c of r.recordset) console.log(`  ${c.name.padEnd(15)} max_len=${c.max_length} nullable=${c.is_nullable}`);
})();
