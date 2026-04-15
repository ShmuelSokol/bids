/**
 * Discover LamLinks stored procedures, triggers, and views that might
 * provide a safe entry point for inserting bids.
 *
 * If LamLinks has a sp_CreateBatch / sp_AddBid / usp_SubmitQuote proc,
 * calling it is much safer than raw INSERTs because the proc handles
 * all the validation, triggers, and side-effects LamLinks expects.
 *
 *   npx tsx scripts/discover-llk-procs.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const pool = await sql.connect(config);

  console.log("=== Stored procedures mentioning bid / quote / k33 / k34 / k35 ===");
  const procs = await pool.request().query(`
    SELECT
      s.name AS schema_name,
      p.name AS proc_name,
      p.create_date,
      p.modify_date
    FROM sys.procedures p
    JOIN sys.schemas s ON s.schema_id = p.schema_id
    WHERE p.name LIKE '%bid%'
       OR p.name LIKE '%quote%'
       OR p.name LIKE '%submit%'
       OR p.name LIKE '%k33%'
       OR p.name LIKE '%k34%'
       OR p.name LIKE '%k35%'
       OR p.name LIKE '%batch%'
    ORDER BY p.modify_date DESC
  `);
  console.log(`Found ${procs.recordset.length} matching procs:`);
  for (const p of procs.recordset) {
    console.log(`  ${p.schema_name}.${p.proc_name}  (modified ${p.modify_date?.toISOString().slice(0, 10)})`);
  }

  console.log("\n=== Triggers on k33_tab / k34_tab / k35_tab ===");
  const trigs = await pool.request().query(`
    SELECT
      t.name AS trigger_name,
      OBJECT_NAME(t.parent_id) AS table_name,
      t.type_desc,
      t.is_disabled
    FROM sys.triggers t
    WHERE OBJECT_NAME(t.parent_id) IN ('k33_tab', 'k34_tab', 'k35_tab')
    ORDER BY OBJECT_NAME(t.parent_id), t.name
  `);
  console.log(`Found ${trigs.recordset.length} triggers:`);
  for (const t of trigs.recordset) {
    console.log(`  ${t.table_name}.${t.trigger_name}  (${t.type_desc}${t.is_disabled ? " — DISABLED" : ""})`);
  }

  console.log("\n=== Columns on k33 / k34 / k35 with DEFAULT values ===");
  const defaults = await pool.request().query(`
    SELECT
      OBJECT_NAME(c.object_id) AS table_name,
      c.name AS column_name,
      dc.definition AS default_value
    FROM sys.columns c
    JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
    WHERE OBJECT_NAME(c.object_id) IN ('k33_tab', 'k34_tab', 'k35_tab')
    ORDER BY OBJECT_NAME(c.object_id), c.column_id
  `);
  console.log(`Found ${defaults.recordset.length} columns with DB-level defaults:`);
  for (const d of defaults.recordset) {
    console.log(`  ${d.table_name}.${d.column_name.padEnd(16)} default: ${d.default_value}`);
  }

  console.log("\n=== Constraints (unique / check / not null) on k33 / k34 / k35 ===");
  const constraints = await pool.request().query(`
    SELECT
      OBJECT_NAME(i.object_id) AS table_name,
      i.name AS constraint_name,
      i.type_desc AS type,
      STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
    FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE OBJECT_NAME(i.object_id) IN ('k33_tab', 'k34_tab', 'k35_tab')
      AND i.is_primary_key = 0
    GROUP BY OBJECT_NAME(i.object_id), i.name, i.type_desc, i.is_unique
  `);
  console.log(`Found ${constraints.recordset.length} non-PK indexes/constraints:`);
  for (const c of constraints.recordset) {
    console.log(`  ${c.table_name}.${c.constraint_name}  (${c.type}) on ${c.columns}`);
  }

  console.log("\n=== Not-null columns on k34_tab (would fail INSERT if we skip) ===");
  const notNull = await pool.request().query(`
    SELECT name, system_type_id, is_nullable
    FROM sys.columns
    WHERE object_id = OBJECT_ID('k34_tab') AND is_nullable = 0
    ORDER BY column_id
  `);
  console.log(`${notNull.recordset.length} NOT NULL columns:`);
  for (const c of notNull.recordset) console.log(`  ${c.name}`);

  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
