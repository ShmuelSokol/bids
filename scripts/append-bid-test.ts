// TEST BID WRITE-BACK — appends one k34+k35 line under Abe's EXISTING staged envelope.
//
// We do NOT create a new k33 envelope. We piggyback on idnk33=46852 (Abe's current
// saved-but-not-posted quote). After insert, Abe sees a 3rd line in his existing
// LamLinks quote form. He reviews, then Posts (or deletes) as normal.
//
// Safety layers:
//   1. Confirms envelope 46852 is still in 'adding quotes' state (not posted).
//   2. Confirms template k34 row 495722 still exists (source of metadata clone).
//   3. Resolves target sol/NIIN to its k11 + k08 record; aborts if not found.
//   4. Wraps BOTH inserts in a single transaction with TABLOCKX+HOLDLOCK on k34/k35.
//      No other session can write to those tables between the MAX() read and COMMIT.
//   5. Re-reads the locked MAX right before insert (not the earlier unlocked peek).
//   6. Verifies inserted rows after commit.
//   7. Defaults to DRY RUN. Only --execute performs writes.
//
// Usage:
//   npx tsx scripts/append-bid-test.ts            (dry run — shows the plan)
//   npx tsx scripts/append-bid-test.ts --execute  (performs the inserts)

import "./env";
import sql from "mssql/msnodesqlv8";

const CONFIG = {
  PARENT_IDNK33: 46852,              // Abe's existing staged envelope
  TEMPLATE_IDNK34: 495722,           // k34 line to clone metadata from
  TARGET_SOL: "SPE2DP-26-T-2975",    // test solicitation
  TARGET_NIIN: "01-578-7887",        // NSN 6509-01-578-7887 — stored with dashes in k08
  BID_PRICE: 46.45,
  BID_QTY: 2,
  DELIVERY_DAYS: 45,
  UPNAME: "ajoseph   ",              // char(10), must match envelope owner
};

