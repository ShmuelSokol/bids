/**
 * Count user objects (tables/views/procs/triggers/functions) across every
 * user database on NYEVRVSQL001. Goal: find any database that holds LL
 * application logic we might have missed when we only dumped llk_db1.
 *
 *   npx tsx scripts/all-dbs-object-counts.ts
 *   npx tsx scripts/all-dbs-object-counts.ts --grep k33   (also flag procs
 *                                                          whose body
 *                                                          references k33)
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;",
};

async function main() {
  const gIdx = process.argv.indexOf("--grep");
  const grep = gIdx >= 0 ? process.argv[gIdx + 1] : null;

  const pool = await sql.connect(config);
  const dbs = await pool.request().query(`
    SELECT name FROM sys.databases
    WHERE database_id > 4 AND state = 0
    ORDER BY name
  `);
  console.log(`=== ${dbs.recordset.length} user databases on NYEVRVSQL001 ===\n`);
  console.log(
    "database".padEnd(30) +
      "tables".padStart(8) +
      "views".padStart(8) +
      "procs".padStart(8) +
      "trigs".padStart(8) +
      "funcs".padStart(8) +
      (grep ? `  procs_matching_${grep}` : "")
  );
  console.log("─".repeat(80));

  for (const d of dbs.recordset) {
    const name = d.name;
    try {
      const q = await pool.request().query(`
        USE [${name}];
        SELECT
          SUM(CASE WHEN type = 'U' THEN 1 ELSE 0 END) AS tables,
          SUM(CASE WHEN type = 'V' THEN 1 ELSE 0 END) AS views,
          SUM(CASE WHEN type IN ('P','PC') THEN 1 ELSE 0 END) AS procs,
          SUM(CASE WHEN type = 'TR' THEN 1 ELSE 0 END) AS trigs,
          SUM(CASE WHEN type IN ('FN','IF','TF') THEN 1 ELSE 0 END) AS funcs
        FROM sys.objects WHERE is_ms_shipped = 0
      `);
      const r = q.recordset[0];

      let matchCount: number | null = null;
      if (grep) {
        const m = await pool.request().input("g", sql.NVarChar, `%${grep}%`).query(`
          USE [${name}];
          SELECT COUNT(*) AS c
          FROM sys.sql_modules m
          JOIN sys.objects o ON o.object_id = m.object_id
          WHERE o.type IN ('P','PC','TR','FN','IF','TF','V')
            AND o.is_ms_shipped = 0
            AND m.definition LIKE @g
        `);
        matchCount = m.recordset[0].c;
      }

      const hasLogic = (r.procs || 0) + (r.trigs || 0) + (r.funcs || 0) > 0;
      const marker = hasLogic ? "*" : " ";
      console.log(
        marker +
          name.padEnd(29) +
          String(r.tables || 0).padStart(8) +
          String(r.views || 0).padStart(8) +
          String(r.procs || 0).padStart(8) +
          String(r.trigs || 0).padStart(8) +
          String(r.funcs || 0).padStart(8) +
          (grep ? "  " + String(matchCount || 0).padStart(8) : "")
      );
    } catch (e: any) {
      console.log(` ${name.padEnd(29)}  (error: ${e.message?.slice(0, 50)})`);
    }
  }
  await pool.close();
  console.log(`\n* = has procs/triggers/functions (server-side logic)`);
  if (!grep) console.log(`Tip: --grep k33  to also count modules whose body references 'k33'`);
}

main().catch((e) => { console.error(e); process.exit(1); });
