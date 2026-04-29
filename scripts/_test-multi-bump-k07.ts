/**
 * Test the multi-bump k07 pattern shipped to lamlinks-writeback-worker.ts:
 *
 *   1. Snapshot k07.SOL_FORM_PREFERENCES uptime BEFORE
 *   2. Fire 6 bumpK07 calls (matching what createFreshEnvelope + appendBidLine
 *      now do — 2 in fresh envelope creation + 4 per bid line)
 *   3. Snapshot AFTER, verify uptime advanced and is fresh (within a few seconds)
 *   4. Verify no SQL errors during bumps (bumpK07 is supposed to be idempotent)
 *
 * Does NOT create a real k33 envelope — just exercises the bump mechanism so
 * we know the SQL pattern + the column filter are correct. Real cursor-error
 * silencing can only be validated when Abe creates a fresh envelope tomorrow.
 */
import "./env";
import sql from "mssql/msnodesqlv8";

(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  const before = await pool.request().query(`
    SELECT idnk07_k07, uptime_k07, LTRIM(RTRIM(ss_val_k07)) AS val
    FROM k07_tab
    WHERE LTRIM(RTRIM(upname_k07)) = 'ajoseph'
      AND LTRIM(RTRIM(ss_key_k07)) = 'SOL_FORM_PREFERENCES'
      AND LTRIM(RTRIM(ss_tid_k07)) = 'U'
  `);
  if (!before.recordset.length) {
    console.error("No SOL_FORM_PREFERENCES row for ajoseph — multi-bump test would silently no-op in production");
    process.exit(1);
  }
  const idn = before.recordset[0].idnk07_k07;
  const beforeTs = before.recordset[0].uptime_k07;
  console.log(`BEFORE: idn=${idn}  uptime=${beforeTs?.toISOString?.()}  val="${before.recordset[0].val.slice(0, 60)}"`);

  // Fire 6 bumps in rapid succession (simulates createFreshEnvelope's 2 + appendBidLine's 4)
  console.log(`\nFiring 6 bumps...`);
  for (let i = 0; i < 6; i++) {
    const start = Date.now();
    const r = await pool.request().query(`
      UPDATE k07_tab
      SET uptime_k07 = GETDATE()
      WHERE LTRIM(RTRIM(upname_k07)) = 'ajoseph'
        AND LTRIM(RTRIM(ss_key_k07)) = 'SOL_FORM_PREFERENCES'
        AND LTRIM(RTRIM(ss_tid_k07)) = 'U'
    `);
    console.log(`  bump ${i + 1}: ${r.rowsAffected[0]} row(s) in ${Date.now() - start}ms`);
  }

  const after = await pool.request().query(`
    SELECT uptime_k07 FROM k07_tab WHERE idnk07_k07 = ${idn}
  `);
  const afterTs = after.recordset[0].uptime_k07;
  console.log(`\nAFTER:  uptime=${afterTs?.toISOString?.()}`);

  const advancedMs = afterTs.getTime() - beforeTs.getTime();
  console.log(`\n=== RESULT ===`);
  console.log(`  uptime advanced by ${advancedMs}ms`);
  console.log(`  bumps fired: 6`);
  console.log(`  ${advancedMs > 0 ? "✓" : "✗"} k07 row IS being bumped (matches LL pattern)`);
  console.log(`  ${Math.abs(Date.now() - afterTs.getTime()) < 5000 ? "✓" : "✗"} timestamp is fresh (within 5s)`);

  await pool.close();
})().catch(e => { console.error(e); process.exit(1); });
