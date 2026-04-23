/**
 * Find which database on NYEVRVSQL001 holds the
 * Automatic_Import_SZY_WinSol_Table_Groups procedure (the one LL-related
 * SQL Agent job). llk_db1 has zero procs, so it lives elsewhere.
 *
 *   npx tsx scripts/find-ll-proc-across-dbs.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;",
};

async function main() {
  const pool = await sql.connect(config);
  // Enumerate all user databases
  const dbs = await pool.request().query(`
    SELECT name FROM sys.databases
    WHERE database_id > 4 AND state = 0
    ORDER BY name
  `);
  console.log(`Searching ${dbs.recordset.length} databases for Automatic_Import_SZY_WinSol_Table_Groups...\n`);

  for (const d of dbs.recordset) {
    const name = d.name;
    try {
      const q = await pool.request().query(`
        USE [${name}];
        SELECT
          OBJECT_SCHEMA_NAME(o.object_id) AS schema_name,
          o.name AS proc_name,
          o.type_desc,
          m.definition
        FROM sys.objects o
        LEFT JOIN sys.sql_modules m ON m.object_id = o.object_id
        WHERE o.name LIKE '%WinSol%' OR o.name LIKE '%Automatic_Import%'
      `);
      if (q.recordset.length > 0) {
        console.log(`✓ Found in database [${name}]:`);
        for (const r of q.recordset) {
          console.log(`  ${r.schema_name}.${r.proc_name}  (${r.type_desc})`);
          if (r.definition) {
            const preview = r.definition.slice(0, 400).replace(/\n/g, "\n    ");
            console.log(`    ${preview}${r.definition.length > 400 ? "..." : ""}`);
          }
        }
        console.log("");
      }
    } catch (e: any) {
      console.log(`  (${name}: ${e.message?.slice(0, 60)})`);
    }
  }
  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
