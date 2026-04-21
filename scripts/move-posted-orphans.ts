// EMERGENCY: Abe's counter persisted across LamLinks restart. Our 2 posted rows
// at k34=495751 (env 46852) and k34=495752 (env 46853) are blocking his next saves.
//
// Move both rows to 999751 / 999752 (far above any reasonable counter drift).
// Their k35 pricing rows get moved to 999388 / 999389.
//
// These are POSTED rows (t_stat='sent' on their parents). Moving them is safe:
// - No triggers or FKs enforced
// - LamLinks uses sol+CAGE as the external identity, not idnk34
// - Downstream status reconciler comments reference k34 but it's informational
//
// Runs in one transaction per pair. TABLOCKX+HOLDLOCK on k34/k35 so Abe can't
// squeeze a save through mid-move.

import "./env";
import sql from "mssql/msnodesqlv8";

// Move posted orphans DOWN into historical k34/k35 gaps that Abe's
// monotonically-increasing client counter will never revisit.
// k34 gap 123621..123720 (size 100) has been empty since before Abe joined.
// k35 gaps 503380 and 503144 are isolated holes in the recent range.
const MOVES = [
  { oldK34: 495751, newK34: 123621, oldK35: 503388, newK35: 503380 },
  { oldK34: 495752, newK34: 123622, oldK35: 503389, newK35: 503144 },
];

async function main() {
  const execute = process.argv.includes("--execute");
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Preflight: confirm old rows exist, new ids are free
  for (const m of MOVES) {
    const old34 = await pool.request().query(`SELECT idnk34_k34, idnk33_k34 FROM k34_tab WHERE idnk34_k34 = ${m.oldK34}`);
    const old35 = await pool.request().query(`SELECT idnk35_k35, idnk34_k35 FROM k35_tab WHERE idnk35_k35 = ${m.oldK35}`);
    const new34free = await pool.request().query(`SELECT COUNT(*) AS c FROM k34_tab WHERE idnk34_k34 = ${m.newK34}`);
    const new35free = await pool.request().query(`SELECT COUNT(*) AS c FROM k35_tab WHERE idnk35_k35 = ${m.newK35}`);
    if (old34.recordset.length !== 1) throw new Error(`k34 ${m.oldK34} missing`);
    if (old35.recordset.length !== 1) throw new Error(`k35 ${m.oldK35} missing`);
    if (new34free.recordset[0].c !== 0) throw new Error(`k34 ${m.newK34} already taken`);
    if (new35free.recordset[0].c !== 0) throw new Error(`k35 ${m.newK35} already taken`);
    console.log(`✓ ${m.oldK34}/${m.oldK35} → ${m.newK34}/${m.newK35} — ready`);
  }

  if (!execute) {
    console.log("\nDRY RUN. Re-run with --execute to move.");
    await pool.close();
    return;
  }

  console.log("\n=== EXECUTING (single transaction, both moves atomic) ===");
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);

    // Lock k34/k35 for the whole transaction
    await req.query(`SELECT TOP 0 * FROM k34_tab WITH (TABLOCKX, HOLDLOCK)`);
    await req.query(`SELECT TOP 0 * FROM k35_tab WITH (TABLOCKX, HOLDLOCK)`);

    for (const m of MOVES) {
      // Copy k34 old → new (preserve idnk33_k34 parent link)
      await req.query(`
        INSERT INTO k34_tab
        SELECT ${m.newK34}, uptime_k34, upname_k34, idnk11_k34, idnk33_k34, pn_k34, pn_rev_k34,
          scage_k34, sname_k34, saddr1_k34, saddr2_k34, scitys_k34, szip_k34, sfax_k34,
          sphone_k34, semail_k34, sattn_k34, stitle_k34, staxid_k34, bizsiz_k34, disadv_k34,
          womown_k34, mcage_k34, s1cage_k34, s1name_k34, s1city_k34, s2cage_k34, s2name_k34,
          s2city_k34, s3cage_k34, s3name_k34, s3city_k34, trmdes_k34, bidtyp_k34, p0301_k34,
          fobcod_k34, shpcty_k34, valday_k34, allqty_k34, insmat_k34, inspkg_k34, hazard_k34,
          forign_k34, newprt_k34, surpls_k34, rebilt_k34, qtyvpp_k34, qtyvmp_k34, baspon_k34,
          qmcage_k34, qscage_k34, qpltno_k34, dly_ar_k34, qty_ui_k34, solqty_k34, gennte_k34,
          pkgnte_k34, qrefno_k34, orgtyp_k34, popnam_k34, poptin_k34, qplsid_k34, sub_eo_k34,
          sub_aa_k34, cuntor_k34, abpfun_k34, hlqs_k34, adclin_k34, idpo_k34, hubzsb_k34,
          altadr_k34, chlbor_k34, qtek14_k34, ctlxml_k34
        FROM k34_tab WHERE idnk34_k34 = ${m.oldK34}
      `);

      // Copy k35 pointing at NEW k34
      await req.query(`
        INSERT INTO k35_tab (idnk35_k35, uptime_k35, upname_k35, idnk34_k35, qty_k35, up_k35, daro_k35, clin_k35)
        SELECT ${m.newK35}, uptime_k35, upname_k35, ${m.newK34}, qty_k35, up_k35, daro_k35, clin_k35
        FROM k35_tab WHERE idnk35_k35 = ${m.oldK35}
      `);

      // Delete old in reverse order (k35 first, then k34)
      const d35 = await req.query(`DELETE FROM k35_tab WHERE idnk35_k35 = ${m.oldK35}`);
      const d34 = await req.query(`DELETE FROM k34_tab WHERE idnk34_k34 = ${m.oldK34}`);
      if (d35.rowsAffected[0] !== 1 || d34.rowsAffected[0] !== 1) {
        throw new Error(`delete counts wrong for ${m.oldK34}: k35=${d35.rowsAffected[0]}, k34=${d34.rowsAffected[0]}`);
      }
      console.log(`  staged move: ${m.oldK34}/${m.oldK35} → ${m.newK34}/${m.newK35}`);
    }

    await tx.commit();
    console.log(`  ✓ Transaction committed — all ${MOVES.length} pairs moved atomically`);
  } catch (e: any) {
    try { await tx.rollback(); console.log(`  Rolled back — no changes applied.`); } catch {}
    console.error(`  ✗ ${e.message}`);
    throw e;
  }

  console.log(`\n→ Abe can retry his save now. His counter (probably at 495750 or 495751) has a clear path through to ~999750.`);

  await pool.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
