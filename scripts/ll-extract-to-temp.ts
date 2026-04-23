/**
 * Park all k34 rows from a stuck envelope onto a temporary parking k33
 * and delete the original envelope. Lets us get rid of a poisoned k33
 * while preserving its k34/k35 data for later.
 *
 * Pairs with ll-move-k34-lines.ts: once Abe creates a fresh LL-native
 * envelope by staging a bid, use ll-move-k34-lines.ts to transplant the
 * parked rows into the new envelope.
 *
 * Transactional. Refuses if the source envelope's t_stat_k33='sent'.
 *
 * Usage:
 *   npx tsx scripts/ll-extract-to-temp.ts <src_idnk33>
 *   npx tsx scripts/ll-extract-to-temp.ts <src_idnk33> --yes
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const src = Number(process.argv[2]);
  const confirmed = process.argv.includes("--yes");
  if (!src) {
    console.error("Usage: npx tsx scripts/ll-extract-to-temp.ts <src_idnk33> [--yes]");
    process.exit(1);
  }

  const pool = await sql.connect(config);

  // Load source envelope
  const srcQ = await pool.request().input("id", sql.Int, src).query(`SELECT * FROM k33_tab WHERE idnk33_k33 = @id`);
  if (srcQ.recordset.length === 0) { console.log(`k33=${src} not found`); await pool.close(); return; }
  const s = srcQ.recordset[0];
  console.log(`=== Source envelope k33=${src} (${String(s.qotref_k33 || "").trim()}) ===`);
  console.log(`  o_stat_k33 = ${String(s.o_stat_k33 || "").trim()}`);
  console.log(`  t_stat_k33 = ${String(s.t_stat_k33 || "").trim()}`);
  console.log(`  itmcnt_k33 = ${s.itmcnt_k33}`);
  if (String(s.t_stat_k33 || "").trim() === "sent") {
    console.error(`\n❌ Source envelope was REALLY transmitted. Refusing to touch it.`);
    await pool.close();
    return;
  }

  const k34Q = await pool.request().input("id", sql.Int, src).query(`SELECT idnk34_k34, pn_k34, solqty_k34 FROM k34_tab WHERE idnk33_k34 = @id`);
  const k34Ids = k34Q.recordset.map((r) => r.idnk34_k34);
  console.log(`\n=== k34 rows under source (${k34Ids.length}) ===`);
  for (const r of k34Q.recordset) console.log(`  k34=${r.idnk34_k34}  pn=${String(r.pn_k34 || "").trim()}  qty=${r.solqty_k34}`);

  if (!confirmed) {
    console.log(`\nThis will:`);
    console.log(`  1. INSERT a new temp k33 row (qotref_k33='DIBS-PARK-TEMP') as a parking spot`);
    console.log(`  2. UPDATE k34_tab SET idnk33_k34 = <temp_idnk33> for ${k34Ids.length} rows`);
    console.log(`  3. UPDATE temp k33 SET itmcnt_k33 = ${k34Ids.length}`);
    console.log(`  4. DELETE k33_tab WHERE idnk33_k33 = ${src} (source now empty)`);
    console.log(`\n  Then: have Abe stage 1 bid in LL to create a fresh LL-native envelope,`);
    console.log(`        then run ll-move-k34-lines.ts to move the ${k34Ids.length} parked rows to it.`);
    console.log(`\nRe-run with --yes to execute.`);
    await pool.close();
    return;
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    // 1. Create a temp parking envelope. Copy mandatory fields off the
    //    source so we don't violate any NOT NULL / domain constraints.
    const ins = new sql.Request(tx);
    ins.input("upname", sql.VarChar, "dibs-park");
    ins.input("qotref", sql.VarChar, `DIBS-PARK-${src}`);
    ins.input("ostat", sql.VarChar, "adding quotes");
    ins.input("tstat", sql.VarChar, "not sent");
    ins.input("astat", sql.VarChar, "not acknowledged");
    ins.input("sstat", sql.VarChar, "adding quotes");
    ins.input("itmcnt", sql.Int, k34Ids.length);
    const insResult = await ins.query(`
      INSERT INTO k33_tab (uptime_k33, upname_k33, qotref_k33, o_stat_k33, t_stat_k33, a_stat_k33, s_stat_k33,
                           o_stme_k33, t_stme_k33, a_stme_k33, s_stme_k33, itmcnt_k33)
      OUTPUT INSERTED.idnk33_k33
      VALUES (GETDATE(), @upname, @qotref, @ostat, @tstat, @astat, @sstat,
              GETDATE(), GETDATE(), GETDATE(), GETDATE(), @itmcnt)
    `);
    const tempId = insResult.recordset[0].idnk33_k33;
    console.log(`\n  ✓ Created temp parking envelope k33=${tempId}`);

    // 2. Move k34 rows to temp
    if (k34Ids.length > 0) {
      const ph = k34Ids.map((_, i) => `@k${i}`).join(",");
      const mv = new sql.Request(tx);
      k34Ids.forEach((id, i) => mv.input(`k${i}`, sql.Int, id));
      mv.input("to", sql.Int, tempId);
      await mv.query(`UPDATE k34_tab SET idnk33_k34 = @to WHERE idnk34_k34 IN (${ph})`);
      console.log(`  ✓ Moved ${k34Ids.length} k34 row(s) onto temp envelope`);
    }

    // 3. Source envelope is now empty; delete it.
    await new sql.Request(tx).input("id", sql.Int, src).query(`DELETE FROM k33_tab WHERE idnk33_k33 = @id`);
    console.log(`  ✓ Deleted original k33=${src}`);

    await tx.commit();
    console.log(`\n✅ Done. Temp parking envelope idnk33=${tempId} now holds your ${k34Ids.length} k34 rows.`);
    console.log(`\nNext steps:`);
    console.log(`  1. Have Abe stage a single bid through LL's UI. LL should create a fresh envelope`);
    console.log(`     since k33=${src} no longer exists.`);
    console.log(`  2. Run: npx tsx scripts/ll-list-my-envelopes.ts ajoseph --staging`);
    console.log(`     to find the new envelope's idnk33.`);
    console.log(`  3. Run: npx tsx scripts/ll-move-k34-lines.ts --from ${tempId} --to <NEW_IDNK33> --k34 ${k34Ids.join(",")} --yes`);
    console.log(`  4. Abe restarts LL, opens the new envelope, posts (${k34Ids.length + 1} lines total).`);
  } catch (err: any) {
    await tx.rollback();
    console.error(`\n❌ Rolled back: ${err.message}`);
  } finally {
    await pool.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
