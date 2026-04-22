// SECOND write-back test — appends SPE2DS-26-T-9795 @ $24 × 1 EA, 35d ARO
// under Abe's existing staged envelope 46853 (currently has 1 line).
// Allocates new idnk34/idnk35 from kdy_tab (LamLinks' sequence table) — the
// exact protocol the LamLinks client uses. See docs/lamlinks-writeback.md.

import "./env";
import sql from "mssql/msnodesqlv8";

const CONFIG = {
  PARENT_IDNK33: 46853,
  TEMPLATE_IDNK34: 495731,    // Abe's first line in this envelope
  TARGET_SOL: "SPE2DS-26-T-9795",
  TARGET_NIIN: "01-215-4177",
  BID_PRICE: 24.00,
  BID_QTY: 1,
  DELIVERY_DAYS: 35,
  UPNAME: "ajoseph   ",
};

function pad(s: string, n: number) { return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }

async function main() {
  const execute = process.argv.includes("--execute");
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  const env = await pool.request().query(`
    SELECT o_stat_k33, itmcnt_k33,
           (SELECT COUNT(*) FROM k34_tab WHERE idnk33_k34 = ${CONFIG.PARENT_IDNK33}) AS actual_lines
    FROM k33_tab WHERE idnk33_k33 = ${CONFIG.PARENT_IDNK33}
  `);
  if (env.recordset.length === 0) throw new Error(`Envelope ${CONFIG.PARENT_IDNK33} not found`);
  const e = env.recordset[0];
  if (String(e.o_stat_k33).trim() !== "adding quotes") throw new Error(`Envelope not in staging (o_stat="${String(e.o_stat_k33).trim()}")`);
  console.log(`[1/4] ✓ Envelope ${CONFIG.PARENT_IDNK33} staged, itmcnt=${e.itmcnt_k33}, lines=${e.actual_lines}`);

  const tmpl = await pool.request().query(`SELECT idnk33_k34 FROM k34_tab WHERE idnk34_k34 = ${CONFIG.TEMPLATE_IDNK34}`);
  if (tmpl.recordset.length === 0) throw new Error(`Template k34 ${CONFIG.TEMPLATE_IDNK34} not found`);
  if (tmpl.recordset[0].idnk33_k34 !== CONFIG.PARENT_IDNK33) throw new Error(`Template not under our envelope`);
  console.log(`[2/4] ✓ Template k34 ${CONFIG.TEMPLATE_IDNK34} exists, under envelope ${CONFIG.PARENT_IDNK33}`);

  const look = await pool.request().query(`
    SELECT k11.idnk11_k11, k11.solqty_k11, k11.sol_um_k11, k08.partno_k08, k08.p_cage_k08
    FROM k11_tab k11
    INNER JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
    INNER JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
    WHERE k10.sol_no_k10 = '${CONFIG.TARGET_SOL}' AND k08.niin_k08 = '${CONFIG.TARGET_NIIN}'
  `);
  if (look.recordset.length === 0) throw new Error(`Sol/NIIN not found`);
  const L = look.recordset[0];
  const idnk11 = L.idnk11_k11 as number;
  const solqty = L.solqty_k11 as number;
  const uom = String(L.sol_um_k11 || "").trim() || "EA";
  const mfrPn = String(L.partno_k08 || "").trim();
  const mfrCage = String(L.p_cage_k08 || "").trim();
  console.log(`[3/4] ✓ Target: idnk11=${idnk11}, solqty=${solqty} ${uom}, pn=${mfrPn}, mcage=${mfrCage}`);

  const max = await pool.request().query(`SELECT MAX(idnk34_k34) AS m34, (SELECT MAX(idnk35_k35) FROM k35_tab) AS m35 FROM k34_tab`);
  const peek34 = max.recordset[0].m34 + 1;
  const peek35 = max.recordset[0].m35 + 1;
  console.log(`[4/4] ✓ Next ids (peek): k34=${peek34}, k35=${peek35}`);

  console.log(`\n=== PLAN ===`);
  console.log(`INSERT k34 cloning template ${CONFIG.TEMPLATE_IDNK34}; overrides:`);
  console.log(`  idnk34_k34=${peek34}  uptime=GETDATE()  idnk11=${idnk11}  idnk33=${CONFIG.PARENT_IDNK33}`);
  console.log(`  pn="${mfrPn}"  mcage="${mfrCage}"  qty_ui="${uom}"  solqty=${solqty}`);
  console.log(`INSERT k35: idnk35=${peek35}, idnk34=${peek34}, qty=${CONFIG.BID_QTY}, up=${CONFIG.BID_PRICE}, daro=${CONFIG.DELIVERY_DAYS}`);
  console.log(`UPDATE k33 ${CONFIG.PARENT_IDNK33}: itmcnt+1 → ${e.itmcnt_k33 + 1}, uptime=GETDATE()`);
  console.log(`All inside one transaction with TABLOCKX+HOLDLOCK on k34/k35, UPDLOCK on k33.`);

  if (!execute) { console.log(`\nDRY RUN. Re-run with --execute.\n`); await pool.close(); return; }

  console.log(`\n=== EXECUTING ===`);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);

    const envLock = await req.query(`SELECT o_stat_k33, itmcnt_k33 FROM k33_tab WITH (UPDLOCK, HOLDLOCK) WHERE idnk33_k33 = ${CONFIG.PARENT_IDNK33}`);
    if (String(envLock.recordset[0].o_stat_k33).trim() !== "adding quotes") throw new Error(`Envelope flipped state`);

    const k34Alloc = await req.query(`
      DECLARE @newId INT;
      UPDATE kdy_tab WITH (ROWLOCK, HOLDLOCK)
      SET idnval_kdy = idnval_kdy + 1, @newId = idnval_kdy + 1
      WHERE tabnam_kdy = 'k34_tab';
      SELECT @newId AS id;
    `);
    const k35Alloc = await req.query(`
      DECLARE @newId INT;
      UPDATE kdy_tab WITH (ROWLOCK, HOLDLOCK)
      SET idnval_kdy = idnval_kdy + 1, @newId = idnval_kdy + 1
      WHERE tabnam_kdy = 'k35_tab';
      SELECT @newId AS id;
    `);
    const newK34 = k34Alloc.recordset[0].id as number;
    const newK35 = k35Alloc.recordset[0].id as number;
    if (!newK34 || !newK35) throw new Error(`kdy allocation failed: k34=${newK34}, k35=${newK35}`);
    console.log(`  Allocated from kdy_tab: k34=${newK34}, k35=${newK35}`);

    const safePn = mfrPn.replace(/'/g, "''");
    const safeCage = mfrCage.replace(/'/g, "''");

    const ins34 = await req.query(`
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
        ${newK34}, GETDATE(), upname_k34, ${idnk11}, ${CONFIG.PARENT_IDNK33},
        CAST('${safePn}' AS CHAR(32)), pn_rev_k34,
        scage_k34, sname_k34, saddr1_k34, saddr2_k34, scitys_k34, szip_k34, sfax_k34,
        sphone_k34, semail_k34, sattn_k34, stitle_k34, staxid_k34, bizsiz_k34, disadv_k34,
        womown_k34, CAST('${safeCage}' AS CHAR(5)),
        s1cage_k34, s1name_k34, s1city_k34, s2cage_k34, s2name_k34,
        s2city_k34, s3cage_k34, s3name_k34, s3city_k34, trmdes_k34, bidtyp_k34, p0301_k34,
        fobcod_k34, shpcty_k34, valday_k34, allqty_k34, insmat_k34, inspkg_k34, hazard_k34,
        forign_k34, newprt_k34, surpls_k34, rebilt_k34, qtyvpp_k34, qtyvmp_k34, baspon_k34,
        qmcage_k34, qscage_k34, qpltno_k34, dly_ar_k34,
        CAST('${pad(uom, 2)}' AS CHAR(2)), ${solqty},
        gennte_k34, pkgnte_k34, qrefno_k34, orgtyp_k34, popnam_k34, poptin_k34, qplsid_k34,
        sub_eo_k34, sub_aa_k34, cuntor_k34, abpfun_k34, hlqs_k34, adclin_k34, idpo_k34,
        hubzsb_k34, altadr_k34, chlbor_k34, qtek14_k34, ctlxml_k34
      FROM k34_tab WHERE idnk34_k34 = ${CONFIG.TEMPLATE_IDNK34}
    `);
    if (ins34.rowsAffected[0] !== 1) throw new Error(`k34 insert count=${ins34.rowsAffected[0]}`);

    const ins35 = await req.query(`
      INSERT INTO k35_tab (idnk35_k35, uptime_k35, upname_k35, idnk34_k35, qty_k35, up_k35, daro_k35, clin_k35)
      VALUES (${newK35}, GETDATE(), '${CONFIG.UPNAME}', ${newK34}, ${CONFIG.BID_QTY}, ${CONFIG.BID_PRICE}, ${CONFIG.DELIVERY_DAYS}, '      ')
    `);
    if (ins35.rowsAffected[0] !== 1) throw new Error(`k35 insert count=${ins35.rowsAffected[0]}`);

    const upd33 = await req.query(`
      UPDATE k33_tab SET itmcnt_k33 = itmcnt_k33 + 1, uptime_k33 = GETDATE()
      WHERE idnk33_k33 = ${CONFIG.PARENT_IDNK33}
    `);
    if (upd33.rowsAffected[0] !== 1) throw new Error(`k33 update count=${upd33.rowsAffected[0]}`);

    await tx.commit();
    console.log(`  ✓ Committed. k34=${newK34}, k35=${newK35}, itmcnt bumped`);

    // Verify
    const v = await pool.request().query(`
      SELECT itmcnt_k33, (SELECT COUNT(*) FROM k34_tab WHERE idnk33_k34=${CONFIG.PARENT_IDNK33}) AS actual
      FROM k33_tab WHERE idnk33_k33 = ${CONFIG.PARENT_IDNK33}
    `);
    const vK34 = await pool.request().query(`SELECT idnk34_k34, idnk11_k34, pn_k34, mcage_k34, qty_ui_k34, solqty_k34 FROM k34_tab WHERE idnk34_k34 = ${newK34}`);
    const vK35 = await pool.request().query(`SELECT * FROM k35_tab WHERE idnk35_k35 = ${newK35}`);
    console.log(`\n=== VERIFIED ===`);
    console.log(`  envelope itmcnt=${v.recordset[0].itmcnt_k33}, actual=${v.recordset[0].actual}, match=${v.recordset[0].itmcnt_k33 === v.recordset[0].actual ? "YES ✓" : "NO ✗"}`);
    console.log(`  k34 ${newK34}:`, JSON.stringify(vK34.recordset[0]));
    console.log(`  k35 ${newK35}:`, JSON.stringify(vK35.recordset[0]));
    console.log(`\n→ Tell Abe: refresh LamLinks, open envelope 46853, should show 2 lines.`);
    console.log(`  Line 2 = ${CONFIG.TARGET_SOL}, $${CONFIG.BID_PRICE} × ${CONFIG.BID_QTY} ${uom}, ${CONFIG.DELIVERY_DAYS}d.`);
  } catch (e: any) {
    console.error(`\nERROR: ${e.message}`);
    try { await tx.rollback(); console.log(`  Rolled back.`); } catch {}
    process.exitCode = 1;
  } finally {
    await pool.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
