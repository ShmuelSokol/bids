/**
 * Move a list of k34 lines from a poisoned "DIBS-created" envelope into
 * a fresh envelope that Abe created through LL's UI. LL's Post procedure
 * refuses to finalize envelopes DIBS wrote via direct SQL; moving the
 * k34 FK onto an LL-native envelope lets them post.
 *
 * Steps performed atomically:
 *   1. Verify the target envelope is in 'adding quotes' state.
 *   2. Re-point each k34_tab.idnk33_k34 to the target envelope id.
 *   3. Adjust itmcnt_k33 on source (−N) and target (+N).
 *   4. Bump uptime_k33 on both envelopes.
 *
 * Usage:
 *   npx tsx scripts/ll-move-k34-lines.ts --from <src_idnk33> --to <dst_idnk33> --k34 <id,id,id,...> [--yes]
 *
 * Example (move 4 k34 lines from the poisoned envelope 46879 to a fresh
 * envelope Abe just created, say idnk33=46880):
 *   npx tsx scripts/ll-move-k34-lines.ts --from 46879 --to 46880 --k34 496122,496123,496124,496125 --yes
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  return process.argv[i + 1] || null;
}

async function main() {
  const from = Number(arg("--from"));
  const to = Number(arg("--to"));
  const k34List = (arg("--k34") || "").split(",").map((s) => Number(s.trim())).filter(Boolean);
  const confirmed = process.argv.includes("--yes");
  if (!from || !to || k34List.length === 0) {
    console.error("Usage: npx tsx scripts/ll-move-k34-lines.ts --from <src_idnk33> --to <dst_idnk33> --k34 <id,id,...> [--yes]");
    process.exit(1);
  }

  const pool = await sql.connect(config);

  // Verify both envelopes
  const envs = await pool.request()
    .input("from", sql.Int, from)
    .input("to", sql.Int, to)
    .query(`SELECT idnk33_k33, o_stat_k33, itmcnt_k33, qotref_k33, upname_k33 FROM k33_tab WHERE idnk33_k33 IN (@from, @to)`);
  const byId = new Map<number, any>();
  for (const r of envs.recordset) byId.set(r.idnk33_k33, r);
  const src = byId.get(from);
  const dst = byId.get(to);
  if (!src || !dst) {
    console.error(`Missing envelope: from=${!!src} to=${!!dst}`);
    await pool.close();
    return;
  }
  console.log("=== Source envelope ===");
  console.log(`  idnk33=${src.idnk33_k33}  ref=${String(src.qotref_k33||"").trim()}  status=${String(src.o_stat_k33||"").trim()}  itmcnt=${src.itmcnt_k33}  upname=${src.upname_k33}`);
  console.log("=== Target envelope ===");
  console.log(`  idnk33=${dst.idnk33_k33}  ref=${String(dst.qotref_k33||"").trim()}  status=${String(dst.o_stat_k33||"").trim()}  itmcnt=${dst.itmcnt_k33}  upname=${dst.upname_k33}`);
  if (String(src.o_stat_k33||"").trim() !== "adding quotes") {
    console.error("\n❌ Source envelope is NOT in 'adding quotes' state.");
    await pool.close();
    return;
  }
  if (String(dst.o_stat_k33||"").trim() !== "adding quotes") {
    console.error("\n❌ Target envelope is NOT in 'adding quotes' state.");
    await pool.close();
    return;
  }

  // Verify the k34 rows are currently on the source envelope
  const placeholders = k34List.map((_, i) => `@k${i}`).join(",");
  const req = pool.request();
  k34List.forEach((id, i) => req.input(`k${i}`, sql.Int, id));
  const k34rows = await req.query(`SELECT idnk34_k34, idnk33_k34, pn_k34, mcage_k34, solqty_k34 FROM k34_tab WHERE idnk34_k34 IN (${placeholders})`);
  console.log(`\n=== k34 rows to move (${k34rows.recordset.length}) ===`);
  let allOnSource = true;
  for (const r of k34rows.recordset) {
    console.log(`  k34=${r.idnk34_k34}  currently on idnk33=${r.idnk33_k34}  pn=${String(r.pn_k34||"").trim()}  mcage=${String(r.mcage_k34||"").trim()}  qty=${r.solqty_k34}`);
    if (r.idnk33_k34 !== from) allOnSource = false;
  }
  if (k34rows.recordset.length !== k34List.length) {
    console.error(`\n❌ Expected ${k34List.length} k34 rows, found ${k34rows.recordset.length}.`);
    await pool.close();
    return;
  }
  if (!allOnSource) {
    console.error(`\n❌ Not all k34 rows currently belong to the source envelope ${from}.`);
    await pool.close();
    return;
  }

  if (!confirmed) {
    console.log(`\nThis will:`);
    console.log(`  1. UPDATE k34_tab SET idnk33_k34 = ${to} WHERE idnk34_k34 IN (${k34List.join(",")})`);
    console.log(`  2. UPDATE k33_tab SET itmcnt_k33 = ${src.itmcnt_k33 - k34List.length} WHERE idnk33_k33 = ${from}`);
    console.log(`  3. UPDATE k33_tab SET itmcnt_k33 = ${dst.itmcnt_k33 + k34List.length} WHERE idnk33_k33 = ${to}`);
    console.log(`\nRe-run with --yes to execute.`);
    await pool.close();
    return;
  }

  // Transactional move
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const r1 = new sql.Request(tx);
    k34List.forEach((id, i) => r1.input(`k${i}`, sql.Int, id));
    r1.input("to", sql.Int, to);
    await r1.query(`UPDATE k34_tab SET idnk33_k34 = @to, uptime_k34 = GETDATE() WHERE idnk34_k34 IN (${placeholders})`);

    const r2 = new sql.Request(tx);
    r2.input("from", sql.Int, from);
    r2.input("n", sql.Int, k34List.length);
    await r2.query(`UPDATE k33_tab SET itmcnt_k33 = itmcnt_k33 - @n, uptime_k33 = GETDATE() WHERE idnk33_k33 = @from`);

    const r3 = new sql.Request(tx);
    r3.input("to", sql.Int, to);
    r3.input("n", sql.Int, k34List.length);
    await r3.query(`UPDATE k33_tab SET itmcnt_k33 = itmcnt_k33 + @n, uptime_k33 = GETDATE() WHERE idnk33_k33 = @to`);

    await tx.commit();
    console.log(`\n✅ Moved ${k34List.length} k34 lines from envelope ${from} to envelope ${to}.`);
    console.log(`   Abe should close LL completely, log back in, open the target envelope, verify lines, and Post.`);
  } catch (e: any) {
    await tx.rollback();
    console.error(`\n❌ Rolled back: ${e.message}`);
  } finally {
    await pool.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
