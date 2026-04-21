// Remove our test line entirely — envelope returns to exactly the state
// Abe had before our insert (9 lines, itmcnt=9).

import "./env";
import sql from "mssql/msnodesqlv8";

const OUR_K34 = 495751;
const OUR_K35 = 503388;
const PARENT_K33 = 46852;

async function main() {
  const execute = process.argv.includes("--execute");
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Verify current state
  const k34Row = await pool.request().query(`SELECT idnk34_k34, idnk33_k34 FROM k34_tab WHERE idnk34_k34 = ${OUR_K34}`);
  const k35Row = await pool.request().query(`SELECT idnk35_k35, idnk34_k35 FROM k35_tab WHERE idnk35_k35 = ${OUR_K35}`);
  const env = await pool.request().query(`
    SELECT itmcnt_k33, o_stat_k33,
           (SELECT COUNT(*) FROM k34_tab WHERE idnk33_k34 = ${PARENT_K33}) AS actual_lines
    FROM k33_tab WHERE idnk33_k33 = ${PARENT_K33}
  `);
  if (k34Row.recordset.length !== 1) throw new Error(`Our k34 ${OUR_K34} not found — already deleted?`);
  if (k35Row.recordset.length !== 1) throw new Error(`Our k35 ${OUR_K35} not found — already deleted?`);
  if (k34Row.recordset[0].idnk33_k34 !== PARENT_K33) throw new Error(`k34 ${OUR_K34} is not under envelope ${PARENT_K33}`);
  if (k35Row.recordset[0].idnk34_k35 !== OUR_K34) throw new Error(`k35 ${OUR_K35} is not linked to our k34`);
  if (String(env.recordset[0].o_stat_k33).trim() !== "adding quotes") throw new Error(`Envelope ${PARENT_K33} is not in staging`);

  console.log(`Current state:`);
  console.log(`  Envelope ${PARENT_K33}: itmcnt=${env.recordset[0].itmcnt_k33}, actual_lines=${env.recordset[0].actual_lines}`);
  console.log(`  Our rows: k34=${OUR_K34}, k35=${OUR_K35}`);
  console.log(`\nPlan (one transaction):`);
  console.log(`  1. DELETE k35_tab WHERE idnk35_k35 = ${OUR_K35}`);
  console.log(`  2. DELETE k34_tab WHERE idnk34_k34 = ${OUR_K34}`);
  console.log(`  3. UPDATE k33_tab SET itmcnt_k33 = itmcnt_k33 - 1, uptime_k33 = GETDATE() WHERE idnk33_k33 = ${PARENT_K33}`);
  console.log(`     (itmcnt 10 → 9, matches 9 actual lines after our delete)`);

  if (!execute) {
    console.log(`\nDRY RUN. Re-run with --execute.`);
    await pool.close();
    return;
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);

    // Envelope must still be in staging
    const envCheck = await req.query(`SELECT o_stat_k33 FROM k33_tab WITH (UPDLOCK, HOLDLOCK) WHERE idnk33_k33 = ${PARENT_K33}`);
    if (String(envCheck.recordset[0]?.o_stat_k33 || "").trim() !== "adding quotes") {
      throw new Error(`Envelope state changed — aborting`);
    }

    const d35 = await req.query(`DELETE FROM k35_tab WHERE idnk35_k35 = ${OUR_K35} AND idnk34_k35 = ${OUR_K34}`);
    if (d35.rowsAffected[0] !== 1) throw new Error(`k35 delete affected ${d35.rowsAffected[0]} rows`);
    const d34 = await req.query(`DELETE FROM k34_tab WHERE idnk34_k34 = ${OUR_K34} AND idnk33_k34 = ${PARENT_K33}`);
    if (d34.rowsAffected[0] !== 1) throw new Error(`k34 delete affected ${d34.rowsAffected[0]} rows`);
    const upd = await req.query(`
      UPDATE k33_tab SET itmcnt_k33 = itmcnt_k33 - 1, uptime_k33 = GETDATE()
      WHERE idnk33_k33 = ${PARENT_K33} AND itmcnt_k33 = 10
    `);
    if (upd.rowsAffected[0] !== 1) throw new Error(`k33 update affected ${upd.rowsAffected[0]} rows (itmcnt may have changed)`);

    await tx.commit();
    console.log(`  ✓ Transaction committed`);

    // Verify
    const v = await pool.request().query(`
      SELECT itmcnt_k33, uptime_k33,
             (SELECT COUNT(*) FROM k34_tab WHERE idnk33_k34 = ${PARENT_K33}) AS actual_lines
      FROM k33_tab WHERE idnk33_k33 = ${PARENT_K33}
    `);
    console.log(`\n=== VERIFIED ===`);
    console.log(`  Envelope ${PARENT_K33}: itmcnt=${v.recordset[0].itmcnt_k33}, actual_lines=${v.recordset[0].actual_lines}, match: ${v.recordset[0].itmcnt_k33 === v.recordset[0].actual_lines ? "YES ✓" : "NO ✗"}`);
    console.log(`  uptime_k33 refreshed to ${v.recordset[0].uptime_k33?.toISOString?.()}`);
    console.log(`\n→ Abe can retry his Save now. After he saves, tell him to pause and we'll reinsert line 11 (with a big id gap to avoid collision).`);
  } catch (e: any) {
    console.error(`\nERROR: ${e.message}`);
    try { await tx.rollback(); console.log(`  Rolled back.`); } catch {}
    process.exitCode = 1;
  } finally {
    await pool.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
