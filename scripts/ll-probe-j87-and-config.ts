/**
 * Probe llk_db1 for:
 *   1. j87_tab existence + recent activity (is the local LLSM/LIS bot queue live?)
 *   2. All tables containing "api" or "ssymbol" in the name (where might api_key be stored?)
 *   3. All anutyp_kah values a second time, broader — specifically looking for an api_key bucket
 *   4. A direct search in all kah_tab memos for content that looks like a 27-char api_key
 *
 *   npx tsx scripts/ll-probe-j87-and-config.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const pool = await sql.connect(config);

  console.log(`\n=== 1. j87_tab — does it exist, and is it active? ===`);
  const j87exists = await pool.request().query(`
    SELECT name FROM sys.objects WHERE type = 'U' AND name LIKE 'j87%'
  `);
  if (j87exists.recordset.length === 0) {
    console.log(`  (no j87_tab in llk_db1)`);
  } else {
    for (const r of j87exists.recordset) console.log(`  table: ${r.name}`);
    const j87cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'j87_tab'
      ORDER BY ORDINAL_POSITION
    `);
    console.log(`  columns:`);
    for (const c of j87cols.recordset) {
      console.log(`    ${c.COLUMN_NAME.padEnd(22)} ${c.DATA_TYPE.padEnd(10)} ${c.CHARACTER_MAXIMUM_LENGTH ?? ""}`);
    }

    // Summary of recent activity
    const reqColGuess = j87cols.recordset.map((c: any) => c.COLUMN_NAME.toLowerCase()).find((n: string) => n.includes("reqtme") || n.includes("addtme") || n.includes("time"));
    if (reqColGuess) {
      const recent = await pool.request().query(`
        SELECT TOP 10 *
        FROM j87_tab
        ORDER BY ${reqColGuess} DESC
      `);
      console.log(`\n  recent ${recent.recordset.length} rows (by ${reqColGuess}):`);
      for (const r of recent.recordset) {
        const fields = Object.entries(r)
          .filter(([k, v]) => v != null && !(v instanceof Buffer))
          .map(([k, v]) => {
            const s = String(v);
            return `${k}=${s.length > 50 ? s.slice(0, 47) + "..." : s}`;
          })
          .slice(0, 6);
        console.log(`    ${fields.join("  ")}`);
      }
      const countToday = await pool.request().query(`
        SELECT
          (SELECT COUNT(*) FROM j87_tab WHERE ${reqColGuess} > DATEADD(day, -1, GETDATE())) AS last_24h,
          (SELECT COUNT(*) FROM j87_tab WHERE ${reqColGuess} > DATEADD(day, -7, GETDATE())) AS last_7d,
          (SELECT COUNT(*) FROM j87_tab) AS total
      `);
      const c = countToday.recordset[0];
      console.log(`\n  activity: ${c.last_24h} rows in last 24h, ${c.last_7d} in last 7d, ${c.total} lifetime`);
    }
  }

  console.log(`\n=== 2. Tables in llk_db1 whose name hints at API / config / ssymbol storage ===`);
  const apiTables = await pool.request().query(`
    SELECT name FROM sys.objects
    WHERE type = 'U'
      AND (name LIKE '%api%' OR name LIKE '%cred%' OR name LIKE '%auth%'
           OR name LIKE '%ssymbol%' OR name LIKE '%ss_%' OR name LIKE '%cx0%'
           OR name LIKE '%config%' OR name LIKE '%k20%' OR name LIKE '%kdg%')
    ORDER BY name
  `);
  for (const r of apiTables.recordset) console.log(`  ${r.name}`);

  console.log(`\n=== 3. kah_tab: anutyp values we might have missed + all that contain 'api' or 'sally' ===`);
  const kah2 = await pool.request().query(`
    SELECT anutyp_kah, COUNT(*) AS n
    FROM kah_tab
    WHERE LOWER(anutyp_kah) LIKE '%api%'
       OR LOWER(anutyp_kah) LIKE '%sally%'
       OR LOWER(anutyp_kah) LIKE '%cred%'
       OR LOWER(anutyp_kah) LIKE '%auth%'
       OR LOWER(anutyp_kah) LIKE '%key%'
    GROUP BY anutyp_kah
  `);
  for (const r of kah2.recordset) console.log(`  ${String(r.anutyp_kah).padEnd(40)} ${r.n}`);

  console.log(`\n=== 4. Any kah memo containing 7Lx prefix (client api_key) or 27-char token? ===`);
  const search = await pool.request().query(`
    SELECT TOP 20 anutyp_kah, anutbl_kah, idnanu_kah, LEN(CAST(a_note_kah AS nvarchar(max))) AS mlen
    FROM kah_tab
    WHERE CAST(a_note_kah AS nvarchar(max)) LIKE '%7Lx%'
       OR CAST(a_note_kah AS nvarchar(max)) LIKE '%api_key%'
       OR CAST(a_note_kah AS nvarchar(max)) LIKE '%private_key%'
       OR CAST(a_note_kah AS nvarchar(max)) LIKE '%public_key%'
  `);
  if (search.recordset.length === 0) {
    console.log(`  (no kah row contains the api_key markers — api_key is NOT in kah_tab)`);
  } else {
    for (const r of search.recordset) {
      console.log(`  anutyp=${r.anutyp_kah} anutbl=${r.anutbl_kah} idnanu=${r.idnanu_kah} len=${r.mlen}`);
    }
  }

  console.log(`\n=== 5. kdg_tab (credential control) sample ===`);
  try {
    const kdgcols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'kdg_tab' ORDER BY ORDINAL_POSITION
    `);
    if (kdgcols.recordset.length === 0) console.log(`  (no kdg_tab)`);
    else {
      for (const c of kdgcols.recordset) console.log(`  ${c.COLUMN_NAME.padEnd(22)} ${c.DATA_TYPE}`);
      const kdgrows = await pool.request().query(`SELECT TOP 10 * FROM kdg_tab`);
      console.log(`  total_sample_rows: ${kdgrows.recordset.length}`);
      for (const r of kdgrows.recordset) {
        const s = Object.entries(r).map(([k, v]) => `${k}=${String(v).slice(0, 30)}`).join(" ");
        console.log(`    ${s}`);
      }
    }
  } catch (e: any) {
    console.log(`  error: ${e.message?.slice(0, 80)}`);
  }

  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
