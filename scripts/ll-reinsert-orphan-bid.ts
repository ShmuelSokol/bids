/**
 * Re-insert a k33/k34/k35 shell for a bid that Sally/DLA has on record
 * but LL's local DB is missing (because we nuked it locally, or a cursor
 * error rolled back only the DB insert while the HTTP transmit succeeded).
 *
 * Use this when a DLA award arrives for a sol whose matching k34 no
 * longer exists in LL — prevents the award from being orphaned in LL's
 * quote-to-award join.
 *
 * Usage:
 *   npx tsx scripts/ll-reinsert-orphan-bid.ts --sol SPE2DS-26-T-009G \
 *     --nsn 6515-01-600-1916 --qty 1 --price 239 --days 45 \
 *     --qotref 0AG09-46896 --yes
 *
 * Refuses to run without --yes so you can dry-run first.
 */
import "./env";
import sql from "mssql/msnodesqlv8";

type Args = {
  sol: string;
  nsn: string;
  qty: number;
  price: number;
  days: number;
  qotref?: string;   // optional original 0AG09-{idnk33} if known (for DLA join)
  yes: boolean;
};

function parseArgs(): Args {
  const argv = process.argv;
  const arg = (k: string) => {
    const i = argv.indexOf("--" + k);
    return i >= 0 ? argv[i + 1] : null;
  };
  return {
    sol: arg("sol") || "",
    nsn: arg("nsn") || "",
    qty: Number(arg("qty") || 0),
    price: Number(arg("price") || 0),
    days: Number(arg("days") || 45),
    qotref: arg("qotref") || undefined,
    yes: argv.includes("--yes"),
  };
}

