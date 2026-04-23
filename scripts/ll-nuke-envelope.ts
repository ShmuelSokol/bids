/**
 * LAST RESORT: fully delete a poisoned k33 envelope including all its
 * k34 + k35 rows. Use ONLY when:
 *   - The envelope is a DIBS-created one that LL's Post refuses to finalize
 *   - Non-destructive rescue paths (ll-retire-envelope + ll-move-k34-lines)
 *     have failed
 *   - You're prepared to have Abe re-enter all bids through LL's UI
 *
 * Safety guards:
 *   - Refuses if t_stat_k33 is 'sent' (real post — don't touch)
 *   - Dry-run by default; explicit --yes required
 *   - Prints full content (envelope + k34s + k35s) before deleting
 *   - Single transaction: all-or-nothing
 *
 * Usage:
 *   npx tsx scripts/ll-nuke-envelope.ts <idnk33>
 *   npx tsx scripts/ll-nuke-envelope.ts <idnk33> --yes
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
    console.error("Usage: npx tsx scripts/ll-nuke-envelope.ts <idnk33> [--yes]");
    process.exit(1);
  }

  const pool = await sql.connect(config);

  const env = await pool.request().input("id", sql.Int, idnk33).query(`SELECT * FROM k33_tab WHERE idnk33_k33 = @id`);
  if (env.recordset.length === 0) { console.log(`k33=${idnk33} not found`); await pool.close(); return; }
  const e = env.recordset[0];
  console.log(`=== Envelope k33=${idnk33} (${String(e.qotref_k33 || "").trim()}) ===`);
  console.log(`  o_stat_k33 = ${String(e.o_stat_k33 || "").trim()}`);
  console.log(`  t_stat_k33 = ${String(e.t_stat_k33 || "").trim()}`);
  console.log(`  itmcnt_k33 = ${e.itmcnt_k33}`);

  if (String(e.t_stat_k33 || "").trim() === "sent") {
    console.error(`\n❌ t_stat_k33 is 'sent'. This envelope was REALLY transmitted. REFUSING TO NUKE.`);
    await pool.close();
    return;
  }

  const k34s = await pool.request().input("id", sql.Int, idnk33).query(`SELECT idnk34_k34, idnk11_k34, pn_k34, mcage_k34, solqty_k34 FROM k34_tab WHERE idnk33_k34 = @id`);
  const k34Ids = k34s.recordset.map((r) => r.idnk34_k34);
  console.log(`\n=== k34 rows to delete (${k34Ids.length}) ===`);
  for (const r of k34s.recordset) {
    console.log(`  k34=${r.idnk34_k34}  k11=${r.idnk11_k34}  pn=${String(r.pn_k34||"").trim()}  mcage=${String(r.mcage_k34||"").trim()}  qty=${r.solqty_k34}`);
  }

  let k35Ids: number[] = [];
  if (k34Ids.length > 0) {
    const ph = k34Ids.map((_, i) => `@k${i}`).join(",");
    const req = pool.request();
    k34Ids.forEach((id, i) => req.input(`k${i}`, sql.Int, id));
    const k35s = await req.query(`SELECT idnk35_k35, idnk34_k35, qty_k35, up_k35 FROM k35_tab WHERE idnk34_k35 IN (${ph})`);
    k35Ids = k35s.recordset.map((r) => r.idnk35_k35);
    console.log(`\n=== k35 rows to delete (${k35Ids.length}) ===`);
    for (const r of k35s.recordset) {
      console.log(`  k35=${r.idnk35_k35}  k34=${r.idnk34_k35}  qty=${r.qty_k35}  up=$${r.up_k35}`);
    }
  }

  if (!confirmed) {
    console.log(`\nThis will DELETE:`);
    console.log(`  - ${k35Ids.length} row(s) from k35_tab`);
    console.log(`  - ${k34Ids.length} row(s) from k34_tab`);
    console.log(`  - 1 row from k33_tab (idnk33=${idnk33})`);
    console.log(`\n⚠ Abe will need to re-enter all ${k34Ids.length} bids through LL's UI afterwards.`);
    console.log(`\nRe-run with --yes to execute.`);
    await pool.close();
    return;
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    if (k34Ids.length > 0) {
      const ph = k34Ids.map((_, i) => `@k${i}`).join(",");
      const r1 = new sql.Request(tx);
      k34Ids.forEach((id, i) => r1.input(`k${i}`, sql.Int, id));
      await r1.query(`DELETE FROM k35_tab WHERE idnk34_k35 IN (${ph})`);
      const r2 = new sql.Request(tx);
      k34Ids.forEach((id, i) => r2.input(`k${i}`, sql.Int, id));
      await r2.query(`DELETE FROM k34_tab WHERE idnk34_k34 IN (${ph})`);
    }
    await new sql.Request(tx).input("id", sql.Int, idnk33).query(`DELETE FROM k33_tab WHERE idnk33_k33 = @id`);
    await tx.commit();
    console.log(`\n✅ Nuked envelope ${idnk33}: ${k35Ids.length} k35 + ${k34Ids.length} k34 + 1 k33 row deleted.`);
    console.log(`   Abe can now stage fresh quotes through LL's UI — LL should create a new envelope since 46879 is gone.`);
  } catch (err: any) {
    await tx.rollback();
    console.error(`\n❌ Rolled back: ${err.message}`);
  } finally {
    await pool.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
