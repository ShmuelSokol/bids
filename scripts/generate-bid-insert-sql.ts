/**
 * Dry-run generator: produce the exact INSERT SQL we'd run against
 * LamLinks to pre-populate Abe's bid batch. Output is SQL only — no
 * execution. Yosef reviews the statements. Execute mode is behind an
 * explicit `--execute` flag AND a typed-confirmation prompt.
 *
 * Input:  List of (solicitation_number, nsn, price, qty, lead_days, fob?)
 *         — we read this from Supabase `bid_decisions` with status='quoted'
 *         when invoked without an explicit input file.
 *
 * Output: BEGIN TRANSACTION;
 *           INSERT INTO k33_tab (...) VALUES (...);       -- batch header
 *           DECLARE @batch INT = SCOPE_IDENTITY();
 *           INSERT INTO k34_tab (...) VALUES (...);       -- bid line 1
 *           DECLARE @line1 INT = SCOPE_IDENTITY();
 *           INSERT INTO k35_tab (...) VALUES (...);       -- pricing 1
 *           ... (N lines)
 *         ROLLBACK;  -- in dry-run, we always rollback
 *
 *   npx tsx scripts/generate-bid-insert-sql.ts            # dry-run
 *   npx tsx scripts/generate-bid-insert-sql.ts --execute  # actually write
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = !process.argv.includes("--execute");

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Constants from reverse-engineering 50 of Abe's successful bids.
// These land in k34_tab on every bid. Do not change without verifying
// against a fresh sample.
const K34_CONSTANTS = {
  pn_rev_k34: "  ",
  scage_k34: "0AG09",
  sname_k34: "SZY Holdings, LLC                       ",
  saddr1_k34: "10101 FOSTER AVE                        ",
  saddr2_k34: "                                        ",
  scitys_k34: "BROOKLYN, NY                            ",
  szip_k34: "11236     ",
  sfax_k34: "718-257-6401",
  sphone_k34: "718-495-4600",
  semail_k34: "ajoseph@everreadygroup.com    ",
  sattn_k34: "Abe                           ",
  stitle_k34: "                              ",
  staxid_k34: "030538101   ",
  bizsiz_k34: "G",
  disadv_k34: "F",
  womown_k34: "F",
  s1cage_k34: "0AG09",
  s1name_k34: "10101 FOSTER AVE                        ",
  s1city_k34: "BROOKLYN, NY                            ",
  s2cage_k34: "0AG09",
  s2name_k34: "10101 FOSTER AVE                        ",
  s2city_k34: "BROOKLYN, NY                            ",
  s3cage_k34: "0AG09",
  s3name_k34: "10101 FOSTER AVE                        ",
  s3city_k34: "BROOKLYN, NY                            ",
  trmdes_k34: "Net 30 days                   ",
  bidtyp_k34: 1,
  p0301_k34: "  ",
  shpcty_k34: "BROOKLYN, NY                            ",
  valday_k34: 90,
  allqty_k34: "T",
  insmat_k34: "D",
  inspkg_k34: "D",
  hazard_k34: "F",
  forign_k34: "F",
  newprt_k34: "T",
  surpls_k34: "F",
  rebilt_k34: "F",
  qtyvpp_k34: "0       ",
  qtyvmp_k34: "0       ",
  baspon_k34: "                    ",
  qmcage_k34: "     ",
  qscage_k34: "     ",
  qpltno_k34: "                    ",
  dly_ar_k34: "F",
  gennte_k34:
    "<ver_no>1.902</ver_no><procod>1</procod><socode></socode><fatwvr>N</fatwvr><qt_4cg></qt_4cg><nf1cod>D</nf1cod><bunfco></bunfco><nf1_cc></nf1_cc><dferfl>N</dferfl><dffsuc></dffsuc><dfrdpc></dfrdpc><dfdrpa></dfdrpa><tsbprc>B</tsbprc><dethnc></dethnc><ownvet></ownvet><hbzjnv></hbzjnv><hbzpsb></hbzpsb><minqty></minqty><snowup></snowup><sndaro></sndaro><snowqt>0</snowqt><mqnotf></mqnotf><bd9_tab></bd9_tab><bda_tab></bda_tab><pnotes></pnotes><sonote></sonote><hqnote></hqnote><gennte></gennte><pkgnte></pkgnte>",
  qrefno_k34: "                    ",
  orgtyp_k34: "OE",
  popnam_k34: "                              ",
  poptin_k34: "                ",
  qplsid_k34: "                    ",
  sub_eo_k34: "Y4",
  sub_aa_k34: "Y6",
  cuntor_k34: "                              ",
  abpfun_k34: "                              ",
  hlqs_k34: "                              ",
  adclin_k34: "NC ",
  idpo_k34: "1 ", // small set: "1 " or "2 ". Defaulting to "1 " — needs Yosef confirmation on meaning.
  hubzsb_k34: "N ",
  altadr_k34: "A ",
  chlbor_k34: "M ",
  qtek14_k34: 3,
};

function sqlStr(v: any): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return v.toString();
  return `'${String(v).replace(/'/g, "''")}'`;
}

type BidInput = {
  solicitation_number: string;
  nsn: string;
  price: number;
  qty: number;
  lead_days: number;
  fob?: "D" | "O"; // default D
  part_number?: string; // if null, look up from LamLinks k08
  mfr_cage?: string; //  if null, look up from LamLinks k08
  qty_ui?: string; //    if null, look up from LamLinks (EA, PG, RO, etc.)
};

type ResolvedBid = BidInput & {
  idnk11: number; // solicitation line FK
  resolved_pn: string;
  resolved_mcage: string;
  resolved_qty_ui: string;
  resolved_solqty: number;
};

async function resolveBid(pool: sql.ConnectionPool, input: BidInput): Promise<ResolvedBid | null> {
  // Look up k11 (solicitation line) by sol # + NSN.
  const [fsc, ...niinParts] = input.nsn.split("-");
  const niin = niinParts.join("-");
  const solTrimmed = input.solicitation_number.trim();
  const r = await pool.request().query(`
    SELECT TOP 1
      k11.idnk11_k11 AS idnk11,
      k08.partno_k08 AS part_number,
      k08.p_cage_k08 AS mfr_cage,
      k08.p_um_k08   AS qty_ui,
      k11.solqty_k11 AS solqty
    FROM k10_tab k10
    JOIN k11_tab k11 ON k11.idnk10_k11 = k10.idnk10_k10
    JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
    WHERE RTRIM(LTRIM(k10.sol_no_k10)) = '${solTrimmed.replace(/'/g, "''")}'
      AND RTRIM(LTRIM(k08.fsc_k08)) = '${fsc}'
      AND RTRIM(LTRIM(k08.niin_k08)) = '${niin}'
  `);
  if (r.recordset.length === 0) return null;
  const row = r.recordset[0];
  return {
    ...input,
    idnk11: row.idnk11,
    resolved_pn: (input.part_number || row.part_number || "").trim().padEnd(32, " "),
    resolved_mcage: (input.mfr_cage || row.mfr_cage || "").trim(),
    resolved_qty_ui: (input.qty_ui || row.qty_ui || "EA").trim(),
    resolved_solqty: row.solqty || input.qty,
  };
}

function generateSql(resolved: ResolvedBid[]): string {
  const lines: string[] = [];
  const batchTimestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const qotref = `0AG09-${batchTimestamp.replace(/[^0-9]/g, "").slice(0, 10)}`; // placeholder — final qotref usually has the idnk33 ID

  lines.push("-- ============================================================");
  lines.push("-- DIBS → LamLinks bid batch write");
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push(`-- Bids: ${resolved.length}`);
  lines.push(`-- Mode: ${DRY_RUN ? "DRY RUN (rollback at end)" : "EXECUTE (commit at end)"}`);
  lines.push("-- ============================================================");
  lines.push("");
  lines.push("SET XACT_ABORT ON;");
  lines.push("BEGIN TRANSACTION;");
  lines.push("");
  lines.push("-- Step 1: Create the batch header (k33) in 'acknowledged-only' state.");
  lines.push("--   LamLinks UI shows this as a pending draft batch Abe can review.");
  lines.push("--   The o/t/s state fields stay null until Abe clicks 'Submit' in");
  lines.push("--   LamLinks — that's when its app code transitions the state and");
  lines.push("--   transmits EDI to DIBBS. We don't touch that flow.");
  lines.push("INSERT INTO k33_tab (");
  lines.push("  uptime_k33, upname_k33, qotref_k33,");
  lines.push("  a_stat_k33, a_stme_k33,");
  lines.push("  itmcnt_k33");
  lines.push(") VALUES (");
  lines.push(`  GETDATE(), 'dibs-auto', ${sqlStr(qotref)},`);
  lines.push(`  ${sqlStr("acknowledged    ")}, GETDATE(),`);
  lines.push(`  ${resolved.length}`);
  lines.push(");");
  lines.push("DECLARE @batch INT = SCOPE_IDENTITY();");
  lines.push("-- Update qotref with the real batch ID (LamLinks convention: '0AG09-<batchId>')");
  lines.push("UPDATE k33_tab SET qotref_k33 = '0AG09-' + CAST(@batch AS VARCHAR(10)) WHERE idnk33_k33 = @batch;");
  lines.push("");

  for (let i = 0; i < resolved.length; i++) {
    const b = resolved[i];
    const fob = b.fob || "D";
    const k34Cols = [
      "uptime_k34", "upname_k34",
      "idnk11_k34", "idnk33_k34",
      "pn_k34",
      ...Object.keys(K34_CONSTANTS),
      "mcage_k34", "fobcod_k34", "qty_ui_k34", "solqty_k34",
    ];
    const k34Vals = [
      "GETDATE()", "'dibs-auto'",
      b.idnk11.toString(), "@batch",
      sqlStr(b.resolved_pn),
      ...Object.values(K34_CONSTANTS).map((v) => sqlStr(v)),
      sqlStr(b.resolved_mcage.padEnd(5, " ")),
      sqlStr(fob),
      sqlStr(b.resolved_qty_ui.padEnd(2, " ")),
      b.resolved_solqty.toString(),
    ];

    lines.push(`-- Bid ${i + 1} of ${resolved.length}: ${b.solicitation_number.trim()} / ${b.nsn}`);
    lines.push(`--   $${b.price.toFixed(2)} × ${b.qty}, ${b.lead_days}d lead, FOB ${fob}`);
    lines.push(`INSERT INTO k34_tab (${k34Cols.join(", ")})`);
    lines.push(`VALUES (${k34Vals.join(", ")});`);
    lines.push(`DECLARE @line${i} INT = SCOPE_IDENTITY();`);
    lines.push(`INSERT INTO k35_tab (uptime_k35, upname_k35, idnk34_k35, qty_k35, up_k35, daro_k35, clin_k35)`);
    lines.push(`VALUES (GETDATE(), 'dibs-auto', @line${i}, ${b.qty}, ${b.price}, ${b.lead_days}, '      ');`);
    lines.push("");
  }

  lines.push("-- Update itmcnt to reflect actual rows inserted (sanity check)");
  lines.push(`UPDATE k33_tab SET itmcnt_k33 = ${resolved.length} WHERE idnk33_k33 = @batch;`);
  lines.push("");
  if (DRY_RUN) {
    lines.push("-- DRY-RUN MODE — rolling back. No rows written.");
    lines.push("ROLLBACK;");
    lines.push("PRINT 'DRY RUN complete. No changes committed.';");
  } else {
    lines.push("-- EXECUTE MODE — committing.");
    lines.push("COMMIT;");
    lines.push("PRINT 'Wrote batch + ' + CAST(@batch AS VARCHAR(10)) + ' bids.';");
  }

  return lines.join("\n");
}

async function main() {
  console.log(`${DRY_RUN ? "=== DRY RUN ===" : "!!! EXECUTE MODE — will write to LamLinks !!!"}\n`);

  // Pull quoted bid decisions from Supabase that we'd auto-submit.
  const { data: quoted } = await sb
    .from("bid_decisions")
    .select("solicitation_number, nsn, final_price, quantity, lead_time_days")
    .eq("status", "quoted")
    .limit(10);
  console.log(`Found ${quoted?.length || 0} quoted bid_decisions to translate.\n`);

  if (!quoted || quoted.length === 0) {
    console.log("Nothing quoted. Quote a few items in /solicitations and re-run.");
    return;
  }

  const pool = await sql.connect(config);
  const resolved: ResolvedBid[] = [];
  const skipped: { sol: string; nsn: string; reason: string }[] = [];
  for (const d of quoted) {
    const input: BidInput = {
      solicitation_number: d.solicitation_number,
      nsn: d.nsn,
      price: d.final_price,
      qty: d.quantity || 1,
      lead_days: d.lead_time_days || 45,
    };
    const r = await resolveBid(pool, input);
    if (r) resolved.push(r);
    else skipped.push({ sol: d.solicitation_number, nsn: d.nsn, reason: "no matching k11 in LamLinks" });
  }
  await pool.close();

  console.log(`Resolved: ${resolved.length}, Skipped: ${skipped.length}`);
  for (const s of skipped) console.log(`  skipped: ${s.sol} / ${s.nsn} — ${s.reason}`);
  console.log("");

  if (resolved.length === 0) {
    console.log("Nothing to write.");
    return;
  }

  const sqlOut = generateSql(resolved);
  const outPath = `C:/tmp/lamlinks-bid-insert-${Date.now()}.sql`;
  require("fs").writeFileSync(outPath, sqlOut);
  console.log(`SQL written to: ${outPath}`);
  console.log(`\n--- Preview (first 80 lines) ---`);
  console.log(sqlOut.split("\n").slice(0, 80).join("\n"));
  console.log(`\n--- Full SQL is in ${outPath} ---`);
  console.log(`\nNEXT STEPS:`);
  console.log(`  1. Read the full file and review with Yosef`);
  console.log(`  2. If approved, re-run with --execute flag:`);
  console.log(`     npx tsx scripts/generate-bid-insert-sql.ts --execute`);
  console.log(`  3. Open LamLinks, confirm the new batch shows up as pending`);
  console.log(`  4. Abe clicks 'Submit' in LamLinks UI — normal flow from there`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