async function main() {
  const a = parseArgs();
  if (!a.sol || !a.nsn || !a.qty || !a.price) {
    console.error("Usage: --sol <solNo> --nsn <NSN> --qty <n> --price <$> [--days 45] [--qotref 0AG09-NNN] [--yes]");
    process.exit(1);
  }

  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Resolve the sol's k11 + k08 rows (same as the worker does)
  const niin = a.nsn.replace(/^\d{4}-/, "");
  const r = await pool.request()
    .input("sol", sql.VarChar, a.sol)
    .input("niin", sql.VarChar, niin)
    .query(`
      SELECT k11.idnk11_k11, k11.solqty_k11, k11.sol_um_k11, k08.partno_k08, k08.p_cage_k08
      FROM k11_tab k11
      INNER JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
      INNER JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
      WHERE k10.sol_no_k10 = @sol AND k08.niin_k08 = @niin
    `);
  if (r.recordset.length === 0) {
    console.error(`No k11/k08 found for sol=${a.sol} niin=${niin}`);
    process.exit(2);
  }
  const target = r.recordset[0];
  const uom = String(target.sol_um_k11 || "EA").trim() || "EA";
  const mfrPn = String(target.partno_k08 || "").trim();
  const mfrCage = String(target.p_cage_k08 || "").trim();

  // Template: most recent ajoseph k34
  const tpl = await pool.request().query(`
    SELECT TOP 1 idnk34_k34 FROM k34_tab
    WHERE LTRIM(RTRIM(upname_k34)) = 'ajoseph'
    ORDER BY idnk34_k34 DESC
  `);
  if (tpl.recordset.length === 0) throw new Error("no template k34 row found");
  const templateK34 = tpl.recordset[0].idnk34_k34;

  console.log(`Plan:`);
  console.log(`  Envelope: reuse qotref '${a.qotref}' if present (preserves Sally link), else mint new`);
  console.log(`  k34 template: ${templateK34}`);
  console.log(`  Target: sol=${a.sol} nsn=${a.nsn} idnk11=${target.idnk11_k11} qty=${a.qty} @ $${a.price} days=${a.days}`);
  console.log(`  Mfr PN=${mfrPn} CAGE=${mfrCage} UoM=${uom}`);
  if (!a.yes) {
    console.log(`\n(dry-run — add --yes to execute)`);
    await pool.close();
    return;
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);

    // Mint a new k33 via kdy_tab allocation
    const k33Alloc = await req.query(`
      DECLARE @newId INT;
      UPDATE kdy_tab WITH (ROWLOCK, HOLDLOCK)
      SET idnval_kdy = idnval_kdy + 1, @newId = idnval_kdy + 1
      WHERE tabnam_kdy = 'k33_tab';
      SELECT @newId AS id;
    `);
    const newK33: number = k33Alloc.recordset[0].id;
    const qotref = (a.qotref || `0AG09-${newK33}`).padEnd(15, " ").slice(0, 15);

    // k33 already at 'quotes added' / 'sent' — matches a successfully-transmitted envelope
    await req.query(`
      INSERT INTO k33_tab (
        idnk33_k33, uptime_k33, upname_k33, qotref_k33,
        o_stat_k33, t_stat_k33, a_stat_k33, s_stat_k33,
        o_stme_k33, t_stme_k33, a_stme_k33, s_stme_k33,
        itmcnt_k33
      ) VALUES (
        ${newK33}, GETDATE(), 'ajoseph   ', '${qotref}',
        'quotes added    ', 'sent            ', 'not acknowledged', 'quotes added    ',
        GETDATE(), GETDATE(), GETDATE(), GETDATE(),
        1
      )
    `);

    // Allocate k34 + k35 ids
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
    const newK34: number = k34Alloc.recordset[0].id;
    const newK35: number = k35Alloc.recordset[0].id;

    const safePn = mfrPn.replace(/'/g, "''");
    const safeCage = mfrCage.replace(/'/g, "''");
    const safeUom = uom.padEnd(2, " ").slice(0, 2).replace(/'/g, "''");

    // Clone k34 metadata from template (same shape as the worker's INSERT)
    await req.query(`
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
        ${newK34}, GETDATE(), upname_k34, ${target.idnk11_k11}, ${newK33},
        CAST('${safePn}' AS CHAR(32)), pn_rev_k34,
        scage_k34, sname_k34, saddr1_k34, saddr2_k34, scitys_k34, szip_k34, sfax_k34,
        sphone_k34, semail_k34, sattn_k34, stitle_k34, staxid_k34, bizsiz_k34, disadv_k34,
        womown_k34, CAST('${safeCage}' AS CHAR(5)),
        s1cage_k34, s1name_k34, s1city_k34, s2cage_k34, s2name_k34,
        s2city_k34, s3cage_k34, s3name_k34, s3city_k34, trmdes_k34, bidtyp_k34, p0301_k34,
        fobcod_k34, shpcty_k34, valday_k34, allqty_k34, insmat_k34, inspkg_k34, hazard_k34,
        forign_k34, newprt_k34, surpls_k34, rebilt_k34, qtyvpp_k34, qtyvmp_k34, baspon_k34,
        qmcage_k34, qscage_k34, qpltno_k34, dly_ar_k34,
        CAST('${safeUom}' AS CHAR(2)), ${target.solqty_k11 || a.qty},
        gennte_k34, pkgnte_k34, qrefno_k34, orgtyp_k34, popnam_k34, poptin_k34, qplsid_k34,
        sub_eo_k34, sub_aa_k34, cuntor_k34, abpfun_k34, hlqs_k34, adclin_k34, idpo_k34,
        hubzsb_k34, altadr_k34, chlbor_k34, qtek14_k34, ctlxml_k34
      FROM k34_tab WHERE idnk34_k34 = ${templateK34}
    `);

    await req.query(`
      INSERT INTO k35_tab (idnk35_k35, uptime_k35, upname_k35, idnk34_k35, qty_k35, up_k35, daro_k35, clin_k35)
      VALUES (${newK35}, GETDATE(), 'ajoseph   ', ${newK34}, ${a.qty}, ${a.price}, ${a.days}, '      ')
    `);

    await tx.commit();
    console.log(`\n✓ Re-inserted as envelope k33=${newK33} (qotref=${qotref.trim()}), k34=${newK34}, k35=${newK35}`);
    console.log(`  State: o_stat='quotes added' / t_stat='sent' / s_stat='quotes added' (matches a post-transmission envelope)`);
  } catch (e) {
    try { await tx.rollback(); } catch {}
    throw e;
  }

  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
