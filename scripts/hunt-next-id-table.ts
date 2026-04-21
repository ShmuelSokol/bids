import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // 1. Columns with "next", "seq", "last", "counter" in the name
  console.log("=== Columns with 'next', 'seq', 'last', 'counter', 'ctr', 'max' in name ===");
  const cols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME LIKE '%next%' OR COLUMN_NAME LIKE '%_seq%' OR COLUMN_NAME LIKE '%seq_%'
       OR COLUMN_NAME LIKE '%counter%' OR COLUMN_NAME LIKE '%ctr%' OR COLUMN_NAME LIKE 'max%'
       OR COLUMN_NAME LIKE '%last_id%' OR COLUMN_NAME LIKE '%lastid%' OR COLUMN_NAME LIKE '%newid%'
  `);
  for (const r of cols.recordset as any[]) {
    console.log(`  ${r.TABLE_NAME.padEnd(20)}.${r.COLUMN_NAME.padEnd(20)} ${r.DATA_TYPE}`);
  }

  // 2. Any row where a value exactly equals Abe's counter (495750 or 495751 or 495752)
  // Scan integer columns in all base tables.
  console.log("\n=== Hunting for a table where some cell = 495750, 495751, or 495752 ===");
  const intCols = await pool.request().query(`
    SELECT c.TABLE_NAME, c.COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS c
    INNER JOIN INFORMATION_SCHEMA.TABLES t ON c.TABLE_NAME = t.TABLE_NAME
    WHERE c.DATA_TYPE = 'int' AND t.TABLE_TYPE = 'BASE TABLE'
      AND c.TABLE_NAME NOT IN ('k34_tab')  -- exclude k34 itself
  `);
  console.log(`  Scanning ${intCols.recordset.length} int columns...`);
  let hits = 0;
  for (const c of intCols.recordset as any[]) {
    try {
      const r = await pool.request().query(`
        SELECT TOP 3 [${c.COLUMN_NAME}] AS v FROM [${c.TABLE_NAME}]
        WHERE [${c.COLUMN_NAME}] IN (495750, 495751, 495752)
      `);
      if (r.recordset.length > 0) {
        console.log(`  ${c.TABLE_NAME}.${c.COLUMN_NAME}: ${r.recordset.map((x: any) => x.v).join(",")}`);
        hits++;
      }
    } catch (e: any) { /* skip */ }
  }
  if (hits === 0) console.log(`  No hits — no "next id" counter stored in SQL.`);

  // 3. Small config-looking tables
  console.log("\n=== Tables with < 100 rows and 'config', 'setting', 'seq', 'next' in name ===");
  const small = await pool.request().query(`
    SELECT t.TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES t
    WHERE t.TABLE_TYPE = 'BASE TABLE'
      AND (t.TABLE_NAME LIKE '%config%' OR t.TABLE_NAME LIKE '%setting%'
           OR t.TABLE_NAME LIKE '%seq%' OR t.TABLE_NAME LIKE '%next%' OR t.TABLE_NAME LIKE '%counter%')
  `);
  for (const r of small.recordset as any[]) console.log(`  ${r.TABLE_NAME}`);

  // 4. Look inside k07_tab (session/prefs) for anything resembling a counter
  console.log("\n=== k07_tab entries with numeric-looking ss_val (sample 20) ===");
  const k07 = await pool.request().query(`
    SELECT TOP 20 idnk07_k07, upname_k07, ss_key_k07, ss_val_k07
    FROM k07_tab
    WHERE ss_val_k07 LIKE '%495[0-9][0-9][0-9]%'
       OR ss_key_k07 LIKE '%k34%' OR ss_key_k07 LIKE '%k35%'
       OR ss_key_k07 LIKE '%NEXT%' OR ss_key_k07 LIKE '%SEQ%' OR ss_key_k07 LIKE '%COUNTER%'
  `);
  for (const r of k07.recordset as any[]) console.log(`  ${r.upname_k07?.trim()} | ${r.ss_key_k07?.trim()} = ${(r.ss_val_k07 || "").slice(0, 80)}`);

  await pool.close();
}
main().catch(console.error);
