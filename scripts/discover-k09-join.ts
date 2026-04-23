/**
 * Step 2 of the file-reference discovery:
 *   - dump the full k09_tab schema (looking for an internal EDI ref column)
 *   - list every table that has an idnk09_* column (i.e. points to k09)
 *   - count how many items link to idnk09_k09 = <pk> (should match Abe's item count)
 *
 * Usage:
 *   npx tsx scripts/discover-k09-join.ts 8903
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const idnk09 = Number(process.argv[2]);
  if (!idnk09) {
    console.error("Usage: npx tsx scripts/discover-k09-join.ts <idnk09_k09>");
    process.exit(1);
  }
  const pool = await sql.connect(config);

  // 1. Full k09 schema
  console.log("=== k09_tab full schema ===");
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='k09_tab'
    ORDER BY ORDINAL_POSITION
  `);
  for (const c of cols.recordset) {
    console.log(`  ${c.COLUMN_NAME.padEnd(20)} ${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : ""}`);
  }

  // 2. One full row for context
  console.log(`\n=== Sample row for idnk09_k09=${idnk09} ===`);
  const sample = await pool.request().input("id", sql.Int, idnk09).query(`
    SELECT * FROM k09_tab WHERE idnk09_k09 = @id
  `);
  if (sample.recordset.length === 0) {
    console.log(`  (no row — PK doesn't exist; double-check the number)`);
  } else {
    const r = sample.recordset[0];
    for (const k of Object.keys(r)) {
      const v = r[k];
      const s = v instanceof Date ? v.toISOString() : String(v ?? "").trim();
      console.log(`  ${k.padEnd(20)} = ${s}`);
    }
  }

  // 3. Every table with a FK-looking column pointing at k09
  console.log("\n=== Tables with an idnk09_* column (potential FK to k09) ===");
  const fks = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME LIKE 'idnk09[_]%'
      AND TABLE_NAME <> 'k09_tab'
    ORDER BY TABLE_NAME
  `);
  for (const f of fks.recordset) {
    console.log(`  ${f.TABLE_NAME.padEnd(16)} . ${f.COLUMN_NAME}`);
  }

  // 4. For each candidate table, count rows under this k09
  console.log(`\n=== Row counts under idnk09_k09=${idnk09} per candidate table ===`);
  for (const f of fks.recordset) {
    try {
      const c = await pool.request()
        .input("id", sql.Int, idnk09)
        .query(`SELECT COUNT(*) AS c FROM ${f.TABLE_NAME} WHERE ${f.COLUMN_NAME} = @id`);
      console.log(`  ${f.TABLE_NAME.padEnd(16)}  ${String(c.recordset[0].c).padStart(6)}  rows`);
    } catch (e: any) {
      console.log(`  ${f.TABLE_NAME.padEnd(16)}  error: ${e.message?.slice(0, 60)}`);
    }
  }

  // 5. If k10 points to k09, count solicitations + items
  const k10HasK09 = fks.recordset.find((f: any) => f.TABLE_NAME === "k10_tab");
  if (k10HasK09) {
    const col = k10HasK09.COLUMN_NAME;
    const q = await pool.request().input("id", sql.Int, idnk09).query(`
      SELECT
        (SELECT COUNT(DISTINCT k10.sol_no_k10) FROM k10_tab k10 WHERE k10.${col} = @id) AS solicitations,
        (SELECT COUNT(*) FROM k10_tab k10
          JOIN k11_tab k11 ON k11.idnk10_k11 = k10.idnk10_k10
          WHERE k10.${col} = @id) AS items
    `);
    console.log(`\n=== Final derived counts under idnk09=${idnk09} ===`);
    console.log(`  Solicitations (distinct k10): ${q.recordset[0].solicitations}`);
    console.log(`  Items (k11 line items)      : ${q.recordset[0].items}`);
  } else {
    console.log(`\n  (k10_tab does NOT have an idnk09_* column — the join must be via another table — check the FK list above.)`);
  }

  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
