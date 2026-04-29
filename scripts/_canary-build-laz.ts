/**
 * Canary: generate a .laz for kaj=353349 (CIN0066186) using our generator,
 * extract it, and byte-compare against the reference .laz Abe produced this
 * morning (saved at C:\tmp\laz\ref-810-extracted\).
 *
 * NO upload — pure validation of the DBF/FPT generator.
 */
import "./env";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import sql from "mssql/msnodesqlv8";
import { buildCk5Dbf } from "../src/lib/ll-ck5-dbf";
import { packageLaz } from "../src/lib/ll-laz";

const TEMPLATE_DIR = "C:\\tmp\\laz\\ref-810-extracted";
const OUT_DIR = "C:\\tmp\\laz\\canary";
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Pull all the source data for kaj=353349 (CIN0066186 — yesterday's test invoice)
  console.log("Pulling source data for kaj=353349...");
  const r = await pool.request().query(`
    SELECT
      kaj.idnkaj_kaj AS idnkaj,
      kaj.shptme_kaj AS shptme,
      kaj.insdte_kaj AS insdte,
      LTRIM(RTRIM(kaj.shpnum_kaj)) AS shpnum,
      LTRIM(RTRIM(kaj.packed_kaj)) AS packed,
      LTRIM(RTRIM(kaj.edi_id_kaj)) AS edi_id,
      kad.idnkad_kad AS idnkad,
      kad.cin_no_kad AS cin_no,
      LTRIM(RTRIM(kad.cinnum_kad)) AS cinnum,
      kad.cisdte_kad AS cindte,
      kad.ar_val_kad AS cinval,
      kae.idnkae_kae AS idnkae,
      kae.cilqty_kae AS shpqty,
      kae.cil_up_kae AS shp_up,
      LTRIM(RTRIM(kae.cil_ui_kae)) AS shp_ui,
      kae.cilext_kae AS shpext,
      LTRIM(RTRIM(kae.cildes_kae)) AS p_desc,
      ka9.idnka9_ka9 AS idnka9,
      k81.idnk81_k81 AS idnk81,
      LTRIM(RTRIM(k81.clinno_k81)) AS clinno,
      k81.clnqty_k81 AS clnqty,
      k81.cln_up_k81 AS cln_up,
      LTRIM(RTRIM(k81.ordrno_k81)) AS ordrno,
      LTRIM(RTRIM(k81.tcn_k81)) AS tcn,
      LTRIM(RTRIM(k81.pr_num_k81)) AS pr_num,
      k81.stadte_k81 AS reldte,
      k81.idnk71_k81 AS idnk71,
      k80.idnk80_k80 AS idnk80,
      LTRIM(RTRIM(k80.piidno_k80)) AS piidno,
      k79.idnk79_k79 AS idnk79,
      LTRIM(RTRIM(k79.cntrct_k79)) AS cntrct,
      k71.idnk08_k71 AS idnk08
    FROM kaj_tab kaj
    INNER JOIN ka9_tab ka9 ON ka9.idnkaj_ka9 = kaj.idnkaj_kaj
    INNER JOIN kae_tab kae ON kae.idnkae_kae = ka9.idnkae_ka9
    INNER JOIN kad_tab kad ON kad.idnkad_kad = kae.idnkad_kae
    INNER JOIN k80_tab k80 ON k80.idnk80_k80 = kaj.idnk80_kaj
    INNER JOIN k79_tab k79 ON k79.idnk79_k79 = k80.idnk79_k80
    INNER JOIN k81_tab k81 ON k81.idnk80_k81 = k80.idnk80_k80
    LEFT  JOIN k71_tab k71 ON k71.idnk71_k71 = k81.idnk71_k81
    WHERE kaj.idnkaj_kaj = 353349
  `);

  if (r.recordset.length === 0) {
    console.error("No row for kaj=353349");
    await pool.close();
    process.exit(1);
  }
  const src = r.recordset[0];
  console.log(`Source data:\n${JSON.stringify(src, null, 2)}`);

  // Pull TRN_ID — for actual transmission would atomically allocate from k07,
  // but for canary we use what's already in our existing kbr row.
  const kbr = await pool.request().query(`
    SELECT TOP 1 LTRIM(RTRIM(xtcscn_kbr)) AS xtcscn FROM kbr_tab
    WHERE itttbl_kbr='kaj' AND idnitt_kbr=353349 AND idnkap_kbr=24
  `);
  const trn_id = parseInt(kbr.recordset[0]?.xtcscn || "0", 10);
  console.log(`TRN_ID (from existing kbr): ${trn_id}`);

  // Pull NSN + PIDTXT from k08
  let nsnStr = "";
  let pidtxtStr = "";
  if (src.idnk08) {
    const k08r = await pool.request().query(`
      SELECT LTRIM(RTRIM(fsc_k08)) AS fsc, LTRIM(RTRIM(niin_k08)) AS niin,
             CAST(pidtxt_k08 AS VARCHAR(MAX)) AS pidtxt
      FROM k08_tab WHERE idnk08_k08 = ${src.idnk08}
    `);
    if (k08r.recordset[0]) {
      nsnStr = `${k08r.recordset[0].fsc}-${k08r.recordset[0].niin}`;
      pidtxtStr = k08r.recordset[0].pidtxt || "";
    }
  }
  console.log(`NSN: ${nsnStr}`);
  console.log(`PIDTXT: ${pidtxtStr.length} chars`);

  // Pull all 7 party blocks via ka6→ka7
  const partiesQ = await pool.request().query(`
    SELECT LTRIM(RTRIM(ka7.gduset_ka7)) AS qual,
           LTRIM(RTRIM(ka7.d_code_ka7)) AS code,
           LTRIM(RTRIM(ka7.d_name_ka7)) AS name,
           LTRIM(RTRIM(ka7.d_nam2_ka7)) AS nam2,
           LTRIM(RTRIM(ka7.d_nam3_ka7)) AS nam3,
           LTRIM(RTRIM(ka7.d_adr1_ka7)) AS adr1,
           LTRIM(RTRIM(ka7.d_adr2_ka7)) AS adr2,
           LTRIM(RTRIM(ka7.d_adr3_ka7)) AS adr3,
           LTRIM(RTRIM(ka7.d_adr4_ka7)) AS adr4,
           LTRIM(RTRIM(ka7.d_city_ka7)) AS city,
           LTRIM(RTRIM(ka7.d_stte_ka7)) AS stte,
           LTRIM(RTRIM(ka7.d_zipc_ka7)) AS zipc,
           LTRIM(RTRIM(ka7.d_cntr_ka7)) AS cntr,
           LTRIM(RTRIM(ka7.d_attn_ka7)) AS attn,
           LTRIM(RTRIM(ka7.d_phon_ka7)) AS phon,
           LTRIM(RTRIM(ka7.d_faxn_ka7)) AS faxn,
           LTRIM(RTRIM(ka7.d_emal_ka7)) AS emal
    FROM ka6_tab ka6
    INNER JOIN ka7_tab ka7 ON ka7.idnka7_ka7 = ka6.idnka7_ka6
    WHERE LTRIM(RTRIM(ka6.gdutbl_ka6)) = 'kaj' AND ka6.idngdu_ka6 = 353349
  `);
  const parties: Record<string, any> = {};
  const mirrToLetter: Array<[RegExp, string]> = [
    [/Block 9\b/i,  "B"], [/Block 10\b/i, "C"], [/Block 11\b/i, "H"],
    [/Block 12\b/i, "J"], [/Block 13\b/i, "K"], [/Block 14\b/i, "M"],
    [/Block 21\b/i, "N"],
  ];
  for (const row of partiesQ.recordset) {
    const letter = mirrToLetter.find(([rx]) => rx.test(row.qual))?.[1];
    if (!letter) continue;
    parties[letter] = {
      code: row.code, name: row.name, nam2: row.nam2, nam3: row.nam3,
      adr1: row.adr1, adr2: row.adr2, adr3: row.adr3, adr4: row.adr4,
      city: row.city, stte: row.stte, zipc: row.zipc, cntr: row.cntr,
      attn: row.attn, phon: row.phon, faxn: row.faxn, emal: row.emal,
    };
  }
  console.log(`Parties from ka7: ${Object.keys(parties).join(", ")}`);

  await pool.close();

  // Build the DBF/FPT
  console.log("\nBuilding DBF/FPT from template...");
  const { dbf, fpt } = buildCk5Dbf({
    a_code: "96412",
    cntrct: src.cntrct,
    piidno: src.piidno || "",
    reldte: src.reldte ? new Date(src.reldte) : undefined,
    ordrno: src.ordrno,
    tcn: src.tcn || src.ordrno,
    pr_num: src.pr_num || "",
    p_desc: src.p_desc || "",
    idnk71: src.idnk71 || 0,
    nsn: nsnStr,
    pidtxt: pidtxtStr || "(no PIDTXT)",
    idnkaj: src.idnkaj,
    idnk81: src.idnk81,
    cindte: src.cindte ? new Date(src.cindte) : new Date(),
    cin_no: src.cin_no,
    cinnum: src.cinnum,
    shpqty: src.shpqty,
    clnqty: src.clnqty,
    cln_up: parseFloat(src.cln_up),
    shp_up: parseFloat(src.shp_up),
    shp_ui: src.shp_ui,
    shpext: parseFloat(src.shpext),
    shptme: src.shptme ? new Date(src.shptme) : new Date(),
    shpnum: src.shpnum,
    shpped: "",
    packed: src.packed || "T",
    cinval: parseFloat(src.cinval),
    insdte: src.insdte ? new Date(src.insdte) : new Date(),
    trn_id,
    parties,
  }, TEMPLATE_DIR);

  console.log(`Generated DBF: ${dbf.length} bytes, FPT: ${fpt.length} bytes`);
  writeFileSync(`${OUT_DIR}\\ck5_tab.dbf`, dbf);
  writeFileSync(`${OUT_DIR}\\ck5_tab.FPT`, fpt);

  const laz = await packageLaz({ dbf, fpt });
  writeFileSync(`${OUT_DIR}\\canary.laz`, laz);
  console.log(`Generated .laz: ${laz.length} bytes at ${OUT_DIR}\\canary.laz`);

  // Compare with reference DBF byte-by-byte (highlight only differences)
  console.log("\n=== Byte-diff vs ref-810 template ===");
  const refDbf = readFileSync(`${TEMPLATE_DIR}\\ck5_tab.dbf`);
  let diffs = 0;
  let firstDiffOffset = -1;
  for (let i = 0; i < Math.min(dbf.length, refDbf.length); i++) {
    if (dbf[i] !== refDbf[i]) {
      diffs++;
      if (firstDiffOffset < 0) firstDiffOffset = i;
    }
  }
  console.log(`  DBF total bytes: ${dbf.length} (ref ${refDbf.length})`);
  console.log(`  Differences: ${diffs} bytes`);
  if (firstDiffOffset >= 0) console.log(`  First difference at offset: ${firstDiffOffset}`);

  // We expect MANY differences (different invoice). Let's instead VALIDATE
  // by parsing the generated DBF's record fields and confirming they match
  // what we put in.
  console.log("\n=== Verify generated DBF contains our values ===");
  const HEADER_LEN = 7880;
  const checks = [
    { name: "CNTRCT_CK5", offset: 33, len: 60, expected: src.cntrct },
    { name: "ORDRNO_CK5", offset: 154, len: 20, expected: src.ordrno },
    { name: "NSN_CK5", offset: 356, len: 16, expected: nsnStr },
    { name: "CINNUM_CK5", offset: 434, len: 22, expected: src.cinnum },
    { name: "SHPNUM_CK5", offset: 551, len: 8, expected: src.shpnum },
  ];
  for (const c of checks) {
    const got = dbf.slice(HEADER_LEN + c.offset, HEADER_LEN + c.offset + c.len).toString("latin1").trim();
    const ok = got === c.expected;
    console.log(`  ${c.name.padEnd(14)} expected="${c.expected}"  got="${got}"  ${ok ? "✓" : "✗"}`);
  }

  console.log("\n✓ Canary generation complete. Compare bytes:");
  console.log(`     fc /b "${OUT_DIR}\\ck5_tab.dbf" "${TEMPLATE_DIR}\\ck5_tab.dbf"`);
})().catch(e => { console.error(e); process.exit(1); });
