/**
 * Find where LamLinks stores the "file reference" Abe organizes his day by
 * (format "8916-156-1626"). We don't import it yet; need to know which
 * column holds it before adding it to dibbs_solicitations + the UI.
 *
 * Strategy: discover every text column on k10_tab (and a few adjacent
 * tables that might hold EDI envelope metadata), then search each one
 * for the known reference value passed as an argument.
 *
 * Usage:
 *   npx tsx scripts/discover-file-reference.ts 8916-156-1626
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const ref = process.argv[2];
  if (!ref) {
    console.error("Usage: npx tsx scripts/discover-file-reference.ts <file-ref>");
    console.error("Example: npx tsx scripts/discover-file-reference.ts 8916-156-1626");
    process.exit(1);
  }
  console.log(`Searching LamLinks for "${ref}"\n`);

  const pool = await sql.connect(config);

  // Every table that likely holds envelope / batch / file metadata.
  // k10_tab is the solicitation header — most likely candidate. Others
  // are guesses based on LamLinks naming (we've seen k01/k02/k09 before
  // as parent envelope-ish tables).
  const tablesToTry = [
    "k10_tab", "k11_tab", "k09_tab", "k01_tab", "k02_tab", "k03_tab", "k04_tab",
    "k05_tab", "k06_tab", "k07_tab", "ke0_tab", "ke1_tab", "ke9_tab",
  ];

  for (const table of tablesToTry) {
    // Does the table exist?
    const existsQ = await pool.request()
      .input("t", sql.VarChar, table)
      .query("SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @t");
    if ((existsQ.recordset[0]?.c || 0) === 0) continue;

    // Get text columns
    const colsQ = await pool.request()
      .input("t", sql.VarChar, table)
      .query(`
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @t
          AND DATA_TYPE IN ('varchar','nvarchar','char','nchar','text','ntext')
      `);
    const cols = colsQ.recordset;
    if (cols.length === 0) continue;

    console.log(`\n=== ${table} — ${cols.length} text columns, scanning for "${ref}"...`);
    for (const c of cols) {
      const col = c.COLUMN_NAME;
      try {
        const hitQ = await pool.request()
          .input("ref", sql.VarChar, ref)
          .query(`SELECT TOP 5 * FROM ${table} WHERE ${col} LIKE '%' + @ref + '%'`);
        if (hitQ.recordset.length > 0) {
          console.log(`  ✓ HIT in ${table}.${col} — ${hitQ.recordset.length} sample row(s):`);
          for (const r of hitQ.recordset) {
            // Print only the matching column + any ID + a few hints
            const summary: any = { [col]: r[col] };
            for (const k of Object.keys(r)) {
              if (k === col) continue;
              if (/^idn/i.test(k) || /date|dte/i.test(k) || /sol/i.test(k)) {
                summary[k] = r[k];
              }
            }
            console.log("   ", JSON.stringify(summary));
          }
        }
      } catch (e: any) {
        // Some columns have bad collations or types that LIKE-breaks — skip
        console.log(`    (skipped ${col}: ${e.message?.slice(0, 60)})`);
      }
    }
  }

  await pool.close();
  console.log("\nDone. If nothing hit, the reference lives in a table we haven't listed — paste the output back and I'll expand the search.");
}

main().catch((e) => { console.error(e); process.exit(1); });
