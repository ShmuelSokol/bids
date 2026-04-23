/**
 * Aggressive search for LL stored procedures. The vendor says everything
 * runs from SQL procs, but our earlier queries (filtered by is_ms_shipped=0)
 * returned zero. This script removes filters and checks every way procs
 * can hide:
 *
 *   1. sys.objects WITHOUT is_ms_shipped filter  (catch is_ms_shipped=1 trick)
 *   2. sys.procedures  (another catalog view)
 *   3. sys.assemblies + sys.assembly_modules  (CLR procs)
 *   4. sys.servers  (linked servers — logic might be elsewhere)
 *   5. sys.extended_procedures  (xp_* style)
 *   6. Permissions check  (are we even allowed to see definitions?)
 *   7. Sample proc definitions by keyword (Post, k33, transmit, envelope)
 *
 * Across EVERY database on NYEVRVSQL001, including system DBs.
 *
 *   npx tsx scripts/find-ll-procs-aggressive.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;",
};

async function main() {
  const pool = await sql.connect(config);

  console.log(`\n=== 1. Permissions on current login ===`);
  const perms = await pool.request().query(`
    SELECT
      SUSER_NAME() AS server_login,
      USER_NAME() AS db_user,
      HAS_PERMS_BY_NAME(NULL, 'SERVER', 'VIEW SERVER STATE') AS can_view_server_state,
      HAS_PERMS_BY_NAME(NULL, 'SERVER', 'VIEW ANY DEFINITION') AS can_view_any_definition,
      HAS_PERMS_BY_NAME(NULL, 'SERVER', 'CONTROL SERVER') AS can_control_server
  `);
  for (const k of Object.keys(perms.recordset[0])) {
    console.log(`  ${k.padEnd(28)} = ${perms.recordset[0][k]}`);
  }

  console.log(`\n=== 2. Linked servers ===`);
  const lnk = await pool.request().query(`
    SELECT name, product, provider, data_source, catalog
    FROM sys.servers WHERE server_id > 0
  `);
  if (lnk.recordset.length === 0) console.log(`  (none)`);
  for (const r of lnk.recordset) console.log(` `, JSON.stringify(r));

  console.log(`\n=== 3. Every database — proc counts with AND without is_ms_shipped filter ===`);
  const dbs = await pool.request().query(`
    SELECT name FROM sys.databases WHERE state = 0 ORDER BY name
  `);
  console.log(`database`.padEnd(28) + `total_procs  user_procs  shipped_procs  clr_procs  triggers  with_k33`);
  console.log("─".repeat(100));
  const suspicious: string[] = [];
  for (const d of dbs.recordset) {
    const name = d.name;
    try {
      const q = await pool.request().query(`
        USE [${name}];
        SELECT
          (SELECT COUNT(*) FROM sys.objects WHERE type IN ('P','PC')) AS total_procs,
          (SELECT COUNT(*) FROM sys.objects WHERE type IN ('P','PC') AND is_ms_shipped = 0) AS user_procs,
          (SELECT COUNT(*) FROM sys.objects WHERE type IN ('P','PC') AND is_ms_shipped = 1) AS shipped_procs,
          (SELECT COUNT(*) FROM sys.objects WHERE type = 'PC') AS clr_procs,
          (SELECT COUNT(*) FROM sys.objects WHERE type = 'TR') AS trigs,
          (SELECT COUNT(*) FROM sys.sql_modules m WHERE m.definition LIKE '%k33%') AS with_k33
      `);
      const r = q.recordset[0];
      const line =
        name.padEnd(28) +
        String(r.total_procs).padStart(11) +
        String(r.user_procs).padStart(13) +
        String(r.shipped_procs).padStart(15) +
        String(r.clr_procs).padStart(11) +
        String(r.trigs).padStart(10) +
        String(r.with_k33).padStart(10);
      console.log(line);
      if ((r.shipped_procs || 0) > 10 || (r.with_k33 || 0) > 0) suspicious.push(name);
    } catch (e: any) {
      console.log(name.padEnd(28) + `  (error: ${e.message?.slice(0, 40)})`);
    }
  }

  console.log(`\n=== 4. CLR assemblies anywhere on server ===`);
  for (const d of dbs.recordset) {
    try {
      const a = await pool.request().query(`USE [${d.name}]; SELECT name, create_date, permission_set_desc FROM sys.assemblies WHERE is_user_defined = 1`);
      if (a.recordset.length > 0) {
        console.log(`  [${d.name}]`);
        for (const r of a.recordset) console.log(`    ${r.name} — ${r.permission_set_desc} — ${r.create_date}`);
      }
    } catch {}
  }

  console.log(`\n=== 5. Sample "shipped" (ms_shipped=1) procs in llk_db1, if any ===`);
  const sp = await pool.request().query(`
    USE llk_db1;
    SELECT TOP 20 name, type_desc, create_date, modify_date
    FROM sys.objects WHERE type IN ('P','PC','FN','IF','TF','TR') AND is_ms_shipped = 1
    ORDER BY modify_date DESC
  `);
  if (sp.recordset.length === 0) console.log(`  (none — LL did NOT use the is_ms_shipped=1 trick)`);
  for (const r of sp.recordset) console.log(`  ${r.name}  (${r.type_desc})  modified ${r.modify_date?.toISOString?.() || r.modify_date}`);

  console.log(`\n=== 6. Suspicious databases to dig deeper on ===`);
  if (suspicious.length === 0) console.log(`  (none)`);
  else {
    for (const n of suspicious) console.log(`  ${n}`);
    console.log(`\n  Re-run with: npx tsx scripts/dump-lamlinks-schema.ts --db <name>`);
  }

  console.log(`\n=== 7. Any database whose name hints at LL? ===`);
  const hints = dbs.recordset
    .map((d: any) => d.name)
    .filter((n: string) => /llk|lamlink|winsol|quote|bid|dla|dibbs/i.test(n));
  for (const h of hints) console.log(`  ${h}`);

  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
