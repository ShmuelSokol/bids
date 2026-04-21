import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });

  // Full k33/k34/k35 schema with nullability, types, defaults
  console.log("k33_tab full schema:\n");
  const s33 = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'k33_tab'
    ORDER BY ORDINAL_POSITION
  `);
  for (const c of s33.recordset as any[]) {
    console.log(`  ${c.COLUMN_NAME.padEnd(18)} ${(c.DATA_TYPE + (c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : "")).padEnd(15)} NULL=${c.IS_NULLABLE.padEnd(3)} DEF=${c.COLUMN_DEFAULT || ""}`);
  }

  console.log("\nk34_tab full schema:\n");
  const s34 = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'k34_tab'
    ORDER BY ORDINAL_POSITION
  `);
  for (const c of s34.recordset as any[]) {
    console.log(`  ${c.COLUMN_NAME.padEnd(18)} ${(c.DATA_TYPE + (c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : "")).padEnd(15)} NULL=${c.IS_NULLABLE.padEnd(3)} DEF=${c.COLUMN_DEFAULT || ""}`);
  }

  console.log("\nk35_tab full schema:\n");
  const s35 = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'k35_tab'
    ORDER BY ORDINAL_POSITION
  `);
  for (const c of s35.recordset as any[]) {
    console.log(`  ${c.COLUMN_NAME.padEnd(18)} ${(c.DATA_TYPE + (c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : "")).padEnd(15)} NULL=${c.IS_NULLABLE.padEnd(3)} DEF=${c.COLUMN_DEFAULT || ""}`);
  }

  // Triggers on k33/k34/k35 — may reveal EDI send logic
  console.log("\n\nTriggers on k33/k34/k35:\n");
  const trg = await pool.request().query(`
    SELECT t.name AS trigger_name, OBJECT_NAME(t.parent_id) AS table_name, t.is_disabled
    FROM sys.triggers t
    WHERE OBJECT_NAME(t.parent_id) IN ('k33_tab','k34_tab','k35_tab')
  `);
  for (const r of trg.recordset as any[]) console.log(`  ${r.table_name} → ${r.trigger_name} (disabled=${r.is_disabled})`);

  // Find any scheduled job or SQL Agent reference
  console.log("\n\nStored procedures referencing k33/k34/k35:\n");
  const procs = await pool.request().query(`
    SELECT DISTINCT OBJECT_NAME(object_id) AS name
    FROM sys.sql_modules
    WHERE definition LIKE '%k33_tab%' OR definition LIKE '%k34_tab%' OR definition LIKE '%k35_tab%'
  `);
  for (const r of procs.recordset as any[]) console.log(`  ${r.name}`);

  await pool.close();
}
main().catch(console.error);
