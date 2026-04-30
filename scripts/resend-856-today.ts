/**
 * Resend 856 (Advance Ship Notice / Receiving Report) for today's invoices
 * that were processed by the worker before the 810/856 fix shipped. Those
 * invoices reached WAWF as 810-only (the worker uploaded the same DBF
 * twice with different filenames; WAWF treated both as 810 and rejected
 * the second as a duplicate).
 *
 * For each of today's posted invoices:
 *   1. Pull the source data needed to rebuild the DBF
 *   2. Build a proper 856 DBF (formType=856 → schema with packaging fields,
 *      "56" form code at offset 1134)
 *   3. Upload .laz to sftp.lamlinks.com:/incoming/
 *   4. Sally forwards to WAWF — accepted as a fresh 856 transaction
 *
 * The existing kbr_tab 856 rows say "WAWF 856 sent" already (false at the
 * time but true after this script runs). No SQL changes needed — just the
 * actual EDI transmission that should have happened.
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";
import { join } from "path";
import { buildCk5Dbf, Ck5InvoiceData, PartyOverride, PartyLetter } from "../src/lib/ll-ck5-dbf";
import { uploadLaz, buildLazFilename } from "../src/lib/ll-laz";

const WAWF_TEMPLATE_DIR = join(__dirname, "..", "data", "ll-templates");

// MIRR-block-qualifier text (gduset_ka7) → ck5 party letter
const MIRR_BLOCK_PATTERNS: Array<[RegExp, PartyLetter]> = [
  [/Block 9\b/i,  "B"], [/Block 10\b/i, "C"], [/Block 11\b/i, "H"],
  [/Block 12\b/i, "J"], [/Block 13\b/i, "K"], [/Block 14\b/i, "M"],
  [/Block 21\b/i, "N"],
];

(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  // Find today's posted invoices that got the duplicate-810 treatment.
  // (Future ones with the new code will already have a proper 856 sent —
  // but right now ALL of today's are bad since the fix shipped after.)
  const { data: rows } = await sb
    .from("lamlinks_invoice_queue")
    .select("id, ax_invoice_number, ax_total_amount, ax_customer_order_reference, ll_idnkad, ll_wawf_810_filename, ll_wawf_856_filename, posted_at")
    .eq("state", "posted")
    .gte("posted_at", startOfToday.toISOString())
    .order("id", { ascending: true });
  console.log(`Found ${rows?.length ?? 0} posted invoices today.\n`);

  if (!rows || rows.length === 0) return;

  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  for (const row of rows) {
    if (!row.ll_idnkad) {
      console.log(`  [${row.id}] ${row.ax_invoice_number}: skip (no ll_idnkad)`);
      continue;
    }

    // Find the kaj for this kad
    const chain = await pool.request().query(`
      SELECT TOP 1 kaj.idnkaj_kaj
      FROM kad_tab kad
      INNER JOIN kae_tab kae ON kae.idnkad_kae = kad.idnkad_kad
      INNER JOIN ka9_tab ka9 ON ka9.idnkae_ka9 = kae.idnkae_kae
      INNER JOIN kaj_tab kaj ON kaj.idnkaj_kaj = ka9.idnkaj_ka9
      WHERE kad.idnkad_kad = ${row.ll_idnkad}
    `);
    if (chain.recordset.length === 0) {
      console.log(`  [${row.id}] ${row.ax_invoice_number}: skip (couldn't find kaj for kad=${row.ll_idnkad})`);
      continue;
    }
    const idnkaj = chain.recordset[0].idnkaj_kaj;

    // Pull all source data — same query shape as transmitWawfForKaj
    const r = await pool.request().query(`
      SELECT
        kaj.idnkaj_kaj AS idnkaj, kaj.shptme_kaj AS shptme, kaj.insdte_kaj AS insdte,
        LTRIM(RTRIM(kaj.shpnum_kaj)) AS shpnum, LTRIM(RTRIM(kaj.packed_kaj)) AS packed,
        kad.cin_no_kad AS cin_no, LTRIM(RTRIM(kad.cinnum_kad)) AS cinnum,
        kad.cisdte_kad AS cindte, kad.ar_val_kad AS cinval,
        kae.cilqty_kae AS shpqty, kae.cil_up_kae AS shp_up,
        LTRIM(RTRIM(kae.cil_ui_kae)) AS shp_ui, kae.cilext_kae AS shpext,
        LTRIM(RTRIM(kae.cildes_kae)) AS p_desc,
        k81.idnk81_k81 AS idnk81, k81.clnqty_k81 AS clnqty, k81.cln_up_k81 AS cln_up,
        LTRIM(RTRIM(k81.ordrno_k81)) AS ordrno, LTRIM(RTRIM(k81.tcn_k81)) AS tcn,
        LTRIM(RTRIM(k81.pr_num_k81)) AS pr_num, k81.stadte_k81 AS reldte,
        k81.idnk71_k81 AS idnk71,
        LTRIM(RTRIM(k80.piidno_k80)) AS piidno,
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
      WHERE kaj.idnkaj_kaj = ${idnkaj}
    `);
    if (r.recordset.length === 0) {
      console.log(`  [${row.id}] ${row.ax_invoice_number}: skip (no source data for kaj=${idnkaj})`);
      continue;
    }
    const src = r.recordset[0];

    // NSN + PIDTXT from k08
    let nsnStr = "";
    let pidtxtStr = "";
    if (src.idnk08) {
      const k08 = await pool.request().query(`SELECT fsc_k08, niin_k08, pidtxt_k08 FROM k08_tab WHERE idnk08_k08 = ${src.idnk08}`);
      if (k08.recordset.length > 0) {
        nsnStr = `${String(k08.recordset[0].fsc_k08 || "").trim()}-${String(k08.recordset[0].niin_k08 || "").trim()}`;
        pidtxtStr = String(k08.recordset[0].pidtxt_k08 || "").trim();
      }
    }

    // Pull party blocks (column names from ll-ck5-dbf.ts via worker pattern)
    const ka6 = await pool.request().query(`
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
      WHERE LTRIM(RTRIM(ka6.gdutbl_ka6)) = 'kaj' AND ka6.idngdu_ka6 = ${idnkaj}
    `);
    const parties: Partial<Record<PartyLetter, PartyOverride>> = {};
    for (const p of ka6.recordset) {
      const qual = String(p.qual || "");
      let letter: PartyLetter | null = null;
      for (const [re, lt] of MIRR_BLOCK_PATTERNS) {
        if (re.test(qual)) { letter = lt; break; }
      }
      if (!letter) continue;
      parties[letter] = {
        code: p.code, name: p.name, nam2: p.nam2, nam3: p.nam3,
        adr1: p.adr1, adr2: p.adr2, adr3: p.adr3, adr4: p.adr4,
        city: p.city, stte: p.stte, zipc: p.zipc, cntr: p.cntr,
        attn: p.attn, phon: p.phon, faxn: p.faxn, emal: p.emal,
      };
    }

    // Pull trn_id from kbr 856 (where we recorded it during original send)
    const kbr = await pool.request().query(`
      SELECT TOP 1 xtcscn_kbr FROM kbr_tab
      WHERE itttbl_kbr = 'kaj' AND idnitt_kbr = ${idnkaj} AND idnkap_kbr = 24
    `);
    const trnId = parseInt(String(kbr.recordset[0]?.xtcscn_kbr || "0").trim(), 10) || 0;

    const invoiceData: Ck5InvoiceData = {
      a_code: parties.J?.code || "96412",
      cntrct: src.cntrct,
      piidno: src.piidno || "",
      reldte: src.reldte ? new Date(src.reldte) : undefined,
      ordrno: src.ordrno,
      tcn: src.tcn,
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
      shp_ui: String(src.shp_ui || "EA").toUpperCase().replace(/^B\d+$/, "EA"),
      shpext: parseFloat(src.shpext),
      shptme: src.shptme ? new Date(src.shptme) : new Date(),
      shpnum: src.shpnum,
      shpped: "",
      packed: src.packed || "T",
      cinval: parseFloat(src.cinval),
      insdte: src.insdte ? new Date(src.insdte) : new Date(),
      trn_id: trnId,
      parties,
    };

    // Pre-check: never resend 856 to a kaj where kbr.xtcsta is already
    // 'WAWF 856 sent'. Doing so likely halted Sally on 2026-04-29 — Sally
    // doesn't appear to handle the duplicate-856 case gracefully and got
    // stuck on the first such file we sent (a5149962_everready_ibh2uguiq).
    // If kbr 856 row exists, the actual 856 transmission either ALREADY
    // happened or needs LL ops to clear the kbr row first.
    const existingKbr856 = await pool.request().query(`
      SELECT TOP 1 idnkbr_kbr, xtcsta_kbr FROM kbr_tab
      WHERE itttbl_kbr = 'kaj' AND idnitt_kbr = ${idnkaj} AND idnkap_kbr = 25
    `);
    if (existingKbr856.recordset.length > 0) {
      const xtcsta = String(existingKbr856.recordset[0].xtcsta_kbr).trim();
      console.log(`  [${row.id}] ${row.ax_invoice_number} (kaj=${idnkaj}): SKIP — kbr 856 already exists (xtcsta="${xtcsta}"). Resending might hang Sally. Clear the kbr row + retry if you really need to resend.`);
      continue;
    }

    // Build 856 DBF
    const ck856 = buildCk5Dbf(invoiceData, WAWF_TEMPLATE_DIR, 856);

    // Upload .laz
    const filename = buildLazFilename();
    const result = await uploadLaz({ dbf: ck856.dbf, fpt: ck856.fpt }, { filename });
    console.log(`  [${row.id}] ${row.ax_invoice_number} (kaj=${idnkaj}, $${row.ax_total_amount}) → uploaded 856 ${result.filename} (${result.bytes}b)`);

    // Stamp the new 856 filename on the queue row
    await sb.from("lamlinks_invoice_queue").update({
      ll_wawf_856_filename: result.filename,
    }).eq("id", row.id);
  }

  console.log("\n✓ All 856 retransmissions submitted.");
  console.log("Watch DLA email for WAWF acceptances.");
  await pool.close();
})().catch(e => { console.error(e); process.exit(1); });
