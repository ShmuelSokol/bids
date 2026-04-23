/**
 * Comprehensive LamLinks schema dump. Writes every DDL object LL's SQL
 * Server exposes to structured files under docs/lamlinks-schema/.
 * Runs once, take 5-10 minutes, emits a grep-able source tree that lets
 * future incident response take minutes instead of hours.
 *
 * What it dumps:
 *   - tables/<name>.sql          — CREATE TABLE DDL (cols, types, defaults, checks)
 *   - indexes/<table>.sql        — all non-PK indexes
 *   - foreign-keys.sql           — every FK with its source + target columns
 *   - triggers/<name>.sql        — full trigger source code
 *   - procedures/<name>.sql      — full stored procedure source
 *   - views/<name>.sql           — view definitions
 *   - functions/<name>.sql       — UDF source
 *   - agent-jobs.json            — SQL Agent job steps + schedules (from msdb)
 *   - _index.md                  — master index with row counts + cross-refs
 *
 * Usage:
 *   npx tsx scripts/dump-lamlinks-schema.ts
 *
 * Re-runs are safe — output dir is wiped first.
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};
const msdbConfig = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=msdb;Trusted_Connection=yes;",
};

const OUT_DIR = join(process.cwd(), "docs", "lamlinks-schema");

function safeWrite(path: string, body: string) {
  mkdirSync(join(OUT_DIR, path.split("/").slice(0, -1).join("/")), { recursive: true });
  writeFileSync(join(OUT_DIR, path), body, "utf-8");
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-.]/g, "_");
}

async function dumpTables(pool: sql.ConnectionPool, summary: string[]) {
  console.log("\n── Tables ──");
  // List every base table (not views)
  const tables = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  console.log(`  ${tables.recordset.length} tables`);

  for (const t of tables.recordset) {
    const schema = t.TABLE_SCHEMA;
    const name = t.TABLE_NAME;
    // Columns with full detail
    const cols = await pool.request()
      .input("s", sql.VarChar, schema)
      .input("t", sql.VarChar, name)
      .query(`
        SELECT c.COLUMN_NAME, c.DATA_TYPE, c.CHARACTER_MAXIMUM_LENGTH,
               c.NUMERIC_PRECISION, c.NUMERIC_SCALE, c.IS_NULLABLE, c.COLUMN_DEFAULT,
               c.ORDINAL_POSITION
        FROM INFORMATION_SCHEMA.COLUMNS c
        WHERE c.TABLE_SCHEMA = @s AND c.TABLE_NAME = @t
        ORDER BY c.ORDINAL_POSITION
      `);
    // PK
    const pk = await pool.request()
      .input("s", sql.VarChar, schema)
      .input("t", sql.VarChar, name)
      .query(`
        SELECT kc.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kc
          ON kc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME AND kc.TABLE_NAME = tc.TABLE_NAME
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND tc.TABLE_SCHEMA = @s AND tc.TABLE_NAME = @t
        ORDER BY kc.ORDINAL_POSITION
      `);
    // Row count (cheap — uses sys.partitions)
    const rc = await pool.request()
      .input("s", sql.VarChar, schema)
      .input("t", sql.VarChar, name)
      .query(`
        SELECT SUM(p.rows) AS row_count
        FROM sys.partitions p
        JOIN sys.objects o ON o.object_id = p.object_id
        JOIN sys.schemas s ON s.schema_id = o.schema_id
        WHERE s.name = @s AND o.name = @t AND p.index_id IN (0, 1)
      `);

    const lines: string[] = [];
    lines.push(`-- ${schema}.${name}  (${rc.recordset[0]?.row_count?.toLocaleString() ?? "?"} rows)`);
    lines.push(`CREATE TABLE ${schema}.${name} (`);
    const colDefs: string[] = [];
    for (const c of cols.recordset) {
      let t = c.DATA_TYPE;
      if (c.CHARACTER_MAXIMUM_LENGTH && c.CHARACTER_MAXIMUM_LENGTH > 0) t += `(${c.CHARACTER_MAXIMUM_LENGTH})`;
      else if (c.NUMERIC_PRECISION && c.DATA_TYPE === "numeric") t += `(${c.NUMERIC_PRECISION},${c.NUMERIC_SCALE})`;
      let line = `  ${c.COLUMN_NAME.padEnd(20)} ${t}`;
      if (c.IS_NULLABLE === "NO") line += " NOT NULL";
      if (c.COLUMN_DEFAULT) line += ` DEFAULT ${c.COLUMN_DEFAULT}`;
      colDefs.push(line);
    }
    if (pk.recordset.length > 0) {
      colDefs.push(`  PRIMARY KEY (${pk.recordset.map((r: any) => r.COLUMN_NAME).join(", ")})`);
    }
    lines.push(colDefs.join(",\n"));
    lines.push(");");
    safeWrite(`tables/${sanitize(name)}.sql`, lines.join("\n"));

    summary.push(`  - \`${name}\` — ${cols.recordset.length} cols, ${rc.recordset[0]?.row_count?.toLocaleString() ?? "?"} rows`);
    if (tables.recordset.indexOf(t) % 50 === 0) {
      process.stdout.write(`  ${tables.recordset.indexOf(t)}/${tables.recordset.length}...\r`);
    }
  }
  return tables.recordset.length;
}

async function dumpForeignKeys(pool: sql.ConnectionPool) {
  console.log("\n── Foreign keys ──");
  const fks = await pool.request().query(`
    SELECT
      fk.name AS fk_name,
      sch_src.name AS src_schema, tab_src.name AS src_table, col_src.name AS src_column,
      sch_ref.name AS ref_schema, tab_ref.name AS ref_table, col_ref.name AS ref_column,
      fk.delete_referential_action_desc AS on_delete,
      fk.update_referential_action_desc AS on_update
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    JOIN sys.tables tab_src ON tab_src.object_id = fkc.parent_object_id
    JOIN sys.schemas sch_src ON sch_src.schema_id = tab_src.schema_id
    JOIN sys.columns col_src ON col_src.object_id = fkc.parent_object_id AND col_src.column_id = fkc.parent_column_id
    JOIN sys.tables tab_ref ON tab_ref.object_id = fkc.referenced_object_id
    JOIN sys.schemas sch_ref ON sch_ref.schema_id = tab_ref.schema_id
    JOIN sys.columns col_ref ON col_ref.object_id = fkc.referenced_object_id AND col_ref.column_id = fkc.referenced_column_id
    ORDER BY tab_src.name, fk.name, fkc.constraint_column_id
  `);
  console.log(`  ${fks.recordset.length} FK columns`);
  const lines = fks.recordset.map(
    (r: any) => `${r.src_schema}.${r.src_table}.${r.src_column}  ->  ${r.ref_schema}.${r.ref_table}.${r.ref_column}  [${r.fk_name}, ondelete=${r.on_delete}, onupdate=${r.on_update}]`
  );
  safeWrite("foreign-keys.txt", lines.join("\n"));
  return fks.recordset.length;
}

async function dumpIndexes(pool: sql.ConnectionPool) {
  console.log("\n── Indexes ──");
  const ix = await pool.request().query(`
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      i.name AS index_name,
      i.type_desc,
      i.is_unique,
      i.is_primary_key,
      STUFF((
        SELECT ', ' + c.name + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE '' END
        FROM sys.index_columns ic
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
        ORDER BY ic.key_ordinal
        FOR XML PATH('')
      ), 1, 2, '') AS cols
    FROM sys.indexes i
    JOIN sys.tables t ON t.object_id = i.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE i.type > 0 AND i.is_hypothetical = 0
    ORDER BY t.name, i.index_id
  `);
  console.log(`  ${ix.recordset.length} indexes`);
  const byTable = new Map<string, string[]>();
  for (const r of ix.recordset) {
    const key = r.table_name;
    if (!byTable.has(key)) byTable.set(key, []);
    const pkMark = r.is_primary_key ? " [PK]" : r.is_unique ? " [UNIQUE]" : "";
    byTable.get(key)!.push(`${r.index_name}${pkMark}: (${r.cols}) ${r.type_desc}`);
  }
  for (const [table, lines] of byTable) {
    safeWrite(`indexes/${sanitize(table)}.txt`, lines.join("\n"));
  }
  return ix.recordset.length;
}

async function dumpModules(
  pool: sql.ConnectionPool,
  type: "triggers" | "procedures" | "views" | "functions"
) {
  const typeFilter = {
    triggers: "type IN ('TR')",
    procedures: "type IN ('P', 'PC')",
    views: "type IN ('V')",
    functions: "type IN ('FN', 'IF', 'TF')",
  }[type];
  console.log(`\n── ${type} ──`);
  const q = await pool.request().query(`
    SELECT s.name AS schema_name, o.name AS obj_name, m.definition
    FROM sys.objects o
    JOIN sys.schemas s ON s.schema_id = o.schema_id
    LEFT JOIN sys.sql_modules m ON m.object_id = o.object_id
    WHERE ${typeFilter} AND o.is_ms_shipped = 0
    ORDER BY o.name
  `);
  console.log(`  ${q.recordset.length} ${type}`);
  for (const r of q.recordset) {
    const body = r.definition || `-- (encrypted or inaccessible)`;
    safeWrite(`${type}/${sanitize(r.obj_name)}.sql`, `-- ${r.schema_name}.${r.obj_name}\n\n${body}`);
  }
  return q.recordset.length;
}

async function dumpAgentJobs() {
  console.log("\n── SQL Agent jobs (msdb) ──");
  try {
    const pool = await sql.connect(msdbConfig);
    const jobs = await pool.request().query(`
      SELECT j.job_id, j.name AS job_name, j.enabled, j.description
      FROM dbo.sysjobs j
      ORDER BY j.name
    `);
    const steps = await pool.request().query(`
      SELECT s.job_id, s.step_id, s.step_name, s.subsystem, s.command, s.database_name
      FROM dbo.sysjobsteps s
      ORDER BY s.job_id, s.step_id
    `);
    const sched = await pool.request().query(`
      SELECT js.job_id, s.name AS schedule_name, s.freq_type, s.freq_interval,
             s.freq_subday_type, s.freq_subday_interval, s.active_start_time
      FROM dbo.sysjobschedules js
      JOIN dbo.sysschedules s ON s.schedule_id = js.schedule_id
    `);
    await pool.close();

    const jobsById = new Map<string, any>();
    for (const j of jobs.recordset) jobsById.set(j.job_id, { ...j, steps: [], schedules: [] });
    for (const st of steps.recordset) jobsById.get(st.job_id)?.steps.push(st);
    for (const sc of sched.recordset) jobsById.get(sc.job_id)?.schedules.push(sc);
    safeWrite("agent-jobs.json", JSON.stringify([...jobsById.values()], null, 2));
    console.log(`  ${jobs.recordset.length} jobs, ${steps.recordset.length} steps, ${sched.recordset.length} schedules`);
    return jobs.recordset.length;
  } catch (e: any) {
    console.log(`  (msdb inaccessible: ${e.message?.slice(0, 80)})`);
    safeWrite("agent-jobs.json", JSON.stringify({ error: e.message }, null, 2));
    return 0;
  }
}

async function main() {
  console.log(`=== LamLinks Schema Dump ===`);
  console.log(`Output: ${OUT_DIR}\n`);

  // Reset output dir
  try { rmSync(OUT_DIR, { recursive: true, force: true }); } catch {}
  mkdirSync(OUT_DIR, { recursive: true });

  const pool = await sql.connect(config);
  const summary: string[] = [];

  const tableCount = await dumpTables(pool, summary);
  const fkCount = await dumpForeignKeys(pool);
  const ixCount = await dumpIndexes(pool);
  const trigCount = await dumpModules(pool, "triggers");
  const procCount = await dumpModules(pool, "procedures");
  const viewCount = await dumpModules(pool, "views");
  const fnCount = await dumpModules(pool, "functions");

  await pool.close();

  const jobCount = await dumpAgentJobs();

  // Master index
  const now = new Date().toISOString();
  const idx: string[] = [];
  idx.push(`# LamLinks \`llk_db1\` schema dump`);
  idx.push("");
  idx.push(`Generated ${now} by \`scripts/dump-lamlinks-schema.ts\`.`);
  idx.push("");
  idx.push(`## Counts`);
  idx.push(`- **Tables**: ${tableCount}`);
  idx.push(`- **Foreign keys**: ${fkCount} (see \`foreign-keys.txt\`)`);
  idx.push(`- **Indexes**: ${ixCount} (see \`indexes/\`)`);
  idx.push(`- **Triggers**: ${trigCount} (see \`triggers/\`)`);
  idx.push(`- **Stored procedures**: ${procCount} (see \`procedures/\`)`);
  idx.push(`- **Views**: ${viewCount} (see \`views/\`)`);
  idx.push(`- **Functions**: ${fnCount} (see \`functions/\`)`);
  idx.push(`- **SQL Agent jobs**: ${jobCount} (see \`agent-jobs.json\`)`);
  idx.push("");
  idx.push(`## Tables`);
  idx.push("");
  idx.push(...summary);
  safeWrite("_index.md", idx.join("\n"));

  console.log(`\n✅ Dump complete. Check ${OUT_DIR}/_index.md for the overview.`);
  console.log(`\nNext: grep the triggers/procedures for the incident pattern we're chasing.`);
  console.log(`   e.g.  grep -r "k33_tab" docs/lamlinks-schema/triggers/`);
  console.log(`         grep -r "o_stat_k33" docs/lamlinks-schema/procedures/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
