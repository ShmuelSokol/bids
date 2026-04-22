import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Yosef's hypothesis: a SQL table holds "next available number per id type".
  // Such a table typically: (a) has very few rows, (b) has a name/text key column
  // identifying the id type, and (c) has an int column holding the value.
  // Current MAX(idnk34)=495752, so "next" would be 495753.

  // 1. Broad scan: ANY int column in ANY base table where some cell holds a
  // value in the range 495753..496000 (just above current MAX). These are
  // candidates for "next counter value" storage.
  console.log("=== Cells with int value 495753..496000 (just above k34 MAX) ===");
  const intCols = await pool.request().query(`
    SELECT c.TABLE_NAME, c.COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS c
    INNER JOIN INFORMATION_SCHEMA.TABLES t ON c.TABLE_NAME = t.TABLE_NAME
    WHERE c.DATA_TYPE IN ('int','bigint','numeric') AND t.TABLE_TYPE = 'BASE TABLE'
      AND c.TABLE_NAME NOT IN ('k34_tab','k35_tab')  -- exclude the source
  `);
  console.log(`  scanning ${intCols.recordset.length} int/numeric columns...`);
  let hits = 0;
  for (const c of intCols.recordset as any[]) {
    try {
      const r = await pool.request().query(`
        SELECT TOP 3 [${c.COLUMN_NAME}] AS v FROM [${c.TABLE_NAME}]
        WHERE [${c.COLUMN_NAME}] BETWEEN 495753 AND 496000
      `);
      if (r.recordset.length > 0) {
        hits++;
        console.log(`  ★ ${c.TABLE_NAME}.${c.COLUMN_NAME}: ${r.recordset.map((x: any) => x.v).join(",")}`);
      }
    } catch (e: any) { /* skip */ }
  }
  if (hits === 0) console.log("  (none — no int column near 495753)");

  // 2. Same for k35 MAX = 503389, so candidates 503390..503500
  console.log("\n=== Cells with int value 503390..503500 (just above k35 MAX) ===");
  hits = 0;
  for (const c of intCols.recordset as any[]) {
    try {
      const r = await pool.request().query(`
        SELECT TOP 3 [${c.COLUMN_NAME}] AS v FROM [${c.TABLE_NAME}]
        WHERE [${c.COLUMN_NAME}] BETWEEN 503390 AND 503500
      `);
      if (r.recordset.length > 0) {
        hits++;
        console.log(`  ★ ${c.TABLE_NAME}.${c.COLUMN_NAME}: ${r.recordset.map((x: any) => x.v).join(",")}`);
      }
    } catch (e: any) { /* skip */ }
  }
  if (hits === 0) console.log("  (none)");

  // 3. Dump every small table (<=100 rows) completely. Manual inspection.
  console.log("\n=== Small tables (<=200 rows) — full content for manual inspection ===");
  const smallTables = await pool.request().query(`
    SELECT t.TABLE_NAME, p.rows
    FROM INFORMATION_SCHEMA.TABLES t
    INNER JOIN sys.tables st ON st.name = t.TABLE_NAME
    INNER JOIN sys.partitions p ON p.object_id = st.object_id AND p.index_id IN (0,1)
    WHERE t.TABLE_TYPE = 'BASE TABLE' AND p.rows BETWEEN 1 AND 200
    ORDER BY p.rows, t.TABLE_NAME
  `);
  console.log(`  ${smallTables.recordset.length} small tables to inspect\n`);

  for (const t of smallTables.recordset as any[]) {
    // For each small table, dump columns + a few sample rows
    const cols = await pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t.TABLE_NAME}' ORDER BY ORDINAL_POSITION`);
    const colList = cols.recordset.map((c: any) => `${c.COLUMN_NAME}(${c.DATA_TYPE})`).join(", ");
    console.log(`  ${t.TABLE_NAME} (${t.rows} rows): ${colList.slice(0, 200)}${colList.length > 200 ? "..." : ""}`);

    // Dump first 3 rows if any of the columns is text or numeric (promising counter shape)
    try {
      const r = await pool.request().query(`SELECT TOP 3 * FROM [${t.TABLE_NAME}]`);
      for (const row of r.recordset as any[]) {
        const summary = Object.entries(row).slice(0, 6).map(([k, v]) => {
          if (v === null) return `${k}=null`;
          const s = v instanceof Date ? v.toISOString() : typeof v === "string" ? v.trim().slice(0, 20) : String(v);
          return `${k}=${s}`;
        }).join(" | ");
        console.log(`      ${summary}`);
      }
    } catch (e: any) { /* skip */ }
  }

  await pool.close();
}
main().catch(console.error);
