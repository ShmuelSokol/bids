/**
 * Update a k33 envelope's transmission + ack state to match reality.
 * Use after confirming from a DLA ack email that an envelope's bids
 * actually transmitted and were acknowledged, even though LL's local
 * state still says "not sent" / "not acknowledged" (common when LL's
 * UI hit cursor errors on the post but the transmit daemon still fired).
 *
 * Refuses if t_stat is already 'sent' (idempotent no-op).
 *
 * Usage:
 *   npx tsx scripts/ll-mark-envelope-sent.ts <idnk33>
 *   npx tsx scripts/ll-mark-envelope-sent.ts <idnk33> --yes
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
    console.error("Usage: npx tsx scripts/ll-mark-envelope-sent.ts <idnk33> [--yes]");
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

  if (String(e.t_stat_k33 || "").trim() === "sent") {
    console.log(`\n⚠ Already marked 'sent'. Nothing to do.`);
    await pool.close();
    return;
  }

  if (!confirmed) {
    console.log(`\nThis will:`);
    console.log(`  UPDATE k33_tab SET`);
    console.log(`    o_stat_k33 = 'quotes added',`);
    console.log(`    t_stat_k33 = 'sent',`);
    console.log(`    a_stat_k33 = 'acknowledged',`);
    console.log(`    s_stat_k33 = 'acknowledged',`);
    console.log(`    uptime_k33 = GETDATE()`);
    console.log(`  WHERE idnk33_k33 = ${idnk33}`);
    console.log(`\nOnly run this when you've confirmed from a DLA ack email that transmission succeeded.`);
    console.log(`\nRe-run with --yes to execute.`);
    await pool.close();
    return;
  }

  await pool.request().input("id", sql.Int, idnk33).query(`
    UPDATE k33_tab
    SET o_stat_k33 = 'quotes added',
        t_stat_k33 = 'sent',
        a_stat_k33 = 'acknowledged',
        s_stat_k33 = 'acknowledged',
        uptime_k33 = GETDATE()
    WHERE idnk33_k33 = @id
  `);
  console.log(`\n✅ Envelope ${idnk33} marked as sent + acknowledged.`);
  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
