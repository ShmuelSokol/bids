// REDO — delete our prior test line (k34 495731 + k35 503368) and re-insert
// a new line with the envelope's itmcnt bumped to match the actual line count.
// Also bumps uptime_k33 so the envelope's "last modified" matches what
// LamLinks itself would have written.
//
// Everything in a single transaction. Locks held on k33/k34/k35 throughout,
// so Abe cannot save another line mid-flight.

import "./env";
import sql from "mssql/msnodesqlv8";

const CONFIG = {
  PARENT_IDNK33: 46852,
  TEMPLATE_IDNK34: 495722,
  OLD_IDNK34: 495731,           // our previous insert — delete this
  OLD_IDNK35: 503368,           // our previous price row — delete this
  TARGET_SOL: "SPE2DP-26-T-2975",
  TARGET_NIIN: "01-578-7887",
  BID_PRICE: 46.45,
  BID_QTY: 2,
  DELIVERY_DAYS: 45,
  UPNAME: "ajoseph   ",
};

function pad(s: string, n: number) {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

async function main() {
  const execute = process.argv.includes("--execute");
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Pre-flight checks
  const env = await pool.request().query(`
    SELECT idnk33_k33, o_stat_k33, itmcnt_k33,
           (SELECT COUNT(*) FROM k34_tab WHERE idnk33_k34 = ${CONFIG.PARENT_IDNK33}) AS actual_lines
    FROM k33_tab WHERE idnk33_k33 = ${CONFIG.PARENT_IDNK33}
  `);
  if (env.recordset.length === 0) throw new Error(`Envelope ${CONFIG.PARENT_IDNK33} not found.`);
  const e = env.recordset[0];
  if (String(e.o_stat_k33).trim() !== "adding quotes") {
    throw new Error(`Envelope ${CONFIG.PARENT_IDNK33} is NOT in staging — o_stat="${String(e.o_stat_k33).trim()}". Aborting.`);
  }
  console.log(`✓ Envelope ${CONFIG.PARENT_IDNK33} staged. itmcnt=${e.itmcnt_k33}, actual lines=${e.actual_lines}`);

  const oldK34 = await pool.request().query(`SELECT idnk34_k34, idnk33_k34 FROM k34_tab WHERE idnk34_k34 = ${CONFIG.OLD_IDNK34}`);
  const oldK35 = await pool.request().query(`SELECT idnk35_k35, idnk34_k35 FROM k35_tab WHERE idnk35_k35 = ${CONFIG.OLD_IDNK35}`);
  if (oldK34.recordset.length !== 1) throw new Error(`Old k34 ${CONFIG.OLD_IDNK34} not found — maybe already deleted?`);
  if (oldK35.recordset.length !== 1) throw new Error(`Old k35 ${CONFIG.OLD_IDNK35} not found — maybe already deleted?`);
  if (oldK34.recordset[0].idnk33_k34 !== CONFIG.PARENT_IDNK33) throw new Error(`Old k34 is not under our envelope — aborting`);
  if (oldK35.recordset[0].idnk34_k35 !== CONFIG.OLD_IDNK34) throw new Error(`Old k35 is not linked to our old k34 — aborting`);
  console.log(`✓ Old rows found: k34=${CONFIG.OLD_IDNK34}, k35=${CONFIG.OLD_IDNK35}`);

  const lookup = await pool.request().query(`
    SELECT k11.idnk11_k11, k11.solqty_k11, k11.sol_um_k11,
           k08.partno_k08, k08.p_cage_k08
    FROM k11_tab k11
    INNER JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
    INNER JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
    WHERE k10.sol_no_k10 = '${CONFIG.TARGET_SOL}' AND k08.niin_k08 = '${CONFIG.TARGET_NIIN}'
  `);
  if (lookup.recordset.length === 0) throw new Error(`Sol/NIIN not found.`);
  const look = lookup.recordset[0];
  const targetIdnk11: number = look.idnk11_k11;
  const targetSolqty: number = look.solqty_k11;
  const targetUom: string = String(look.sol_um_k11 || "").trim() || "EA";
  const mfrPn: string = String(look.partno_k08 || "").trim();
  const mfrCage: string = String(look.p_cage_k08 || "").trim();
  console.log(`✓ Target resolved: idnk11=${targetIdnk11}, solqty=${targetSolqty}, UoI=${targetUom}, pn=${mfrPn}, mcage=${mfrCage}`);

  console.log(`\n=== PLAN ===`);
  console.log(`Inside ONE transaction with TABLOCKX+HOLDLOCK on k33/k34/k35:`);
  console.log(`  1. DELETE k35_tab WHERE idnk35_k35 = ${CONFIG.OLD_IDNK35}`);
  console.log(`  2. DELETE k34_tab WHERE idnk34_k34 = ${CONFIG.OLD_IDNK34}`);
  console.log(`  3. Compute new idnk34, idnk35 (locked MAX+1)`);
  console.log(`  4. INSERT new k34 (clone from ${CONFIG.TEMPLATE_IDNK34}, override 7 fields)`);
  console.log(`  5. INSERT new k35 ($${CONFIG.BID_PRICE} × ${CONFIG.BID_QTY}, ${CONFIG.DELIVERY_DAYS}d)`);
  console.log(`  6. UPDATE k33_tab SET itmcnt_k33 = itmcnt_k33 + 1, uptime_k33 = GETDATE() WHERE idnk33_k33 = ${CONFIG.PARENT_IDNK33}`);
  console.log(`     (current itmcnt=${e.itmcnt_k33}, after = ${e.itmcnt_k33 + 1} — matches the ${e.actual_lines} actual lines minus the old one we're deleting + new one we're inserting = ${e.actual_lines})`);
  console.log(`  7. Commit`);

  if (!execute) {
    console.log(`\nDRY RUN. Re-run with --execute to perform.`);
    await pool.close();
    return;
  }

  console.log(`\n=== EXECUTING ===`);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);

    // Re-verify envelope still staged (inside transaction, with lock)
    const envCheck = await req.query(`
      SELECT o_stat_k33, itmcnt_k33 FROM k33_tab WITH (UPDLOCK, HOLDLOCK) WHERE idnk33_k33 = ${CONFIG.PARENT_IDNK33}
    `);
    const oStatLocked = String(envCheck.recordset[0]?.o_stat_k33 || "").trim();
    if (oStatLocked !== "adding quotes") throw new Error(`Envelope state changed: o_stat="${oStatLocked}"`);
    const curItmcnt = envCheck.recordset[0].itmcnt_k33;
    console.log(`  Locked envelope, current itmcnt=${curItmcnt}`);

    // Lock k34/k35 tables
    await req.query(`SELECT TOP 0 * FROM k34_tab WITH (TABLOCKX, HOLDLOCK)`);
    await req.query(`SELECT TOP 0 * FROM k35_tab WITH (TABLOCKX, HOLDLOCK)`);

    // Delete k35 first (FK-ish child), then k34
    const delK35 = await req.query(`DELETE FROM k35_tab WHERE idnk35_k35 = ${CONFIG.OLD_IDNK35} AND idnk34_k35 = ${CONFIG.OLD_IDNK34}`);
    if (delK35.rowsAffected[0] !== 1) throw new Error(`Old k35 delete affected ${delK35.rowsAffected[0]} rows, expected 1`);
    const delK34 = await req.query(`DELETE FROM k34_tab WHERE idnk34_k34 = ${CONFIG.OLD_IDNK34} AND idnk33_k34 = ${CONFIG.PARENT_IDNK33}`);
    if (delK34.rowsAffected[0] !== 1) throw new Error(`Old k34 delete affected ${delK34.rowsAffected[0]} rows, expected 1`);
    console.log(`  ✓ Deleted old k34=${CONFIG.OLD_IDNK34} and k35=${CONFIG.OLD_IDNK35}`);

    // New IDs (locked MAX)
    const l34 = await req.query(`SELECT ISNULL(MAX(idnk34_k34),0)+1 AS m FROM k34_tab`);
    const l35 = await req.query(`SELECT ISNULL(MAX(idnk35_k35),0)+1 AS m FROM k35_tab`);
    const nextK34: number = l34.recordset[0].m;
    const nextK35: number = l35.recordset[0].m;
    console.log(`  Locked new IDs: idnk34=${nextK34}, idnk35=${nextK35}`);

    const safePn = mfrPn.replace(/'/g, "''");
    const safeCage = mfrCage.replace(/'/g, "''");

    const insertK34 = `
      INSERT INTO k34_tab (
        idnk34_k34, uptime_k34, upname_k34, idnk11_k34, idnk33_k34, pn_k34, pn_rev_k34,
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
      )
      SELECT
        ${nextK34}, GETDATE(), upname_k34, ${targetIdnk11}, ${CONFIG.PARENT_IDNK33},
        CAST('${safePn}' AS CHAR(32)), pn_rev_k34,
        scage_k34, sname_k34, saddr1_k34, saddr2_k34, scitys_k34, szip_k34, sfax_k34,
        sphone_k34, semail_k34, sattn_k34, stitle_k34, staxid_k34, bizsiz_k34, disadv_k34,
        womown_k34, CAST('${safeCage}' AS CHAR(5)),
        s1cage_k34, s1name_k34, s1city_k34, s2cage_k34, s2name_k34,
        s2city_k34, s3cage_k34, s3name_k34, s3city_k34, trmdes_k34, bidtyp_k34, p0301_k34,
        fobcod_k34, shpcty_k34, valday_k34, allqty_k34, insmat_k34, inspkg_k34, hazard_k34,
        forign_k34, newprt_k34, surpls_k34, rebilt_k34, qtyvpp_k34, qtyvmp_k34, baspon_k34,
        qmcage_k34, qscage_k34, qpltno_k34, dly_ar_k34,
        CAST('${pad(targetUom, 2)}' AS CHAR(2)), ${targetSolqty},
        gennte_k34, pkgnte_k34, qrefno_k34, orgtyp_k34, popnam_k34, poptin_k34, qplsid_k34,
        sub_eo_k34, sub_aa_k34, cuntor_k34, abpfun_k34, hlqs_k34, adclin_k34, idpo_k34,
        hubzsb_k34, altadr_k34, chlbor_k34, qtek14_k34, ctlxml_k34
      FROM k34_tab WHERE idnk34_k34 = ${CONFIG.TEMPLATE_IDNK34}
    `;
    const k34Result = await req.query(insertK34);
    if (k34Result.rowsAffected[0] !== 1) throw new Error(`k34 insert affected ${k34Result.rowsAffected[0]} rows`);
    console.log(`  ✓ k34 ${nextK34} inserted`);

    const k35Result = await req.query(`
      INSERT INTO k35_tab (idnk35_k35, uptime_k35, upname_k35, idnk34_k35, qty_k35, up_k35, daro_k35, clin_k35)
      VALUES (${nextK35}, GETDATE(), '${CONFIG.UPNAME}', ${nextK34}, ${CONFIG.BID_QTY}, ${CONFIG.BID_PRICE}, ${CONFIG.DELIVERY_DAYS}, '      ')
    `);
    if (k35Result.rowsAffected[0] !== 1) throw new Error(`k35 insert affected ${k35Result.rowsAffected[0]} rows`);
    console.log(`  ✓ k35 ${nextK35} inserted`);

    // Bump envelope itmcnt + uptime
    const updResult = await req.query(`
      UPDATE k33_tab
      SET itmcnt_k33 = itmcnt_k33 + 1, uptime_k33 = GETDATE()
      WHERE idnk33_k33 = ${CONFIG.PARENT_IDNK33}
    `);
    if (updResult.rowsAffected[0] !== 1) throw new Error(`k33 update affected ${updResult.rowsAffected[0]} rows`);
    console.log(`  ✓ k33 itmcnt bumped to ${curItmcnt + 1}, uptime_k33 refreshed`);

    await tx.commit();
    console.log(`  ✓ Transaction committed`);

    // Verify
    const vEnv = await pool.request().query(`
      SELECT itmcnt_k33, uptime_k33, o_stat_k33,
             (SELECT COUNT(*) FROM k34_tab WHERE idnk33_k34 = ${CONFIG.PARENT_IDNK33}) AS actual
      FROM k33_tab WHERE idnk33_k33 = ${CONFIG.PARENT_IDNK33}
    `);
    const vK34 = await pool.request().query(`
      SELECT idnk34_k34, idnk11_k34, pn_k34, mcage_k34, qty_ui_k34, solqty_k34
      FROM k34_tab WHERE idnk34_k34 = ${nextK34}
    `);
    const vK35 = await pool.request().query(`SELECT * FROM k35_tab WHERE idnk35_k35 = ${nextK35}`);

    console.log(`\n=== VERIFIED ===`);
    console.log(`  envelope: itmcnt=${vEnv.recordset[0].itmcnt_k33}, actual_lines=${vEnv.recordset[0].actual}, match: ${vEnv.recordset[0].itmcnt_k33 === vEnv.recordset[0].actual ? "YES ✓" : "NO ✗"}`);
    console.log(`  uptime_k33: ${vEnv.recordset[0].uptime_k33?.toISOString?.()}`);
    console.log(`  new k34 ${nextK34}:`, JSON.stringify(vK34.recordset[0]));
    console.log(`  new k35 ${nextK35}:`, JSON.stringify(vK35.recordset[0]));

    console.log(`\n→ Tell Abe: refresh LamLinks, open envelope ${CONFIG.PARENT_IDNK33}, should show 10 lines.`);
    console.log(`  Header should say "10 items" (we bumped itmcnt to match).`);
    console.log(`  Line 10 = SPE2DP-26-T-2975 @ $${CONFIG.BID_PRICE} × ${CONFIG.BID_QTY}, 45d.`);
  } catch (e: any) {
    console.error(`\nERROR: ${e.message}`);
    try { await tx.rollback(); console.log(`  Rolled back.`); } catch {}
    process.exitCode = 1;
  } finally {
    await pool.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
