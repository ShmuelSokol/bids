/**
 * Retry the SFTP-and-finalize step for an existing bid envelope that has
 * SQL rows but never had its .laz uploaded (e.g., processed by an older
 * worker without SFTP support, or where SFTP failed).
 *
 *   Usage: npx tsx scripts/retry-bid-sftp.ts <idnk33>
 *
 * Reads k34/k35/k11/k10/k08 to reconstruct each bid line, builds the
 * qtb_tab.dbf, SFTPs it to /incoming/, flips o_stat='quotes added' +
 * t_stat='sent' on k33. Idempotent: if envelope is already finalized it
 * just re-uploads (LL Sally tolerates dupes — but warn the operator).
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { join } from "path";
import { transmitBidEnvelope, QtbBidLineData } from "../src/lib/ll-bid-laz";

const BID_TEMPLATE_DIR = join(__dirname, "..", "data", "ll-templates", "bid");

async function main() {
  const idnk33 = Number(process.argv[2]);
  if (!idnk33) {
    console.error("usage: npx tsx scripts/retry-bid-sftp.ts <idnk33>");
    process.exit(1);
  }

  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Pull envelope state
  const env = await pool.request().query(`
    SELECT idnk33_k33, qotref_k33, o_stat_k33, t_stat_k33, itmcnt_k33
    FROM k33_tab WHERE idnk33_k33 = ${idnk33}
  `);
  if (env.recordset.length === 0) throw new Error(`envelope ${idnk33} not found`);
  const e = env.recordset[0];
  console.log(`Envelope ${idnk33}: qotref=${String(e.qotref_k33).trim()} o_stat="${String(e.o_stat_k33).trim()}" t_stat="${String(e.t_stat_k33).trim()}" itms=${e.itmcnt_k33}`);

  // Pull all k34 lines for this envelope, joined with k11/k10/k08 to get
  // everything qtb needs. Also k35 for prices.
  const lines = await pool.request().query(`
    SELECT k34.idnk34_k34, k34.idnk11_k34, k34.pn_k34, k34.mcage_k34, k34.fobcod_k34,
           k34.qty_ui_k34, k34.solqty_k34, k34.qty1_k34, k34.aro1_k34,
           k35.idnk35_k35, k35.up1_k35,
           k11.lam_id_k11, k11.itemno_k11, k11.pr_num_k11, k11.our_pn_k11,
           k10.sol_no_k10, k10.b_code_k10, k10.b_name_k10, k10.b_fax_k10,
           k10.closes_k10, k10.bq_sta_k10, k10.sol_ti_k10,
           k08.p_desc_k08, k08.fsc_k08, k08.niin_k08
    FROM k34_tab k34
    INNER JOIN k35_tab k35 ON k35.idnk34_k35 = k34.idnk34_k34
    INNER JOIN k11_tab k11 ON k11.idnk11_k11 = k34.idnk11_k34
    INNER JOIN k10_tab k10 ON k10.idnk10_k10 = k11.idnk10_k11
    INNER JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
    WHERE k34.idnk33_k34 = ${idnk33}
    ORDER BY k34.idnk34_k34
  `);
  console.log(`Found ${lines.recordset.length} bid line(s) to ship`);
  if (lines.recordset.length === 0) {
    console.error("no k34 lines — nothing to ship");
    await pool.close();
    process.exit(1);
  }

  const qtbLines: QtbBidLineData[] = lines.recordset.map((l: any) => {
    const fsc = String(l.fsc_k08 || "").trim();
    const niin = String(l.niin_k08 || "").trim();
    return {
      idnqtb: l.idnk34_k34,
      lam_id: l.lam_id_k11,
      lamref: String(l.sol_no_k10).slice(0, 15),
      lamitm: l.itemno_k11,
      duedte: l.closes_k10,
      buycod: String(l.b_code_k10 || "").trim(),
      buynam: String(l.b_name_k10 || "").trim(),
      buyfax: String(l.b_fax_k10 || "").trim() || undefined,
      yp_no: String(l.pr_num_k11 || "").trim(),
      sol_no: String(l.sol_no_k10 || "").trim(),
      vpn: String(l.our_pn_k11 || "").trim() || undefined,
      pn: String(l.pn_k34 || "").trim(),
      mcage: String(l.mcage_k34 || "").trim(),
      desc: String(l.p_desc_k08 || "").trim().slice(0, 20),
      nsn: `${fsc}-${niin}`,
      fobcod: (String(l.fobcod_k34 || "D").trim() === "O" ? "O" : "D"),
      qty_ui: String(l.qty_ui_k34 || "EA").trim(),
      solqty: l.solqty_k34,
      qty1: l.qty1_k34,
      up1: Number(l.up1_k35),
      aro1: l.aro1_k34,
      bq_sta: String(l.bq_sta_k10 || "included").trim(),
      sol_ti: String(l.sol_ti_k10 || "F").trim(),
    };
  });

  console.log("\nBuilding + uploading .laz...");
  const result = await transmitBidEnvelope(
    { idnk33, lines: qtbLines },
    { templateDir: BID_TEMPLATE_DIR }
  );
  console.log(`✓ uploaded ${result.filename} (${result.bytes} bytes)`);

  // Flip o_stat and t_stat
  await pool.request().query(`
    UPDATE k33_tab
    SET o_stat_k33 = 'quotes added',
        s_stat_k33 = 'quotes added',
        t_stat_k33 = 'sent',
        t_stme_k33 = GETDATE(),
        uptime_k33 = GETDATE()
    WHERE idnk33_k33 = ${idnk33}
  `);
  console.log(`✓ flipped k33 ${idnk33}: o_stat='quotes added', t_stat='sent'`);

  // Bump k07 cursor cache
  for (let i = 0; i < 3; i++) {
    await pool.request().query(`
      UPDATE k07_tab SET uptime_k07 = GETDATE()
      WHERE LTRIM(RTRIM(upname_k07)) = 'ajoseph'
        AND LTRIM(RTRIM(ss_key_k07)) = 'SOL_FORM_PREFERENCES'
        AND LTRIM(RTRIM(ss_tid_k07)) = 'U'
    `);
  }
  console.log("✓ post-bumped k07 (3x)");

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
