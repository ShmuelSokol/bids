// EMERGENCY: our insert at idnk34=495731 collides with Abe's client-side
// pre-reserved id. LamLinks' client grabs MAX+1 when the quote form opens,
// not at save time. So Abe's client thinks 495731 is its next id.
//
// Fix: shift our row to a much higher idnk34 (leave gap for Abe's client).
// Use idnk34 = current MAX + 20 to be safe.

import "./env";
import sql from "mssql/msnodesqlv8";

const OLD_K34 = 495731;
const OLD_K35 = 503368;
const PARENT_K33 = 46852;

async function main() {
  const execute = process.argv.includes("--execute");
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Verify current state
  const our34 = await pool.request().query(`SELECT * FROM k34_tab WHERE idnk34_k34 = ${OLD_K34}`);
  const our35 = await pool.request().query(`SELECT * FROM k35_tab WHERE idnk35_k35 = ${OLD_K35}`);
  if (our34.recordset.length !== 1 || our35.recordset.length !== 1) {
    throw new Error(`Our rows missing — maybe already moved? k34=${our34.recordset.length}, k35=${our35.recordset.length}`);
  }
  if (our34.recordset[0].idnk33_k34 !== PARENT_K33) throw new Error(`k34 ${OLD_K34} not under envelope ${PARENT_K33}`);

  const max34 = await pool.request().query(`SELECT MAX(idnk34_k34) AS m FROM k34_tab`);
  const max35 = await pool.request().query(`SELECT MAX(idnk35_k35) AS m FROM k35_tab`);
  const newK34 = max34.recordset[0].m + 20;     // big gap — Abe can save 19 lines before hitting us again
  const newK35 = max35.recordset[0].m + 20;

  console.log(`Current: our k34=${OLD_K34}, k35=${OLD_K35}`);
  console.log(`MAX now: k34=${max34.recordset[0].m}, k35=${max35.recordset[0].m}`);
  console.log(`Plan:    move our k34 to ${newK34}, k35 to ${newK35}  (gap of 20 for Abe's client)`);

  if (!execute) {
    console.log(`\nDRY RUN. Re-run with --execute to perform.`);
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
      throw new Error(`Envelope not in staging — aborting`);
    }

    // Update k35 FIRST (point to new k34), so we don't orphan it mid-way
    // Approach: INSERT new rows with new ids cloned from old, then DELETE old.
    // This avoids any window where idnk35→idnk34 link is inconsistent.

    // Lock both tables
    await req.query(`SELECT TOP 0 * FROM k34_tab WITH (TABLOCKX, HOLDLOCK)`);
    await req.query(`SELECT TOP 0 * FROM k35_tab WITH (TABLOCKX, HOLDLOCK)`);

    // Re-read maxes under lock
    const l34 = await req.query(`SELECT MAX(idnk34_k34) AS m FROM k34_tab`);
    const l35 = await req.query(`SELECT MAX(idnk35_k35) AS m FROM k35_tab`);
    const lockedK34 = l34.recordset[0].m + 20;
    const lockedK35 = l35.recordset[0].m + 20;
    console.log(`  Locked MAX: k34=${l34.recordset[0].m}, k35=${l35.recordset[0].m}`);
    console.log(`  Moving to: k34=${lockedK34}, k35=${lockedK35}`);

    // INSERT new k34 by copying everything from old
    await req.query(`
      INSERT INTO k34_tab
      SELECT
        ${lockedK34}, uptime_k34, upname_k34, idnk11_k34, idnk33_k34, pn_k34, pn_rev_k34,
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
      FROM k34_tab WHERE idnk34_k34 = ${OLD_K34}
    `);

    // INSERT new k35 pointing to new k34
    await req.query(`
      INSERT INTO k35_tab (idnk35_k35, uptime_k35, upname_k35, idnk34_k35, qty_k35, up_k35, daro_k35, clin_k35)
      SELECT ${lockedK35}, uptime_k35, upname_k35, ${lockedK34}, qty_k35, up_k35, daro_k35, clin_k35
      FROM k35_tab WHERE idnk35_k35 = ${OLD_K35}
    `);

    // DELETE old rows
    const d35 = await req.query(`DELETE FROM k35_tab WHERE idnk35_k35 = ${OLD_K35}`);
    const d34 = await req.query(`DELETE FROM k34_tab WHERE idnk34_k34 = ${OLD_K34}`);
    if (d35.rowsAffected[0] !== 1 || d34.rowsAffected[0] !== 1) {
      throw new Error(`delete counts wrong: k35=${d35.rowsAffected[0]}, k34=${d34.rowsAffected[0]}`);
    }

    await tx.commit();
    console.log(`  ✓ Transaction committed`);

    // Verify
    const v = await pool.request().query(`
      SELECT idnk34_k34, idnk11_k34, idnk33_k34, pn_k34, mcage_k34, qty_ui_k34, solqty_k34
      FROM k34_tab WHERE idnk34_k34 = ${lockedK34}
    `);
    const v35 = await pool.request().query(`SELECT * FROM k35_tab WHERE idnk35_k35 = ${lockedK35}`);
    const env = await pool.request().query(`
      SELECT itmcnt_k33, (SELECT COUNT(*) FROM k34_tab WHERE idnk33_k34 = ${PARENT_K33}) AS actual
      FROM k33_tab WHERE idnk33_k33 = ${PARENT_K33}
    `);
    console.log(`\n=== VERIFIED ===`);
    console.log(`  Moved to k34=${lockedK34}:`, JSON.stringify(v.recordset[0]));
    console.log(`  Moved to k35=${lockedK35}:`, JSON.stringify(v35.recordset[0]));
    console.log(`  Envelope itmcnt=${env.recordset[0].itmcnt_k33}, actual_lines=${env.recordset[0].actual}`);
    console.log(`\n→ Abe's next client-reserved id (495731) is now FREE.`);
    console.log(`  Tell Abe to retry saving his line.`);
  } catch (e: any) {
    console.error(`\nERROR: ${e.message}`);
    try { await tx.rollback(); console.log(`  Rolled back.`); } catch {}
    process.exitCode = 1;
  } finally {
    await pool.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
