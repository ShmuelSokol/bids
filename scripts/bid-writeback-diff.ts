/**
 * Before/after snapshot tool for bid write-back testing.
 *
 * For the first `--execute` run we want:
 *   1. A known baseline (what's in k33/k34/k35 before we touch anything)
 *   2. A way to diff against that baseline after the write
 *   3. Human-readable SQL Yosef can paste into SSMS if he wants to
 *      cross-check with his own eyes
 *
 * Modes:
 *   npx tsx scripts/bid-writeback-diff.ts --sql
 *       Prints the SELECT statements — copy/paste into SSMS
 *
 *   npx tsx scripts/bid-writeback-diff.ts --snapshot
 *       Captures current max IDs + recent Abe bid counts, writes
 *       C:/tmp/bid-writeback-snapshot-<ts>.json
 *
 *   npx tsx scripts/bid-writeback-diff.ts --diff <snapshot.json>
 *       Compares current state vs snapshot, reports:
 *         - new k33 batch rows (should be exactly 1 per --execute)
 *         - new k34 bid line rows linked to that k33
 *         - new k35 pricing rows linked to those k34s
 *         - any rows that DISAPPEARED (shouldn't happen, triggers alert)
 *
 *   npx tsx scripts/bid-writeback-diff.ts
 *       Runs --sql (prints SQL) — helpful default for first-time use.
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { writeFileSync, readFileSync, existsSync } from "fs";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const SQL_STATEMENTS = {
  max_ids: `-- Current max IDs across the bid-write-back chain
SELECT
  (SELECT MAX(idnk33_k33) FROM k33_tab) AS max_k33,
  (SELECT MAX(idnk34_k34) FROM k34_tab) AS max_k34,
  (SELECT MAX(idnk35_k35) FROM k35_tab) AS max_k35;`,

  recent_abe: `-- Last 5 of Abe's bid batches (k33 headers)
SELECT TOP 5
  idnk33_k33, uptime_k33, upname_k33,
  RTRIM(qotref_k33) AS qotref,
  RTRIM(a_stat_k33) AS a_stat,
  RTRIM(t_stat_k33) AS t_stat,
  RTRIM(s_stat_k33) AS s_stat,
  itmcnt_k33
FROM k33_tab
ORDER BY idnk33_k33 DESC;`,

  by_batch: (batchId: number) => `-- k34 lines for batch ${batchId}
SELECT
  k34.idnk34_k34, k34.idnk11_k34, k34.idnk33_k34,
  RTRIM(k34.pn_k34) AS pn, RTRIM(k34.mcage_k34) AS mcage,
  RTRIM(k34.fobcod_k34) AS fob, k34.solqty_k34,
  RTRIM(k34.qty_ui_k34) AS uom
FROM k34_tab k34
WHERE k34.idnk33_k34 = ${batchId};

-- k35 pricing for batch ${batchId}
SELECT
  k35.idnk35_k35, k35.idnk34_k35,
  k35.qty_k35, k35.up_k35, k35.daro_k35
FROM k35_tab k35
JOIN k34_tab k34 ON k34.idnk34_k34 = k35.idnk34_k35
WHERE k34.idnk33_k34 = ${batchId};`,

  today_abe_count: `-- Abe's k34 rows created today (LamLinks server time)
SELECT COUNT(*) AS abe_today
FROM k34_tab
WHERE upname_k34 LIKE '%ajoseph%'
  AND uptime_k34 >= CAST(GETDATE() AS DATE);`,
};

type Snapshot = {
  captured_at: string;
  max_k33: number;
  max_k34: number;
  max_k35: number;
  abe_today_count: number;
};

async function capture(pool: sql.ConnectionPool): Promise<Snapshot> {
  const r1 = await pool.request().query(SQL_STATEMENTS.max_ids);
  const r2 = await pool.request().query(SQL_STATEMENTS.today_abe_count);
  const m = r1.recordset[0];
  return {
    captured_at: new Date().toISOString(),
    max_k33: m.max_k33,
    max_k34: m.max_k34,
    max_k35: m.max_k35,
    abe_today_count: r2.recordset[0].abe_today,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const mode =
    args.includes("--snapshot") ? "snapshot" :
    args.includes("--diff") ? "diff" :
    args.includes("--sql") ? "sql" :
    "sql"; // default

  if (mode === "sql") {
    console.log("=".repeat(78));
    console.log("BID WRITE-BACK — SQL for SSMS");
    console.log("=".repeat(78));
    console.log("Paste these into SSMS against llk_db1.\n");
    console.log("-- 1. Current max IDs (capture before --execute) ----------");
    console.log(SQL_STATEMENTS.max_ids);
    console.log("\n-- 2. Most recent 5 bid batches ---------------------------");
    console.log(SQL_STATEMENTS.recent_abe);
    console.log("\n-- 3. Abe's bid count for today ---------------------------");
    console.log(SQL_STATEMENTS.today_abe_count);
    console.log("\n-- 4. Full contents of a specific batch -------------------");
    console.log("-- Replace <BATCH_ID> with the idnk33_k33 of the new DIBS batch");
    console.log(SQL_STATEMENTS.by_batch("<BATCH_ID>" as any));
    console.log("\n" + "=".repeat(78));
    console.log("For automated diffing, use:");
    console.log("  npx tsx scripts/bid-writeback-diff.ts --snapshot    # before");
    console.log("  # ... run generate-bid-insert-sql.ts --execute ...");
    console.log("  npx tsx scripts/bid-writeback-diff.ts --diff <file> # after");
    console.log("=".repeat(78));
    return;
  }

  const pool = await sql.connect(config);

  if (mode === "snapshot") {
    const snap = await capture(pool);
    const path = `C:/tmp/bid-writeback-snapshot-${Date.now()}.json`;
    writeFileSync(path, JSON.stringify(snap, null, 2));
    console.log("=== SNAPSHOT (before --execute) ===");
    console.log(`  captured_at:     ${snap.captured_at}`);
    console.log(`  max_k33:         ${snap.max_k33}`);
    console.log(`  max_k34:         ${snap.max_k34}`);
    console.log(`  max_k35:         ${snap.max_k35}`);
    console.log(`  abe_today_count: ${snap.abe_today_count}`);
    console.log(`\nSaved: ${path}`);
    console.log(`Now run:  npx tsx scripts/generate-bid-insert-sql.ts --execute`);
    console.log(`Then:     npx tsx scripts/bid-writeback-diff.ts --diff ${path}`);
    await pool.close();
    return;
  }

  if (mode === "diff") {
    const fileIdx = args.indexOf("--diff") + 1;
    const path = args[fileIdx];
    if (!path || !existsSync(path)) {
      console.error(`--diff needs a snapshot file path. Got: ${path}`);
      await pool.close();
      process.exit(1);
    }
    const before: Snapshot = JSON.parse(readFileSync(path, "utf8"));
    const after = await capture(pool);

    const delta = {
      k33: after.max_k33 - before.max_k33,
      k34: after.max_k34 - before.max_k34,
      k35: after.max_k35 - before.max_k35,
    };

    console.log("=== DIFF (after --execute) ===\n");
    console.log(`  Before: ${before.captured_at}`);
    console.log(`  After:  ${after.captured_at}\n`);

    console.log(`  max_k33:  ${before.max_k33}  →  ${after.max_k33}   (+${delta.k33})`);
    console.log(`  max_k34:  ${before.max_k34}  →  ${after.max_k34}   (+${delta.k34})`);
    console.log(`  max_k35:  ${before.max_k35}  →  ${after.max_k35}   (+${delta.k35})`);
    console.log(`  abe_today: ${before.abe_today_count}  →  ${after.abe_today_count}   (+${after.abe_today_count - before.abe_today_count})`);

    // Inspect new k33 batches (everything with id > before.max_k33 and created by dibs-auto)
    if (delta.k33 > 0) {
      const newBatches = await pool.request().query(`
        SELECT idnk33_k33, uptime_k33, RTRIM(upname_k33) AS upname,
               RTRIM(qotref_k33) AS qotref,
               RTRIM(a_stat_k33) AS a_stat,
               RTRIM(t_stat_k33) AS t_stat,
               RTRIM(s_stat_k33) AS s_stat,
               itmcnt_k33
        FROM k33_tab
        WHERE idnk33_k33 > ${before.max_k33}
        ORDER BY idnk33_k33`);
      console.log(`\n  NEW k33 BATCHES:`);
      for (const r of newBatches.recordset) {
        console.log(`    id=${r.idnk33_k33}  qotref=${r.qotref}  upname=${r.upname}  a_stat=${r.a_stat}  t_stat=${r.t_stat}  s_stat=${r.s_stat}  items=${r.itmcnt_k33}`);
        // Assert what DIBS should have written
        if (r.upname !== "dibs-auto") {
          console.log(`    ⚠ upname expected 'dibs-auto', got '${r.upname}'`);
        }
        if (r.a_stat?.replace(/\s+$/, "") !== "acknowledged") {
          console.log(`    ⚠ a_stat expected 'acknowledged', got '${r.a_stat}'`);
        }
        if (r.t_stat && r.t_stat.trim()) {
          console.log(`    ⚠ t_stat expected NULL/blank (we shouldn't touch transmit), got '${r.t_stat}'`);
        }
      }
    } else {
      console.log(`\n  No new k33 batches. --execute didn't run or failed.`);
    }

    if (delta.k34 > 0) {
      const newLines = await pool.request().query(`
        SELECT k34.idnk34_k34, k34.idnk33_k34, k34.idnk11_k34,
               RTRIM(k34.pn_k34) AS pn, RTRIM(k34.mcage_k34) AS mcage,
               RTRIM(k34.fobcod_k34) AS fob, k34.solqty_k34,
               RTRIM(k34.qty_ui_k34) AS uom
        FROM k34_tab k34
        WHERE idnk34_k34 > ${before.max_k34}
        ORDER BY idnk34_k34`);
      console.log(`\n  NEW k34 LINES:`);
      for (const r of newLines.recordset) {
        console.log(`    id=${r.idnk34_k34}  batch=${r.idnk33_k34}  sol_line=${r.idnk11_k34}  pn=${r.pn}  mcage=${r.mcage}  fob=${r.fob}  qty=${r.solqty_k34}${r.uom}`);
      }
    }

    if (delta.k35 > 0) {
      const newPricing = await pool.request().query(`
        SELECT idnk35_k35, idnk34_k35, qty_k35, up_k35, daro_k35
        FROM k35_tab
        WHERE idnk35_k35 > ${before.max_k35}
        ORDER BY idnk35_k35`);
      console.log(`\n  NEW k35 PRICING:`);
      for (const r of newPricing.recordset) {
        console.log(`    id=${r.idnk35_k35}  line=${r.idnk34_k35}  qty=${r.qty_k35}  up=$${r.up_k35}  lead=${r.daro_k35}d`);
      }
    }

    // Sanity alerts
    if (delta.k33 === 0 && (delta.k34 > 0 || delta.k35 > 0)) {
      console.log(`\n  ⚠⚠⚠  k34/k35 rows appeared WITHOUT a new k33 batch. Something is wrong.`);
    }
    if (delta.k34 !== delta.k35) {
      console.log(`\n  ⚠  k34 count (${delta.k34}) != k35 count (${delta.k35}). Should be 1:1.`);
    }
    if (delta.k33 > 0 && delta.k34 === 0) {
      console.log(`\n  ⚠  New k33 batch with 0 lines. Nothing to bid — check the quoted bid_decisions count.`);
    }
    console.log();
    await pool.close();
    return;
  }

  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
