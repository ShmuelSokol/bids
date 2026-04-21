import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  const ABE_K34 = 495730;  // Abe's line 9 (known good)
  const OUR_K34 = 495731;  // our line 10

  // Find every table with an idnk34_* column
  const cols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME LIKE 'idnk34_%'
    ORDER BY TABLE_NAME
  `);
  const tables = await pool.request().query(`SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES`);
  const isBase = new Map<string, boolean>();
  for (const r of tables.recordset as any[]) isBase.set(r.TABLE_NAME, r.TABLE_TYPE === "BASE TABLE");

  console.log(`Tables with idnk34_* column — count of rows for Abe's line vs ours:\n`);
  for (const c of cols.recordset as any[]) {
    const t = c.TABLE_NAME;
    const col = c.COLUMN_NAME;
    if (!isBase.get(t)) continue;  // skip views
    try {
      const a = await pool.request().query(`SELECT COUNT(*) AS c FROM [${t}] WHERE [${col}] = ${ABE_K34}`);
      const o = await pool.request().query(`SELECT COUNT(*) AS c FROM [${t}] WHERE [${col}] = ${OUR_K34}`);
      const diff = a.recordset[0].c - o.recordset[0].c;
      const marker = diff !== 0 ? "  ⚠ MISSING ROWS" : "";
      console.log(`  ${t.padEnd(12)}.${col.padEnd(15)}  abe=${a.recordset[0].c}  ours=${o.recordset[0].c}${marker}`);
    } catch (e: any) { /* skip */ }
  }

  // Also look at tables that reference idnk33 — same diff
  console.log(`\nTables with idnk33_* column — Abe's envelope 46852 child counts (historical vs now):\n`);
  const cols33 = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME LIKE 'idnk33_%'
    ORDER BY TABLE_NAME
  `);
  for (const c of cols33.recordset as any[]) {
    const t = c.TABLE_NAME;
    const col = c.COLUMN_NAME;
    if (!isBase.get(t)) continue;
    try {
      const cnt = await pool.request().query(`SELECT COUNT(*) AS c FROM [${t}] WHERE [${col}] = 46852`);
      if (cnt.recordset[0].c > 0) console.log(`  ${t.padEnd(12)}.${col.padEnd(15)}  env=46852 rows=${cnt.recordset[0].c}`);
    } catch (e: any) { /* skip */ }
  }

  // Show any recent rows Abe touched during line-save flow on envelope 46852
  // — e.g. activity in the last hour by ajoseph in any table
  console.log(`\nTables with rows modified in last 30 minutes by ajoseph:\n`);
  const upCols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME LIKE 'upname_%'
  `);
  for (const c of upCols.recordset as any[]) {
    const t = c.TABLE_NAME;
    const col = c.COLUMN_NAME;
    const timeCol = col.replace("upname", "uptime");
    if (!isBase.get(t)) continue;
    try {
      const r = await pool.request().query(`
        SELECT COUNT(*) AS c FROM [${t}]
        WHERE [${col}] LIKE 'ajoseph%' AND [${timeCol}] > DATEADD(minute, -30, GETDATE())
      `);
      if (r.recordset[0].c > 0) console.log(`  ${t}: ${r.recordset[0].c} rows`);
    } catch (e: any) { /* skip */ }
  }

  await pool.close();
}
main().catch(console.error);
