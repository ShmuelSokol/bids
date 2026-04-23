/**
 * Find the LamLinks table that holds per-CLIN ship-to destinations
 * (qty / destination / zip / tcn) for a solicitation line.
 *
 * Probing strategy:
 *   1. Start from a specific k11 row (sol_no + NSN) known to have multiple
 *      ship-tos. Any table with idnk11_* FK is a candidate.
 *   2. Dump its schema + sample rows so we can identify the right columns.
 *
 * Usage:
 *   npx tsx scripts/discover-ship-to.ts SPE2DS-26-T-1234 6515-01-XXX-XXXX
 * or if you don't know a good sol:
 *   npx tsx scripts/discover-ship-to.ts --find
 *     (picks the k11 with the highest child-table row count)
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const arg0 = process.argv[2];
  const arg1 = process.argv[3];
  const pool = await sql.connect(config);

  // k10_tab full schema — we also need buyer-name + required-delivery-days
  // for the Q-vs-T work. Bundling the dump here so one run covers all three
  // unknowns (ship-to table, buyer column, delivery-days column).
  console.log("=== k10_tab full schema (looking for buyer + delivery-days) ===");
  const k10cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='k10_tab'
    ORDER BY ORDINAL_POSITION
  `);
  for (const c of k10cols.recordset) {
    console.log(`  ${c.COLUMN_NAME.padEnd(20)} ${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : ""}`);
  }

  // One sample k10 row so we can see actual values
  if (arg0 && arg0 !== "--find") {
    console.log(`\n=== Sample k10 row for sol_no=${arg0} ===`);
    const k10 = await pool.request().input("sol", sql.VarChar, arg0).query(`SELECT TOP 1 * FROM k10_tab WHERE sol_no_k10 = @sol`);
    if (k10.recordset.length > 0) {
      const r = k10.recordset[0];
      for (const k of Object.keys(r)) {
        const v = r[k];
        const s = v instanceof Date ? v.toISOString() : String(v ?? "").trim();
        if (s && s !== "0") console.log(`  ${k.padEnd(20)} = ${s}`);
      }
    }
  }

  // Find every table with an idnk11_* column (FK to k11 → solicitation line)
  console.log("\n=== Tables with idnk11_* column (candidates for ship-to children) ===");
  const fks = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME LIKE 'idnk11[_]%'
      AND TABLE_NAME NOT LIKE '%_view'
      AND TABLE_NAME NOT LIKE '%_query'
      AND TABLE_NAME <> 'k11_tab'
    ORDER BY TABLE_NAME
  `);
  for (const f of fks.recordset) console.log(`  ${f.TABLE_NAME.padEnd(16)} . ${f.COLUMN_NAME}`);

  // Pick a target k11 id to probe.
  let idnk11: number | null = null;
  let context = "";
  if (arg0 === "--find") {
    console.log("\nFinding a k11 with several destination children...");
    // Aggregate: which table has a row where a single idnk11 has >1 entry?
    // Just pick the first candidate in the FK list and count.
    for (const f of fks.recordset) {
      const q = await pool.request().query(`
        SELECT TOP 1 ${f.COLUMN_NAME} AS id, COUNT(*) AS c
        FROM ${f.TABLE_NAME}
        GROUP BY ${f.COLUMN_NAME}
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
      `);
      if (q.recordset.length > 0) {
        idnk11 = q.recordset[0].id;
        context = `${f.TABLE_NAME}.${f.COLUMN_NAME} — ${q.recordset[0].c} children`;
        console.log(`  Picked ${context} (idnk11=${idnk11})`);
        break;
      }
    }
    if (!idnk11) { console.log("  No multi-destination k11 found (unusual)."); await pool.close(); return; }
  } else if (arg0 && arg1) {
    // Resolve the (sol, nsn) → idnk11
    const fsc = arg1.split("-")[0];
    const niin = arg1.split("-").slice(1).join("-");
    const r = await pool.request()
      .input("sol", sql.VarChar, arg0)
      .input("fsc", sql.VarChar, fsc)
      .input("niin", sql.VarChar, niin)
      .query(`
        SELECT TOP 1 k11.idnk11_k11 AS id
        FROM k11_tab k11
        JOIN k10_tab k10 ON k10.idnk10_k10 = k11.idnk10_k11
        JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
        WHERE k10.sol_no_k10 = @sol AND k08.fsc_k08 = @fsc AND k08.niin_k08 = @niin
      `);
    if (r.recordset.length === 0) { console.log(`No k11 row for ${arg0} / ${arg1}`); await pool.close(); return; }
    idnk11 = r.recordset[0].id;
    context = `${arg0} / ${arg1}`;
  } else {
    console.log("\nUsage: npx tsx scripts/discover-ship-to.ts <sol_no> <nsn>");
    console.log("   or: npx tsx scripts/discover-ship-to.ts --find");
    await pool.close();
    return;
  }

  console.log(`\n=== Probing idnk11_k11 = ${idnk11} (${context}) ===`);

  // For each child table, count rows + show first sample
  for (const f of fks.recordset) {
    try {
      const q = await pool.request()
        .input("id", sql.Int, idnk11)
        .query(`SELECT * FROM ${f.TABLE_NAME} WHERE ${f.COLUMN_NAME} = @id`);
      if (q.recordset.length === 0) continue;
      console.log(`\n--- ${f.TABLE_NAME} — ${q.recordset.length} row(s) ---`);
      // Print column names first
      const cols = await pool.request()
        .input("t", sql.VarChar, f.TABLE_NAME)
        .query(`
          SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
          FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=@t ORDER BY ORDINAL_POSITION
        `);
      console.log(`  Schema (${cols.recordset.length} cols):`);
      for (const c of cols.recordset) {
        console.log(`    ${c.COLUMN_NAME.padEnd(18)} ${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : ""}`);
      }
      console.log(`  First row (trimmed strings):`);
      const r = q.recordset[0];
      for (const k of Object.keys(r)) {
        const v = r[k];
        const s = v instanceof Date ? v.toISOString() : String(v ?? "").trim();
        if (s.length > 0 && s !== "0") console.log(`    ${k.padEnd(18)} = ${s}`);
      }
    } catch (e: any) {
      // Skip bad tables
    }
  }

  await pool.close();
  console.log("\nDone. Paste back the tables that looked like ship-to (qty / dest / zip / tcn columns) and I'll wire the import.");
}

main().catch((e) => { console.error(e); process.exit(1); });