function pad(s: string, n: number) {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

async function main() {
  const execute = process.argv.includes("--execute");
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // ── 1. Envelope still in staging? ───────────────────────────────────────────
  const env = await pool.request().query(`
    SELECT idnk33_k33, upname_k33, o_stat_k33, t_stat_k33, itmcnt_k33
    FROM k33_tab WHERE idnk33_k33 = ${CONFIG.PARENT_IDNK33}
  `);
  if (env.recordset.length === 0) throw new Error(`k33 envelope ${CONFIG.PARENT_IDNK33} not found.`);
  const envRow = env.recordset[0];
  const oStat = String(envRow.o_stat_k33 || "").trim();
  if (oStat !== "adding quotes") {
    throw new Error(
      `Envelope ${CONFIG.PARENT_IDNK33} is NOT in staging — o_stat="${oStat}". ` +
      `It may have been posted. Aborting.`
    );
  }
  console.log(`[1/5] ✓ Envelope ${CONFIG.PARENT_IDNK33} is staged (o_stat="${oStat}", upname="${envRow.upname_k33?.trim()}", itmcnt=${envRow.itmcnt_k33})`);

  // ── 2. Template row exists? ─────────────────────────────────────────────────
  const tmpl = await pool.request().query(`
    SELECT idnk34_k34, idnk11_k34, idnk33_k34, pn_k34, mcage_k34, qty_ui_k34, solqty_k34
    FROM k34_tab WHERE idnk34_k34 = ${CONFIG.TEMPLATE_IDNK34}
  `);
  if (tmpl.recordset.length === 0) throw new Error(`Template k34 ${CONFIG.TEMPLATE_IDNK34} not found.`);
  const tmplRow = tmpl.recordset[0];
  if (tmplRow.idnk33_k34 !== CONFIG.PARENT_IDNK33) {
    throw new Error(`Template ${CONFIG.TEMPLATE_IDNK34} is not under envelope ${CONFIG.PARENT_IDNK33} (it's under ${tmplRow.idnk33_k34}). Aborting.`);
  }
  console.log(`[2/5] ✓ Template k34 ${CONFIG.TEMPLATE_IDNK34} found (currently pn="${tmplRow.pn_k34?.trim()}", mcage="${tmplRow.mcage_k34}")`);

  // ── 3. Resolve target sol/NIIN → k11 + k08 ─────────────────────────────────
  const lookup = await pool.request().query(`
    SELECT k11.idnk11_k11, k11.solqty_k11, k11.sol_um_k11,
           k08.partno_k08, k08.p_cage_k08, k08.niin_k08, k08.fsc_k08
    FROM k11_tab k11
    INNER JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
    INNER JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
    WHERE k10.sol_no_k10 = '${CONFIG.TARGET_SOL}' AND k08.niin_k08 = '${CONFIG.TARGET_NIIN}'
  `);
  if (lookup.recordset.length === 0) {
    throw new Error(`Sol ${CONFIG.TARGET_SOL} / NIIN ${CONFIG.TARGET_NIIN} not found in k10/k11/k08. Aborting.`);
  }
  const look = lookup.recordset[0];
  const targetIdnk11: number = look.idnk11_k11;
  const targetSolqty: number = look.solqty_k11;
  const targetUom: string = String(look.sol_um_k11 || "").trim() || "EA";
  const mfrPn: string = String(look.partno_k08 || "").trim();
  const mfrCage: string = String(look.p_cage_k08 || "").trim();
  console.log(`[3/5] ✓ Target k11 resolved:`);
  console.log(`        idnk11=${targetIdnk11}  solqty=${targetSolqty}  UoI="${targetUom}"  FSC=${look.fsc_k08}`);
  console.log(`        MFR part="${mfrPn}"  MFR cage="${mfrCage}"`);

  // ── 4. Peek at current MAX ids (unlocked — for planning display) ───────────
  const max34 = await pool.request().query(`SELECT ISNULL(MAX(idnk34_k34),0) AS m FROM k34_tab`);
  const max35 = await pool.request().query(`SELECT ISNULL(MAX(idnk35_k35),0) AS m FROM k35_tab`);
  const peekNext34 = max34.recordset[0].m + 1;
  const peekNext35 = max35.recordset[0].m + 1;
  console.log(`[4/5] ✓ Current max IDs: idnk34=${max34.recordset[0].m} → next=${peekNext34}, idnk35=${max35.recordset[0].m} → next=${peekNext35}`);

  // ── 5. Show the plan ────────────────────────────────────────────────────────
  console.log(`\n=== PLAN ===`);
  console.log(`INSERT k34_tab (one new line, cloning all metadata from ${CONFIG.TEMPLATE_IDNK34}):`);
  console.log(`  idnk34_k34 = <locked MAX+1>  (peek: ${peekNext34})`);
  console.log(`  uptime_k34 = GETDATE()`);
  console.log(`  idnk11_k34 = ${targetIdnk11}                  (new sol link)`);
  console.log(`  idnk33_k34 = ${CONFIG.PARENT_IDNK33}                     (same envelope as Abe's 2 lines)`);
  console.log(`  pn_k34     = "${mfrPn}"`);
  console.log(`  mcage_k34  = "${mfrCage}"`);
  console.log(`  qty_ui_k34 = "${targetUom}"`);
  console.log(`  solqty_k34 = ${targetSolqty}`);
  console.log(`  [all other 66 columns copied verbatim from ${CONFIG.TEMPLATE_IDNK34}]`);
  console.log(`\nINSERT k35_tab (price row):`);
  console.log(`  idnk35_k35 = <locked MAX+1>  (peek: ${peekNext35})`);
  console.log(`  uptime_k35 = GETDATE()`);
  console.log(`  upname_k35 = "${CONFIG.UPNAME.trim()}"`);
  console.log(`  idnk34_k35 = <the new k34 id>`);
  console.log(`  qty_k35    = ${CONFIG.BID_QTY}`);
  console.log(`  up_k35     = ${CONFIG.BID_PRICE}`);
  console.log(`  daro_k35   = ${CONFIG.DELIVERY_DAYS}`);
  console.log(`  clin_k35   = "      "`);
  console.log(`\nBoth inserts wrapped in a single transaction. k34 and k35 locked with TABLOCKX+HOLDLOCK.`);

  if (!execute) {
    console.log(`\nDRY RUN. Re-run with --execute to perform the inserts.\n`);
    await pool.close();
    return;
  }

  // ── EXECUTE ────────────────────────────────────────────────────────────────
  console.log(`\n=== EXECUTING ===`);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);

    // Re-verify envelope is still staged INSIDE the transaction — defends against
    // Abe hitting Post between our first check and here.
    const envCheck = await req.query(`
      SELECT o_stat_k33 FROM k33_tab WITH (UPDLOCK, HOLDLOCK) WHERE idnk33_k33 = ${CONFIG.PARENT_IDNK33}
    `);
    const oStatLocked = String(envCheck.recordset[0]?.o_stat_k33 || "").trim();
    if (oStatLocked !== "adding quotes") {
      throw new Error(`Envelope state changed mid-flight: o_stat="${oStatLocked}". Rolling back.`);
    }

    // Locked MAX reads
    const l34 = await req.query(`SELECT ISNULL(MAX(idnk34_k34),0)+1 AS m FROM k34_tab WITH (TABLOCKX, HOLDLOCK)`);
    const l35 = await req.query(`SELECT ISNULL(MAX(idnk35_k35),0)+1 AS m FROM k35_tab WITH (TABLOCKX, HOLDLOCK)`);
    const nextK34: number = l34.recordset[0].m;
    const nextK35: number = l35.recordset[0].m;
    console.log(`  Locked: idnk34=${nextK34}, idnk35=${nextK35}`);

    // Escape MFR PN for SQL literal (just in case it contains an apostrophe)
    const safePn = mfrPn.replace(/'/g, "''");
    const safeCage = mfrCage.replace(/'/g, "''");

    // INSERT k34: clone from template, override 8 fields.
    // 74 columns listed in exact ordinal order. Only commented ones are overrides.
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
        ${nextK34},                           -- idnk34_k34  [override]
        GETDATE(),                            -- uptime_k34  [override]
        upname_k34,
        ${targetIdnk11},                      -- idnk11_k34  [override]
        ${CONFIG.PARENT_IDNK33},              -- idnk33_k34  [override (same value, explicit)]
        CAST('${safePn}' AS CHAR(32)),        -- pn_k34      [override]
        pn_rev_k34,
        scage_k34, sname_k34, saddr1_k34, saddr2_k34, scitys_k34, szip_k34, sfax_k34,
        sphone_k34, semail_k34, sattn_k34, stitle_k34, staxid_k34, bizsiz_k34, disadv_k34,
        womown_k34,
        CAST('${safeCage}' AS CHAR(5)),       -- mcage_k34   [override]
        s1cage_k34, s1name_k34, s1city_k34, s2cage_k34, s2name_k34,
        s2city_k34, s3cage_k34, s3name_k34, s3city_k34, trmdes_k34, bidtyp_k34, p0301_k34,
        fobcod_k34, shpcty_k34, valday_k34, allqty_k34, insmat_k34, inspkg_k34, hazard_k34,
        forign_k34, newprt_k34, surpls_k34, rebilt_k34, qtyvpp_k34, qtyvmp_k34, baspon_k34,
        qmcage_k34, qscage_k34, qpltno_k34, dly_ar_k34,
        CAST('${pad(targetUom, 2)}' AS CHAR(2)),   -- qty_ui_k34 [override]
        ${targetSolqty},                           -- solqty_k34 [override]
        gennte_k34, pkgnte_k34, qrefno_k34, orgtyp_k34, popnam_k34, poptin_k34, qplsid_k34,
        sub_eo_k34, sub_aa_k34, cuntor_k34, abpfun_k34, hlqs_k34, adclin_k34, idpo_k34,
        hubzsb_k34, altadr_k34, chlbor_k34, qtek14_k34, ctlxml_k34
      FROM k34_tab WITH (TABLOCKX, HOLDLOCK) WHERE idnk34_k34 = ${CONFIG.TEMPLATE_IDNK34}
    `;
    const k34Result = await req.query(insertK34);
    if (k34Result.rowsAffected[0] !== 1) {
      throw new Error(`k34 insert affected ${k34Result.rowsAffected[0]} rows, expected 1. Rolling back.`);
    }
    console.log(`  ✓ k34 row ${nextK34} inserted`);

    // INSERT k35
    const insertK35 = `
      INSERT INTO k35_tab (idnk35_k35, uptime_k35, upname_k35, idnk34_k35, qty_k35, up_k35, daro_k35, clin_k35)
      VALUES (${nextK35}, GETDATE(), '${CONFIG.UPNAME}', ${nextK34}, ${CONFIG.BID_QTY}, ${CONFIG.BID_PRICE}, ${CONFIG.DELIVERY_DAYS}, '      ')
    `;
    const k35Result = await req.query(insertK35);
    if (k35Result.rowsAffected[0] !== 1) {
      throw new Error(`k35 insert affected ${k35Result.rowsAffected[0]} rows, expected 1. Rolling back.`);
    }
    console.log(`  ✓ k35 row ${nextK35} inserted`);

    await tx.commit();
    console.log(`  ✓ Transaction committed`);

    // Verify
    const vK34 = await pool.request().query(`
      SELECT idnk34_k34, idnk11_k34, idnk33_k34, pn_k34, mcage_k34, qty_ui_k34, solqty_k34
      FROM k34_tab WHERE idnk34_k34 = ${nextK34}
    `);
    const vK35 = await pool.request().query(`SELECT * FROM k35_tab WHERE idnk35_k35 = ${nextK35}`);
    console.log(`\n=== VERIFIED ===`);
    console.log(`  k34 ${nextK34}:`, JSON.stringify(vK34.recordset[0]));
    console.log(`  k35 ${nextK35}:`, JSON.stringify(vK35.recordset[0]));
    console.log(`\n→ Tell Abe: open LamLinks → envelope ${CONFIG.PARENT_IDNK33} → should show a 3rd line:`);
    console.log(`   sol ${CONFIG.TARGET_SOL}, price $${CONFIG.BID_PRICE}, qty ${CONFIG.BID_QTY}, ${CONFIG.DELIVERY_DAYS}d ARO.`);
    console.log(`   If the line looks right, Abe Posts normally (sends all 3 bids).`);
    console.log(`   If wrong, Abe right-clicks → delete line 3 inside the LamLinks UI.`);
  } catch (e: any) {
    console.error(`\nERROR: ${e.message}`);
    try { await tx.rollback(); console.log(`  Rolled back.`); } catch {}
    process.exitCode = 1;
  } finally {
    await pool.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
