import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // 1. Every table or view column that holds idnk34
  console.log("=== All columns named idnk34_* across the DB ===");
  const cols = await pool.request().query(`
    SELECT t.TABLE_TYPE, c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS c
    INNER JOIN INFORMATION_SCHEMA.TABLES t ON c.TABLE_NAME = t.TABLE_NAME
    WHERE c.COLUMN_NAME LIKE 'idnk34_%'
    ORDER BY t.TABLE_TYPE, c.TABLE_NAME
  `);
  for (const r of cols.recordset as any[]) console.log(`  ${r.TABLE_TYPE.padEnd(10)} ${r.TABLE_NAME}.${r.COLUMN_NAME}`);

  // 2. Any view/proc text mentioning idnk34 (case-insensitive, beyond the obvious k34_tab/k35_tab)
  console.log("\n=== Views referencing idnk34 (dependency map) ===");
  const views = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS
    WHERE VIEW_DEFINITION LIKE '%idnk34%'
    ORDER BY TABLE_NAME
  `);
  for (const r of views.recordset as any[]) console.log(`  ${r.TABLE_NAME}`);

  console.log("\n=== Stored procedures referencing idnk34 ===");
  const procs = await pool.request().query(`
    SELECT OBJECT_NAME(object_id) AS name
    FROM sys.sql_modules
    WHERE definition LIKE '%idnk34%'
      AND OBJECT_NAME(object_id) NOT IN (
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS
      )
  `);
  for (const r of procs.recordset as any[]) console.log(`  ${r.name}`);

  // 3. For BASE TABLEs with an idnk34_* column — do any of them have rows pointing at
  //    our original (pre-move) ids 495751 or 495752? If so, those are stale refs.
  console.log("\n=== Base tables with rows referencing the OLD ids 495751 or 495752 ===");
  for (const r of cols.recordset as any[]) {
    if (r.TABLE_TYPE !== "BASE TABLE") continue;
    if (r.TABLE_NAME === "k34_tab") continue;  // that's the source table we moved
    if (r.TABLE_NAME === "k35_tab") continue;  // we updated k35 as part of the move
    try {
      const q = await pool.request().query(`
        SELECT COUNT(*) AS c FROM [${r.TABLE_NAME}] WHERE [${r.COLUMN_NAME}] IN (495751, 495752)
      `);
      if (q.recordset[0].c > 0) {
        console.log(`  ⚠ ${r.TABLE_NAME}.${r.COLUMN_NAME}: ${q.recordset[0].c} row(s) point to OLD id — STALE`);
        const sample = await pool.request().query(`
          SELECT TOP 3 * FROM [${r.TABLE_NAME}] WHERE [${r.COLUMN_NAME}] IN (495751, 495752)
        `);
        for (const s of sample.recordset as any[]) console.log(`      ${JSON.stringify(s).slice(0, 200)}`);
      } else {
        console.log(`  ✓ ${r.TABLE_NAME}.${r.COLUMN_NAME}: 0 stale refs`);
      }
    } catch (e: any) {
      console.log(`  ? ${r.TABLE_NAME}.${r.COLUMN_NAME}: ${e.message.slice(0, 50)}`);
    }
  }

  // 4. Verify award flow — how does k81 (awards) link back to bids?
  console.log("\n=== k81_tab columns (awards table) — does it reference k34 at all? ===");
  const k81Cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'k81_tab' ORDER BY ORDINAL_POSITION
  `);
  for (const c of k81Cols.recordset as any[]) console.log(`  ${c.COLUMN_NAME.padEnd(18)} ${c.DATA_TYPE}`);

  console.log("\n=== Historical bid→award chain: sample award for a sol Abe won ===");
  // Sample an award and trace it back — does the lookup go through idnk34 or just sol?
  const sampleAward = await pool.request().query(`
    SELECT TOP 1 k81.idnk81_k81, k81.idnk80_k81, k81.idnk71_k81,
           k80.piidno_k80, k80.idnk79_k80,
           k79.idnk31_k79
    FROM k81_tab k81
    INNER JOIN k80_tab k80 ON k81.idnk80_k81 = k80.idnk80_k80
    INNER JOIN k79_tab k79 ON k80.idnk79_k80 = k79.idnk79_k79
    WHERE k81.upname_k81 LIKE 'ajoseph%'
    ORDER BY k81.idnk81_k81 DESC
  `);
  for (const r of sampleAward.recordset as any[]) console.log(`  ${JSON.stringify(r)}`);

  // 5. k63_tab was the one table earlier that COULD reference our k34 — re-verify it's
  // still 0 rows for our NEW ids (123621, 123622) as well
  console.log("\n=== k63_tab — any refs to our NEW ids 123621 / 123622 or OLD 495751 / 495752? ===");
  const k63 = await pool.request().query(`
    SELECT COUNT(*) AS c FROM k63_tab WHERE idnk34_k63 IN (123621, 123622, 495751, 495752)
  `);
  console.log(`  ${k63.recordset[0].c} rows`);

  await pool.close();
}
main().catch(console.error);
