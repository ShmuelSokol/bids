/**
 * Surgically remove a single k34 line (+ its k35 price row) from a quote
 * envelope that can't post because of the "Update conflict in cursor"
 * bug, and decrement k33.itmcnt_k33 so LL sees a consistent envelope.
 *
 * Use cases:
 *   - Abe added a manual line that LL's UI refuses to delete and the
 *     mixed DIBS+manual envelope won't Post.
 *   - Last-resort rescue to unstick a specific quote without touching
 *     the other lines.
 *
 * Usage (local, needs NYEVRVSQL001 Windows Auth):
 *   npx tsx scripts/ll-remove-k34-line.ts <idnk34>
 *
 * Verifies first. Prints the row it's about to delete. Requires explicit
 * confirmation (--yes) before actually doing it.
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const idnk34 = Number(process.argv[2]);
  const confirmed = process.argv.includes("--yes");
  if (!idnk34) {
    console.error("Usage: npx tsx scripts/ll-remove-k34-line.ts <idnk34> [--yes]");
    process.exit(1);
  }

  const pool = await sql.connect(config);

  // 1. Read the target k34 + its k35s + parent k33
  const k34r = await pool.request().input("id", sql.Int, idnk34).query(`
    SELECT k34.*, k33.o_stat_k33, k33.itmcnt_k33, k33.qotref_k33
    FROM k34_tab k34 JOIN k33_tab k33 ON k33.idnk33_k33 = k34.idnk33_k34
    WHERE k34.idnk34_k34 = @id
  `);
  if (k34r.recordset.length === 0) {
    console.log(`k34=${idnk34} not found`);
    await pool.close();
    return;
  }
  const row = k34r.recordset[0];
  console.log("=== Target k34 line ===");
  console.log(`  idnk34_k34       = ${row.idnk34_k34}`);
  console.log(`  idnk33_k34       = ${row.idnk33_k34}  (envelope ${row.qotref_k33})`);
  console.log(`  idnk11_k34       = ${row.idnk11_k34}`);
  console.log(`  pn_k34           = ${row.pn_k34}`);
  console.log(`  mcage_k34        = ${row.mcage_k34}`);
  console.log(`  qty_ui_k34       = ${row.qty_ui_k34}`);
  console.log(`  solqty_k34       = ${row.solqty_k34}`);
  console.log(`  upname_k34       = ${row.upname_k34}`);
  console.log(`  uptime_k34       = ${row.uptime_k34?.toISOString?.() || row.uptime_k34}`);
  console.log(`  envelope.status  = ${String(row.o_stat_k33 || "").trim()}`);
  console.log(`  envelope.itmcnt  = ${row.itmcnt_k33}`);

  if (String(row.o_stat_k33 || "").trim() !== "adding quotes") {
    console.log("\n❌ Envelope is NOT in 'adding quotes' state — refusing to edit a posted/locked envelope.");
    await pool.close();
    return;
  }

  const k35r = await pool.request().input("id", sql.Int, idnk34).query(`
    SELECT idnk35_k35, qty_k35, up_k35 FROM k35_tab WHERE idnk34_k35 = @id
  `);
  console.log(`\n=== Associated k35 rows (${k35r.recordset.length}) ===`);
  for (const r of k35r.recordset) {
    console.log(`  k35=${r.idnk35_k35}  qty=${r.qty_k35}  price=$${r.up_k35}`);
  }

  if (!confirmed) {
    console.log("\nThis will:");
    console.log(`  1. DELETE ${k35r.recordset.length} k35 row(s) under k34=${idnk34}`);
    console.log(`  2. DELETE k34 row ${idnk34}`);
    console.log(`  3. UPDATE k33 row ${row.idnk33_k34}: itmcnt_k33 = ${row.itmcnt_k33} - 1 = ${row.itmcnt_k33 - 1}`);
    console.log("\nRe-run with --yes to execute.");
    await pool.close();
    return;
  }

  // 2. Transactional delete + itmcnt decrement
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).input("id", sql.Int, idnk34).query(`DELETE FROM k35_tab WHERE idnk34_k35 = @id`);
    await new sql.Request(tx).input("id", sql.Int, idnk34).query(`DELETE FROM k34_tab WHERE idnk34_k34 = @id`);
    await new sql.Request(tx)
      .input("k33", sql.Int, row.idnk33_k34)
      .query(`UPDATE k33_tab SET itmcnt_k33 = itmcnt_k33 - 1, uptime_k33 = GETDATE() WHERE idnk33_k33 = @k33`);
    await tx.commit();
    console.log(`\n✅ Removed k34=${idnk34} and ${k35r.recordset.length} k35 row(s). Envelope itmcnt decremented.`);
    console.log(`   Abe should close + reopen the envelope in LL, verify 4 lines, and Post.`);
  } catch (e: any) {
    await tx.rollback();
    console.error(`\n❌ Rolled back: ${e.message}`);
  } finally {
    await pool.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
