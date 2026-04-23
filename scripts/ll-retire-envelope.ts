/**
 * Retire a stuck LamLinks quote envelope by flipping o_stat_k33 to
 * 'quotes added'. LL's state machine has no 'canceled' value — 'quotes
 * added' is the only way to stop it from piggybacking on an envelope.
 *
 * Intended use (DO NOT use this on a real envelope you want to post):
 *   - DIBS-created envelope that LL's Post refuses to commit.
 *   - You're about to move its k34 lines to a fresh LL-native envelope
 *     using ll-move-k34-lines.ts, then post the new envelope.
 *
 * Safety guards:
 *   - Refuses if t_stat_k33 is already 'sent' (real post — don't touch).
 *   - Refuses if already 'quotes added'.
 *   - Prints current state and requires --yes.
 *
 * Usage:
 *   npx tsx scripts/ll-retire-envelope.ts <idnk33>
 *   npx tsx scripts/ll-retire-envelope.ts <idnk33> --yes
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const idnk33 = Number(process.argv[2]);
  const confirmed = process.argv.includes("--yes");
  if (!idnk33) {
    console.error("Usage: npx tsx scripts/ll-retire-envelope.ts <idnk33> [--yes]");
    process.exit(1);
  }

  const pool = await sql.connect(config);
  const r = await pool.request().input("id", sql.Int, idnk33).query(`SELECT * FROM k33_tab WHERE idnk33_k33 = @id`);
  if (r.recordset.length === 0) { console.log(`k33=${idnk33} not found`); await pool.close(); return; }
  const e = r.recordset[0];

  console.log(`=== Envelope k33=${idnk33} (${String(e.qotref_k33 || "").trim()}) ===`);
  console.log(`  o_stat_k33 = ${String(e.o_stat_k33 || "").trim()}`);
  console.log(`  t_stat_k33 = ${String(e.t_stat_k33 || "").trim()}`);
  console.log(`  a_stat_k33 = ${String(e.a_stat_k33 || "").trim()}`);
  console.log(`  s_stat_k33 = ${String(e.s_stat_k33 || "").trim()}`);
  console.log(`  itmcnt_k33 = ${e.itmcnt_k33}`);
  console.log(`  upname_k33 = ${String(e.upname_k33 || "").trim()}`);

  const oStat = String(e.o_stat_k33 || "").trim();
  const tStat = String(e.t_stat_k33 || "").trim();
  if (tStat === "sent") {
    console.error(`\n❌ t_stat_k33 is 'sent' — envelope was really transmitted. REFUSING TO TOUCH IT.`);
    await pool.close();
    return;
  }
  if (oStat === "quotes added") {
    console.log(`\n⚠ Already 'quotes added' — nothing to do.`);
    await pool.close();
    return;
  }
  if (oStat !== "adding quotes") {
    console.error(`\n❌ Unexpected o_stat_k33 '${oStat}'. Aborting for safety.`);
    await pool.close();
    return;
  }

  if (!confirmed) {
    console.log(`\nThis will:`);
    console.log(`  UPDATE k33_tab SET o_stat_k33 = 'quotes added', s_stat_k33 = 'quotes added', uptime_k33 = GETDATE() WHERE idnk33_k33 = ${idnk33}`);
    console.log(`\n  t_stat_k33 stays 'not sent' — we are NOT claiming the bids were transmitted. This is just to get LL to stop piggybacking.`);
    console.log(`\nRe-run with --yes to execute.`);
    await pool.close();
    return;
  }

  await pool.request().input("id", sql.Int, idnk33).query(`
    UPDATE k33_tab
    SET o_stat_k33 = 'quotes added',
        s_stat_k33 = 'quotes added',
        uptime_k33 = GETDATE()
    WHERE idnk33_k33 = @id
  `);
  console.log(`\n✅ Envelope ${idnk33} retired (o_stat='quotes added', t_stat stays 'not sent').`);
  console.log(`   Next step: have Abe stage one bid in LL — it should create a fresh envelope now.`);
  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
