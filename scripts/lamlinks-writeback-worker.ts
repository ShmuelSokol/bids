// LamLinks write-back worker.
// Polls lamlinks_write_queue for pending rows, finds a staged envelope on
// NYEVRVSQL001 to piggyback into, runs the append-bid logic, and marks each
// queue row as done or failed.
//
// Runs on NYEVRVSQL001 via Windows Task Scheduler (only host with
// msnodesqlv8 available — Railway can't compile it).
//
// Usage:
//   npx tsx scripts/lamlinks-writeback-worker.ts            # one pass (for scheduler)
//   npx tsx scripts/lamlinks-writeback-worker.ts --loop     # long-running loop (dev)
//
// Safety:
// - Only acts when system_settings.lamlinks_writeback_enabled='true'
// - Skips anything not in 'pending' state
// - Picks a staged envelope with o_stat='adding quotes'; if none, marks
//   rows as waiting (status stays 'pending') and retries next poll
// - Allocates idnk34/idnk35 via the kdy_tab sequence table — the EXACT
//   protocol LamLinks' own client uses. Atomic UPDATE increments
//   kdy_tab.idnval_kdy and returns the new value; we insert at that id.
//   No orphans, no collisions with Abe's client, no MAX+N guessing.
//   (Pre-2026-04-21 we used MAX+30 which produced collisions — see
//   docs/lamlinks-collision-2026-04-21.md for the retrospective.)
// - Wraps each insert in a transaction with row-level locking on kdy_tab
// - Marks 'done' with k33/k34/k35 ids on success; 'failed' with error on errors

import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";
import { join } from "path";
import { buildCk5Dbf } from "../src/lib/ll-ck5-dbf";
import { uploadLaz, buildLazFilename } from "../src/lib/ll-laz";
import { transmitBidEnvelope, QtbBidLineData } from "../src/lib/ll-bid-laz";

const WAWF_TEMPLATE_DIR = join(__dirname, "..", "data", "ll-templates");
const BID_TEMPLATE_DIR = join(__dirname, "..", "data", "ll-templates", "bid");

const POLL_INTERVAL_MS = 30_000;   // 30s between polls in --loop mode
const MAX_ROWS_PER_PASS = 10;      // avoid monopolising Abe's LamLinks session

async function getWritebackEnabled(supabase: any): Promise<boolean> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "lamlinks_writeback_enabled")
    .maybeSingle();
  return data?.value === "true";
}

async function getFreshEnvelopeEnabled(supabase: any): Promise<boolean> {
  // Default true — fresh-envelope mode works (validated 2026-04-28) but
  // produces cosmetic VFP cursor error 9977720 in LL's UI when Abe Posts.
  // Flip false to suppress that error at the cost of requiring Abe to
  // seed each DIBS batch by saving one bid in LL first (piggyback).
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "lamlinks_fresh_envelope_enabled")
    .maybeSingle();
  if (data == null) return true; // default ON if row missing
  return data?.value !== "false";
}

async function findStagedEnvelope(pool: sql.ConnectionPool): Promise<{ idnk33: number; templateK34: number } | null> {
  // Most recent envelope in 'adding quotes' state with at least one existing k34 line
  // (we need a template to clone from).
  const r = await pool.request().query(`
    SELECT TOP 1 k33.idnk33_k33,
           (SELECT TOP 1 idnk34_k34 FROM k34_tab WHERE idnk33_k34 = k33.idnk33_k33 ORDER BY idnk34_k34 DESC) AS template_k34
    FROM k33_tab k33
    WHERE LTRIM(RTRIM(k33.o_stat_k33)) = 'adding quotes'
      AND LTRIM(RTRIM(k33.upname_k33)) = 'ajoseph'
    ORDER BY k33.uptime_k33 DESC
  `);
  if (r.recordset.length === 0) return null;
  const row = r.recordset[0];
  if (!row.template_k34) return null;
  return { idnk33: row.idnk33_k33, templateK34: row.template_k34 };
}

async function findLatestPostedTemplateK34(pool: sql.ConnectionPool): Promise<number | null> {
  // For fresh-envelope mode, clone metadata from Abe's most recent k34 row
  // (any envelope, posted or staged). Ensures gennte_k34 XML version is
  // current and business defaults match the latest state Abe's own client
  // would produce.
  const r = await pool.request().query(`
    SELECT TOP 1 idnk34_k34 FROM k34_tab
    WHERE LTRIM(RTRIM(upname_k34)) = 'ajoseph'
    ORDER BY idnk34_k34 DESC
  `);
  return r.recordset[0]?.idnk34_k34 ?? null;
}

// Fire the SOL_FORM_PREFERENCES k07 bump that LL's own client fires 12+ times
// during a Post burst. Theory (per docs/flows/ll-post-sequence.md): each bump
// invalidates a different VFP cursor cache layer. Single bump silences
// piggyback's 9999806/9999607 because the existing envelope's cursor stays
// in sync — but fresh-envelope mode requires the *envelope-list cursor* to
// also invalidate, hence multi-bump.
async function bumpK07(pool: sql.ConnectionPool, label: string): Promise<void> {
  try {
    await pool.request().query(`
      UPDATE k07_tab
      SET uptime_k07 = GETDATE()
      WHERE LTRIM(RTRIM(upname_k07)) = 'ajoseph'
        AND LTRIM(RTRIM(ss_key_k07)) = 'SOL_FORM_PREFERENCES'
        AND LTRIM(RTRIM(ss_tid_k07)) = 'U'
    `);
  } catch (e: any) {
    console.log(`  note: k07 bump (${label}) skipped: ${e.message?.slice(0, 80)}`);
  }
}

// Invoice-side cursor cache invalidation. The shipping/invoicing form in
// LL UI caches kaj/k81/ka9/kae state via these k07 rows. When DIBS writes
// an invoice, Abe's already-open shipping screen displays stale "Not Sent"
// / blank Invoice # until something forces a re-read. Bumping these
// uptime_k07 fields mimics what LL UI's own form interactions do as a
// side effect — invalidating the cache so the next read pulls our writes.
// Discovered 2026-04-29 live test (CIN0066250): Abe had to manually click
// Shipped + enter Invoice # before the SQL state surfaced in his UI.
/**
 * Normalize a UoM code from LL/AX → a WAWF-accepted Unit of Measure code.
 * WAWF rejects codes outside its standard UoM table (e.g. 'B1') with:
 *   "ERROR: Unit of Measure Code 'B1' was not found in WAWF Unit of Measure table"
 *
 * LL/AX uses internal "B<N>" codes for bulk packs (B1 = pack-of-1, B25 =
 * pack-of-25, etc.). For invoicing purposes we ship in the underlying
 * unit type — usually 'EA'. WAWF case-folds lowercase to upper, so 'ea'
 * → 'EA' is accepted as-is, but unknown codes like 'B1' must be mapped.
 *
 * Discovered 2026-04-29 live test: CIN0066270 (SPE2DS26P1609) rejected
 * by WAWF for UoM 'B1'.
 */
function normalizeWawfUom(uom: string | null | undefined): string {
  if (!uom) return "EA";
  const trimmed = String(uom).trim().toUpperCase();
  if (!trimmed) return "EA";
  // B-prefix bulk-pack codes → EA (each), the underlying ship unit
  if (/^B\d+$/.test(trimmed)) return "EA";
  // Standard WAWF codes pass through (EA, BX, PG, PR, DZ, KG, LB, FT, BT,
  // TU, CN, BG, VL, etc.). If LL has anything else, log + default to EA
  // so the invoice still ships rather than blocking on a 100% data issue.
  const wawfStandard = new Set([
    "EA", "BX", "PG", "PR", "DZ", "KG", "LB", "FT", "BT", "TU",
    "CN", "BG", "VL", "RL", "ST", "SE", "PK", "JR", "GL", "QT",
    "PT", "OZ", "MT", "CM", "MM", "M2", "M3", "GM", "MG", "L",
  ]);
  if (wawfStandard.has(trimmed)) return trimmed;
  console.log(`  ⚠ unrecognized UoM '${uom}' — defaulting to 'EA' for WAWF transmission`);
  return "EA";
}

async function bumpInvoiceK07(pool: sql.ConnectionPool): Promise<void> {
  const keys = [
    "PARTS_IN_BOXES_FORM_QUERY_VALUES_EXCEPTIONS",
    "PARTS_IN_BOXES.RSZ",
    "SALES_ORDERS.RSZ",
    "SALES_ORDERS_PREFERENCES",
    "SALES_ORDERS_FORM_OPEN_ONLY_OPTION",
  ];
  for (const key of keys) {
    try {
      await pool.request().query(`
        UPDATE k07_tab SET uptime_k07 = GETDATE()
        WHERE LTRIM(RTRIM(upname_k07)) = 'ajoseph'
          AND LTRIM(RTRIM(ss_key_k07)) = '${key.replace(/'/g, "''")}'
      `);
    } catch (e: any) {
      console.log(`  note: invoice k07 bump (${key}) skipped: ${e.message?.slice(0, 80)}`);
    }
  }
}

async function createFreshEnvelope(pool: sql.ConnectionPool, templateK34: number): Promise<number> {
  // Mint a brand-new k33 staging envelope. Uses kdy_tab to allocate idnk33,
  // then inserts a k33 row with the same status-string shape LamLinks' own
  // client uses (o_stat/a_stat/s_stat='adding quotes', t_stat='not sent',
  // a_stat='not acknowledged'). itmcnt starts at 0; the regular append flow
  // will bump it as each k34 line is added.
  //
  // Runs in its own transaction so it's atomic even if the broader worker
  // loop blows up afterward.
  //
  // Multi-bump k07 (2026-04-28): LL's native client fires the
  // SOL_FORM_PREFERENCES UPDATE 12+ times across a Post burst. Single bump at
  // finalization silenced piggyback's cursor errors but not fresh-envelope's
  // 9977720. Hypothesis: each bump invalidates a different VFP cursor cache;
  // fresh-envelope creation needs bumps interleaved with the SQL steps so the
  // *envelope-list* cursor (separate from the bid-form cursor) also refreshes.
  const tx = new sql.Transaction(pool);
  await tx.begin();
  let newK33: number = 0;
  try {
    const req = new sql.Request(tx);
    const k33Alloc = await req.query(`
      DECLARE @newId INT;
      UPDATE kdy_tab WITH (ROWLOCK, HOLDLOCK)
      SET idnval_kdy = idnval_kdy + 1, @newId = idnval_kdy + 1
      WHERE tabnam_kdy = 'k33_tab';
      SELECT @newId AS id;
    `);
    newK33 = k33Alloc.recordset[0].id;
    if (!newK33) throw new Error(`kdy allocation for k33_tab failed`);

    // qotref_k33 is char(15). LamLinks' own format is "0AG09-{idnk33}" padded
    // to 15 chars (e.g. "0AG09-46853    ").
    const qotref = `0AG09-${newK33}`.padEnd(15, " ").slice(0, 15);

    await req.query(`
      INSERT INTO k33_tab (
        idnk33_k33, uptime_k33, upname_k33, qotref_k33,
        o_stat_k33, t_stat_k33, a_stat_k33, s_stat_k33,
        o_stme_k33, t_stme_k33, a_stme_k33, s_stme_k33,
        itmcnt_k33
      ) VALUES (
        ${newK33}, GETDATE(), 'ajoseph   ', '${qotref}',
        'adding quotes   ', 'not sent        ', 'not acknowledged', 'adding quotes   ',
        GETDATE(), GETDATE(), GETDATE(), GETDATE(),
        0
      )
    `);
    await tx.commit();
    console.log(`  + created fresh envelope idnk33=${newK33} (qotref="${qotref.trim()}") template_k34=${templateK34}`);
  } catch (e) {
    try { await tx.rollback(); } catch {}
    throw e;
  }
  // Bumps after the kdy_alloc + INSERT k33 steps — outside the transaction so
  // they go to LL's session-state row regardless. The single bump here
  // mirrors LL's pattern of bumping after each major SQL step. We do TWO
  // bumps for the kdy+INSERT pair (matching LL's two UI-interactions per step).
  await bumpK07(pool, "post-k33-alloc");
  await bumpK07(pool, "post-k33-insert");
  return newK33;
}

async function resolveTarget(pool: sql.ConnectionPool, sol: string, nsn: string) {
  // NSN stored with dashes in LamLinks (01-578-7887 not 015787887), take everything after the FSC
  const niin = nsn.replace(/^\d{4}-/, "");
  const r = await pool.request().query(`
    SELECT k11.idnk11_k11, k11.lam_id_k11, k11.solqty_k11, k11.sol_um_k11,
           k11.fobcod_k11, k11.our_pn_k11, k11.pr_num_k11, k11.itemno_k11,
           k10.sol_no_k10, k10.b_code_k10, k10.b_name_k10, k10.b_fax_k10,
           k10.closes_k10, k10.bq_sta_k10, k10.sol_ti_k10,
           k08.partno_k08, k08.p_cage_k08, k08.p_desc_k08, k08.fsc_k08, k08.niin_k08, k08.p_um_k08
    FROM k11_tab k11
    INNER JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
    INNER JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
    WHERE k10.sol_no_k10 = '${sol.replace(/'/g, "''")}' AND k08.niin_k08 = '${niin.replace(/'/g, "''")}'
  `);
  if (r.recordset.length === 0) return null;
  const row = r.recordset[0];
  const fsc = String(row.fsc_k08 || "").trim();
  const niinStr = String(row.niin_k08 || "").trim();
  return {
    idnk11: row.idnk11_k11 as number,
    lam_id: row.lam_id_k11 as number,
    itemno: row.itemno_k11 as number,
    solqty: row.solqty_k11 as number,
    uom: String(row.sol_um_k11 || "").trim() || "EA",
    mfrPn: String(row.partno_k08 || "").trim(),
    mfrCage: String(row.p_cage_k08 || "").trim(),
    desc: String(row.p_desc_k08 || "").trim(),
    nsn: `${fsc}-${niinStr}`,
    fobcod: (String(row.fobcod_k11 || "D").trim() === "O" ? "O" : "D") as "D" | "O",
    sol_no: String(row.sol_no_k10 || "").trim(),
    buycod: String(row.b_code_k10 || "").trim(),
    buynam: String(row.b_name_k10 || "").trim(),
    buyfax: String(row.b_fax_k10 || "").trim(),
    yp_no: String(row.pr_num_k11 || "").trim(),
    closes: row.closes_k10 as Date,
    bq_sta: String(row.bq_sta_k10 || "included").trim(),
    sol_ti: String(row.sol_ti_k10 || "F").trim(),
    our_pn: String(row.our_pn_k11 || "").trim(),
  };
}

type ResolvedTarget = NonNullable<Awaited<ReturnType<typeof resolveTarget>>>;

/**
 * Build a QtbBidLineData from a resolved target + bid params.
 * Used to accumulate lines for the per-envelope .laz upload.
 */
function buildQtbLine(target: ResolvedTarget, bidPrice: number, bidQty: number, deliveryDays: number, idnk34: number): QtbBidLineData {
  // LAMREF: cosmetic 15-char field. LL UI puts an FSC-NIIN-style abbreviation
  // (often shared across an envelope from session state). Safe default: the
  // sol_no truncated — Sally accepts any short string.
  const lamref = target.sol_no.slice(0, 15);
  return {
    idnqtb: idnk34,           // qtb wire format reuses k34's id
    lam_id: target.lam_id,
    lamref,
    lamitm: target.itemno,
    duedte: target.closes,
    buycod: target.buycod,
    buynam: target.buynam,
    buyfax: target.buyfax || undefined,
    yp_no: target.yp_no,
    sol_no: target.sol_no,
    vpn: target.our_pn || undefined,
    pn: target.mfrPn,
    mcage: target.mfrCage,
    desc: target.desc.slice(0, 20),
    nsn: target.nsn,
    fobcod: target.fobcod,
    qty_ui: target.uom,
    solqty: target.solqty,
    qty1: bidQty,
    up1: bidPrice,
    aro1: deliveryDays,
    bq_sta: target.bq_sta,
    sol_ti: target.sol_ti,
  };
}

function pad(s: string, n: number) { return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }

async function writeOneBid(
  pool: sql.ConnectionPool,
  envelope: { idnk33: number; templateK34: number },
  target: any,
  bidPrice: number,
  bidQty: number,
  deliveryDays: number,
): Promise<{ idnk34: number; idnk35: number }> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  let newK34 = 0;
  let newK35 = 0;
  try {
    const req = new sql.Request(tx);

    // Re-verify envelope still staged
    const envCheck = await req.query(`SELECT o_stat_k33 FROM k33_tab WITH (UPDLOCK, HOLDLOCK) WHERE idnk33_k33 = ${envelope.idnk33}`);
    if (String(envCheck.recordset[0]?.o_stat_k33 || "").trim() !== "adding quotes") {
      throw new Error(`Envelope ${envelope.idnk33} flipped state mid-flight`);
    }

    // Atomically allocate next k34 + k35 ids from kdy_tab (LamLinks' sequence
    // table). UPDATE takes a row-level lock on the kdy row, so even if Abe's
    // client tries to read the same sequence at the same instant, it'll wait
    // until we commit and then get the next value.
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
    newK34 = k34Alloc.recordset[0].id;
    newK35 = k35Alloc.recordset[0].id;
    if (!newK34 || !newK35) throw new Error(`kdy allocation failed: k34=${newK34}, k35=${newK35}`);

    const safePn = (target.mfrPn || "").replace(/'/g, "''");
    const safeCage = (target.mfrCage || "").replace(/'/g, "''");

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
        ${newK34}, GETDATE(), upname_k34, ${target.idnk11}, ${envelope.idnk33},
        CAST('${safePn}' AS CHAR(32)), pn_rev_k34,
        scage_k34, sname_k34, saddr1_k34, saddr2_k34, scitys_k34, szip_k34, sfax_k34,
        sphone_k34, semail_k34, sattn_k34, stitle_k34, staxid_k34, bizsiz_k34, disadv_k34,
        womown_k34, CAST('${safeCage}' AS CHAR(5)),
        s1cage_k34, s1name_k34, s1city_k34, s2cage_k34, s2name_k34,
        s2city_k34, s3cage_k34, s3name_k34, s3city_k34, trmdes_k34, bidtyp_k34, p0301_k34,
        fobcod_k34, shpcty_k34, valday_k34, allqty_k34, insmat_k34, inspkg_k34, hazard_k34,
        forign_k34, newprt_k34, surpls_k34, rebilt_k34, qtyvpp_k34, qtyvmp_k34, baspon_k34,
        qmcage_k34, qscage_k34, qpltno_k34, dly_ar_k34,
        CAST('${pad(target.uom, 2)}' AS CHAR(2)), ${target.solqty},
        gennte_k34, pkgnte_k34, qrefno_k34, orgtyp_k34, popnam_k34, poptin_k34, qplsid_k34,
        sub_eo_k34, sub_aa_k34, cuntor_k34, abpfun_k34, hlqs_k34, adclin_k34, idpo_k34,
        hubzsb_k34, altadr_k34, chlbor_k34, qtek14_k34, ctlxml_k34
      FROM k34_tab WHERE idnk34_k34 = ${envelope.templateK34}
    `);

    await req.query(`
      INSERT INTO k35_tab (idnk35_k35, uptime_k35, upname_k35, idnk34_k35, qty_k35, up_k35, daro_k35, clin_k35)
      VALUES (${newK35}, GETDATE(), 'ajoseph   ', ${newK34}, ${bidQty}, ${bidPrice}, ${deliveryDays}, '      ')
    `);

    await req.query(`
      UPDATE k33_tab SET itmcnt_k33 = itmcnt_k33 + 1, uptime_k33 = GETDATE()
      WHERE idnk33_k33 = ${envelope.idnk33}
    `);

    await tx.commit();
  } catch (e) {
    try { await tx.rollback(); } catch {}
    throw e;
  }
  // Multi-bump k07 after each major SQL step (mirrors LL native cadence —
  // 12+ bumps per Post burst). Outside the transaction so they go to LL's
  // session-state row regardless. Six bumps here matches LL's "1 bump per
  // UI interaction" pattern (kdy alloc, k34 INSERT, kdy alloc, k35 INSERT,
  // itmcnt UPDATE, plus a final settle bump).
  await bumpK07(pool, "post-line-kdy");
  await bumpK07(pool, "post-line-k34-insert");
  await bumpK07(pool, "post-line-k35-insert");
  await bumpK07(pool, "post-line-itmcnt");
  return { idnk34: newK34, idnk35: newK35 };
}

async function writeHeartbeat(supabase: any) {
  // Update the worker heartbeat on every poll (whether toggle is on or off).
  // UI reads this to decide whether to show "LamLinks worker is offline" warning.
  // We also publish the worker's hostname so the UI can show operators
  // which box to RDP into when the daemon needs a manual restart — the
  // task can be moved between boxes without code changes.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const host = require("os").hostname();
  await supabase.from("system_settings").upsert(
    [
      { key: "lamlinks_worker_last_heartbeat", value: new Date().toISOString(), description: "ISO timestamp from the LamLinks worker's last poll — UI uses this to detect stale workers" },
      { key: "lamlinks_worker_host", value: host, description: "Hostname of the box currently running the LamLinks recurring daemon. Updated on every heartbeat." },
    ],
    { onConflict: "key" },
  );
}

async function processOnePass(): Promise<{ processed: number; failed: number; waiting: number }> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Always write heartbeat, even if the feature flag is off — tells the UI
  // the worker is alive, just idle.
  await writeHeartbeat(supabase);

  if (!(await getWritebackEnabled(supabase))) {
    console.log(`[${new Date().toISOString()}] writeback disabled — skipping poll`);
    return { processed: 0, failed: 0, waiting: 0 };
  }

  const { data: queue } = await supabase
    .from("lamlinks_write_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(MAX_ROWS_PER_PASS);

  if (!queue || queue.length === 0) {
    console.log(`[${new Date().toISOString()}] queue empty`);
    return { processed: 0, failed: 0, waiting: 0 };
  }
  console.log(`[${new Date().toISOString()}] ${queue.length} pending rows`);

  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  let processed = 0, failed = 0, waiting = 0;
  try {
    let envelope = await findStagedEnvelope(pool);
    // Track whether we created the envelope in this pass. If we did, we own
    // its lifecycle — flip it to 'quotes added' at pass end so LL's transmit
    // daemon actually ships. If we're piggybacking into an envelope Abe
    // himself started in LL, we leave the state alone (he'll Post it).
    let weCreatedEnvelope = false;
    if (!envelope) {
      // No staged envelope.
      const freshEnabled = await getFreshEnvelopeEnabled(supabase);
      if (!freshEnabled) {
        console.log(`  no staged envelope and fresh-envelope mode disabled — leaving ${queue.length} rows pending until Abe seeds`);
        waiting = queue.length;
        return { processed, failed, waiting };
      }
      // Mint a fresh one so DIBS doesn't have to wait for Abe to save a seed
      // bid first. Uses kdy_tab for the idnk33 and clones k34 metadata from
      // Abe's most recent k34 row (posted or not). Note: produces cosmetic
      // VFP cursor error 9977720 in LL UI on Post — bid still transmits.
      console.log(`  no staged envelope — minting a fresh one...`);
      const templateK34 = await findLatestPostedTemplateK34(pool);
      if (!templateK34) {
        console.log(`  no k34 template row found under upname='ajoseph' — cannot proceed`);
        waiting = queue.length;
        return { processed, failed, waiting };
      }
      const newIdnK33 = await createFreshEnvelope(pool, templateK34);
      envelope = { idnk33: newIdnK33, templateK34 };
      weCreatedEnvelope = true;
    } else {
      console.log(`  piggybacking into envelope ${envelope.idnk33}, template k34=${envelope.templateK34}`);
    }

    // Accumulate qtb lines for the per-envelope .laz upload (parallel to the
    // SQL writeback). LL UI's Post-bid action does BOTH: insert k33/k34/k35
    // SQL rows AND upload a qtb_tab.laz to sftp.lamlinks.com:/incoming/. The
    // SFTP drop is what actually transmits the bid to DLA via Sally; the
    // SQL rows are LL-side audit trail. We mirror that.
    const qtbLines: QtbBidLineData[] = [];
    const qtbQueueIds: string[] = []; // for marking sftp_filename later

    for (const row of queue) {
      // Mark processing (claim)
      const { data: claimed } = await supabase
        .from("lamlinks_write_queue")
        .update({ status: "processing", picked_up_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id");
      if (!claimed || claimed.length === 0) continue; // someone else took it

      try {
        const target = await resolveTarget(pool, row.solicitation_number, row.nsn);
        if (!target) {
          throw new Error(`sol ${row.solicitation_number} / NSN ${row.nsn} not in k10/k11/k08`);
        }
        const result = await writeOneBid(
          pool,
          envelope,
          target,
          Number(row.bid_price),
          Number(row.bid_qty),
          Number(row.delivery_days),
        );
        // Stash the qtb line for the per-envelope .laz upload (after loop)
        qtbLines.push(buildQtbLine(target, Number(row.bid_price), Number(row.bid_qty), Number(row.delivery_days), result.idnk34));
        qtbQueueIds.push(row.id);
        const { error: doneErr } = await supabase
          .from("lamlinks_write_queue")
          .update({
            status: "done",
            processed_at: new Date().toISOString(),
            envelope_idnk33: envelope.idnk33,
            line_idnk34: result.idnk34,
            price_idnk35: result.idnk35,
          })
          .eq("id", row.id);
        // CHECK the error — Supabase silently returns errors via the
        // `error` field rather than throwing. Without this check, unique
        // constraint violations (e.g. (sol, nsn, status='done')) leave
        // queue rows stuck in 'processing' indefinitely. Discovered
        // 2026-04-29 when a duplicate-bid submission left row 10 stuck.
        if (doneErr) {
          throw new Error(`failed to mark queue row ${row.id} as done: ${doneErr.message}`);
        }
        processed++;
        console.log(`  ✓ ${row.solicitation_number} — k34=${result.idnk34}, k35=${result.idnk35}`);
      } catch (e: any) {
        await supabase
          .from("lamlinks_write_queue")
          .update({
            status: "failed",
            processed_at: new Date().toISOString(),
            error_message: e.message?.slice(0, 500),
          })
          .eq("id", row.id);
        failed++;
        console.log(`  ✗ ${row.solicitation_number}: ${e.message}`);
      }
    }

    // SFTP-upload the bid .laz to sftp.lamlinks.com:/incoming/ — the actual
    // DLA transmission path. Only when WE created the envelope: piggybacking
    // into Abe's in-progress envelope means Abe will Post (and upload) it.
    // Run BEFORE the o_stat → 'quotes added' flip so an SFTP failure leaves
    // the envelope in 'adding quotes' state for retry; flipping first risks
    // LL believing the bid was shipped when it wasn't.
    let bidLazUploaded = false;
    if (weCreatedEnvelope && qtbLines.length > 0) {
      try {
        const result = await transmitBidEnvelope(
          { idnk33: envelope.idnk33, lines: qtbLines },
          { templateDir: BID_TEMPLATE_DIR }
        );
        bidLazUploaded = true;
        console.log(`  ✓ uploaded bid .laz ${result.filename} (${result.bytes} bytes${result.dryRun ? ", DRY RUN" : ""})`);
        // Stamp the filename on each contributing queue row
        for (const qid of qtbQueueIds) {
          await supabase
            .from("lamlinks_write_queue")
            .update({ ll_bid_laz_filename: result.filename, ll_bid_dry_run: result.dryRun })
            .eq("id", qid);
        }
      } catch (e: any) {
        console.error(`  ⚠ bid SFTP upload failed for envelope ${envelope.idnk33}: ${e.message}`);
        // Don't flip o_stat → 'quotes added': leave envelope in 'adding quotes'
        // so a future pass can retry the SFTP drop. SQL rows are intact and
        // marked done; the qtbLines can be rebuilt from k34_tab on retry.
      }
    }

    // Finalize the envelope: flip o_stat_k33 + s_stat_k33 to 'quotes added'
    // (Post-equivalent) AND t_stat_k33='sent' + t_stme_k33=GETDATE()
    // (Process-File-equivalent). Captured 2026-04-29 via procmon: LL UI's
    // Process File click does (a) re-zip + SFTP and (b) UPDATE k33 to flip
    // t_stat='sent'. Since our worker already SFTP'd directly, we only
    // need the SQL flip — skipping LL UI's redundant SFTP. Without this
    // t_stat flip, LL UI shows "Not Sent" even though DLA has the bid.
    // Only run when WE created the envelope; piggyback envelopes are
    // Abe's to Post + Process File. Skip if zero bids landed OR SFTP failed.
    if (weCreatedEnvelope && processed > 0 && bidLazUploaded) {
      try {
        await pool.request().query(`
          UPDATE k33_tab
          SET o_stat_k33 = 'quotes added',
              s_stat_k33 = 'quotes added',
              t_stat_k33 = 'sent',
              t_stme_k33 = GETDATE(),
              uptime_k33 = GETDATE()
          WHERE idnk33_k33 = ${envelope.idnk33}
            AND LTRIM(RTRIM(o_stat_k33)) = 'adding quotes'
        `);
        console.log(`  ✓ finalized envelope ${envelope.idnk33} → 'quotes added' + t_stat='sent' (Post + Process File equivalents in one UPDATE)`);
      } catch (e: any) {
        console.error(`  ⚠ failed to finalize envelope ${envelope.idnk33}: ${e.message}`);
        // Don't fail the pass — bids are in k34, envelope just needs the
        // janitor or manual flip. Surfaces via the stuck-envelope alert.
      }

      // Bump ajoseph's k07_tab session-state row. The 2026-04-24 XE trace
      // captured LL's own Post flow doing exactly this: before finalizing
      // a bid, LL UPDATEs its SOL_FORM_PREFERENCES k07 row to stamp a
      // fresh uptime. We suspect this is what "warms" the VFP local
      // cursor so it accepts the new k33/k34 rows without throwing
      // 9999806/9999607 cursor conflicts. Best-effort — if the row is
      // missing or LL's not running, this is harmless no-op.
      try {
        const k07 = await pool.request().query(`
          UPDATE k07_tab
          SET uptime_k07 = GETDATE()
          WHERE LTRIM(RTRIM(upname_k07)) = 'ajoseph'
            AND LTRIM(RTRIM(ss_key_k07)) = 'SOL_FORM_PREFERENCES'
            AND LTRIM(RTRIM(ss_tid_k07)) = 'U'
        `);
        console.log(`  ✓ bumped k07_tab SOL_FORM_PREFERENCES row (${k07.rowsAffected?.[0] || 0} rows, matches LL Post trace)`);
      } catch (e: any) {
        console.log(`  note: k07 bump skipped: ${e.message?.slice(0, 80)}`);
      }
    }
  } finally {
    await pool.close();
  }

  return { processed, failed, waiting };
}

// ─── Rescue action processor ─────────────────────────────────────────
// Polled alongside the write queue. Executes actions enqueued by the
// /ops/lamlinks UI against the LL DB (which only this worker can reach).

type RescueAction = {
  id: number;
  action: string;
  params: Record<string, any>;
  requested_by: string;
};

async function processRescueActions(pool: sql.ConnectionPool, supabase: any): Promise<number> {
  const { data: rows } = await supabase
    .from("lamlinks_rescue_actions")
    .select("id, action, params, requested_by")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);

  let done = 0;
  for (const row of rows || []) {
    // Claim
    const { data: claimed } = await supabase
      .from("lamlinks_rescue_actions")
      .update({ status: "claimed", picked_up_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const dry = row.params?.dry_run === true;
    try {
      const result = await runRescueAction(pool, row as RescueAction, dry);
      await supabase
        .from("lamlinks_rescue_actions")
        .update({ status: "done", result, processed_at: new Date().toISOString() })
        .eq("id", row.id);
      done++;
      console.log(`  rescue #${row.id} ${row.action} done`);
    } catch (e: any) {
      await supabase
        .from("lamlinks_rescue_actions")
        .update({ status: "error", error: e.message || String(e), processed_at: new Date().toISOString() })
        .eq("id", row.id);
      console.error(`  rescue #${row.id} ${row.action} FAILED: ${e.message}`);
    }
  }
  return done;
}

async function runRescueAction(pool: sql.ConnectionPool, a: RescueAction, dry: boolean): Promise<any> {
  switch (a.action) {
    case "inspect": {
      const idnk33 = Number(a.params.idnk33);
      const env = await pool.request().input("id", sql.Int, idnk33).query("SELECT * FROM k33_tab WHERE idnk33_k33 = @id");
      if (env.recordset.length === 0) throw new Error(`k33=${idnk33} not found`);
      const k34 = await pool.request().input("id", sql.Int, idnk33).query("SELECT * FROM k34_tab WHERE idnk33_k34 = @id ORDER BY idnk34_k34");
      const k34Ids = k34.recordset.map((r: any) => r.idnk34_k34);
      let k35: any[] = [];
      if (k34Ids.length > 0) {
        const ph = k34Ids.map((_: any, i: number) => `@k${i}`).join(",");
        const r = pool.request();
        k34Ids.forEach((id: number, i: number) => r.input(`k${i}`, sql.Int, id));
        const qr = await r.query(`SELECT * FROM k35_tab WHERE idnk34_k35 IN (${ph}) ORDER BY idnk35_k35`);
        k35 = qr.recordset;
      }
      return { envelope: env.recordset[0], k34: k34.recordset, k35 };
    }
    case "list_staging": {
      const user = a.params.user?.trim();
      const r = pool.request();
      let where = `WHERE RTRIM(o_stat_k33) = 'adding quotes'`;
      if (user) { r.input("u", sql.VarChar, user); where += ` AND RTRIM(upname_k33) = @u`; }
      const q = await r.query(`SELECT TOP 30 idnk33_k33, qotref_k33, o_stat_k33, itmcnt_k33, upname_k33, uptime_k33 FROM k33_tab ${where} ORDER BY uptime_k33 DESC`);
      return { envelopes: q.recordset };
    }
    case "mark_sent": {
      const idnk33 = Number(a.params.idnk33);
      const env = await pool.request().input("id", sql.Int, idnk33).query("SELECT t_stat_k33, o_stat_k33, itmcnt_k33 FROM k33_tab WHERE idnk33_k33 = @id");
      if (env.recordset.length === 0) throw new Error(`k33=${idnk33} not found`);
      if (String(env.recordset[0].t_stat_k33 || "").trim() === "sent") return { noop: true, reason: "already sent" };
      if (dry) return { would_update: { o_stat_k33: "quotes added", t_stat_k33: "sent", a_stat_k33: "acknowledged", s_stat_k33: "acknowledged" } };
      await pool.request().input("id", sql.Int, idnk33).query(`
        UPDATE k33_tab SET o_stat_k33='quotes added', t_stat_k33='sent', a_stat_k33='acknowledged', s_stat_k33='acknowledged', uptime_k33=GETDATE()
        WHERE idnk33_k33 = @id
      `);
      return { updated: true };
    }
    case "retire": {
      const idnk33 = Number(a.params.idnk33);
      const env = await pool.request().input("id", sql.Int, idnk33).query("SELECT o_stat_k33, t_stat_k33 FROM k33_tab WHERE idnk33_k33 = @id");
      if (env.recordset.length === 0) throw new Error(`k33=${idnk33} not found`);
      if (String(env.recordset[0].t_stat_k33 || "").trim() === "sent") throw new Error("t_stat='sent' — refusing to touch real post");
      if (String(env.recordset[0].o_stat_k33 || "").trim() === "quotes added") return { noop: true, reason: "already quotes added" };
      if (dry) return { would_update: { o_stat_k33: "quotes added", s_stat_k33: "quotes added" } };
      await pool.request().input("id", sql.Int, idnk33).query(`UPDATE k33_tab SET o_stat_k33='quotes added', s_stat_k33='quotes added', uptime_k33=GETDATE() WHERE idnk33_k33 = @id`);
      return { updated: true };
    }
    case "remove_k34": {
      const idnk34 = Number(a.params.idnk34);
      const row = await pool.request().input("id", sql.Int, idnk34).query("SELECT k34.idnk33_k34, k33.o_stat_k33 FROM k34_tab k34 JOIN k33_tab k33 ON k33.idnk33_k33 = k34.idnk33_k34 WHERE k34.idnk34_k34 = @id");
      if (row.recordset.length === 0) throw new Error(`k34=${idnk34} not found`);
      if (String(row.recordset[0].o_stat_k33 || "").trim() !== "adding quotes") throw new Error("envelope not in 'adding quotes'");
      const k35count = await pool.request().input("id", sql.Int, idnk34).query("SELECT COUNT(*) AS c FROM k35_tab WHERE idnk34_k35 = @id");
      if (dry) return { would_delete_k35: k35count.recordset[0].c, would_delete_k34: 1, would_decrement_k33: row.recordset[0].idnk33_k34 };
      const tx = new sql.Transaction(pool);
      await tx.begin();
      try {
        await new sql.Request(tx).input("id", sql.Int, idnk34).query("DELETE FROM k35_tab WHERE idnk34_k35 = @id");
        await new sql.Request(tx).input("id", sql.Int, idnk34).query("DELETE FROM k34_tab WHERE idnk34_k34 = @id");
        await new sql.Request(tx).input("id", sql.Int, row.recordset[0].idnk33_k34).query("UPDATE k33_tab SET itmcnt_k33 = itmcnt_k33 - 1, uptime_k33 = GETDATE() WHERE idnk33_k33 = @id");
        await tx.commit();
      } catch (e) { try { await tx.rollback(); } catch {} throw e; }
      return { deleted: true };
    }
    case "move_k34": {
      const from = Number(a.params.from_idnk33);
      const to = Number(a.params.to_idnk33);
      const ids: number[] = (a.params.k34_ids || []).map((x: any) => Number(x));
      if (!from || !to || ids.length === 0) throw new Error("from, to, k34_ids required");
      if (dry) return { would_move: ids.length, from, to };
      const ph = ids.map((_, i) => `@k${i}`).join(",");
      const tx = new sql.Transaction(pool);
      await tx.begin();
      try {
        const r1 = new sql.Request(tx); ids.forEach((id, i) => r1.input(`k${i}`, sql.Int, id)); r1.input("to", sql.Int, to);
        await r1.query(`UPDATE k34_tab SET idnk33_k34 = @to, uptime_k34 = GETDATE() WHERE idnk34_k34 IN (${ph})`);
        await new sql.Request(tx).input("from", sql.Int, from).input("n", sql.Int, ids.length).query(`UPDATE k33_tab SET itmcnt_k33 = itmcnt_k33 - @n, uptime_k33 = GETDATE() WHERE idnk33_k33 = @from`);
        await new sql.Request(tx).input("to", sql.Int, to).input("n", sql.Int, ids.length).query(`UPDATE k33_tab SET itmcnt_k33 = itmcnt_k33 + @n, uptime_k33 = GETDATE() WHERE idnk33_k33 = @to`);
        await tx.commit();
      } catch (e) { try { await tx.rollback(); } catch {} throw e; }
      return { moved: ids.length };
    }
    case "curl_test": {
      // One-off test: curl Sally from this host and return response.
      // Used to verify whether LL's API IP-whitelists our workstation.
      // Runs a minimal --digest call with the env creds; doesn't touch
      // DB. Safe. Returns HTTP status + first 500 bytes of response.
      if (dry) return { would_test: true };
      // Accept creds via params for one-off testing (worker's .env may not
      // have LL_* vars yet). Params override env. Stored in rescue table
      // briefly — delete the row after the test.
      const login = a.params?.sally_login || process.env.LL_SALLY_LOGIN || "";
      const key = a.params?.api_key || process.env.LL_API_KEY || "";
      const secret = a.params?.api_secret || process.env.LL_API_SECRET || "";
      const user = `${login}#${key}`;
      const pass = secret;
      const url = String(a.params?.url || "http://api.lamlinks.com/api/rfq/get_sent_quotes_by_timeframe");
      const body = "quote_min_datetime=4%2F24%2F2026+3%3A00%3A00+AM+UTC&quote_max_datetime=4%2F24%2F2026+7%3A00%3A00+AM+UTC";
      const { spawnSync } = require("child_process");
      const proc = spawnSync("curl", ["-s", "-w", "\nHTTP %{http_code}\n", "--digest", "-u", `${user}:${pass}`, "--data", body, url], {
        encoding: "utf8",
        timeout: 20_000,
      });
      const out = `${proc.stdout || ""}\n${proc.stderr || ""}`;
      return { url, output: out.slice(0, 1500) };
    }
    case "refresh_nsn_history": {
      // Spawn the CLI script so the worker and the manual CLI invocation
      // share the exact same refresh logic (scripts/refresh-ll-history-for-nsn.ts).
      const nsn = String(a.params?.nsn || "").trim();
      if (!/^\d{4}-\d{2}-\d{3}-\d{4}$/.test(nsn)) throw new Error(`invalid nsn: ${nsn}`);
      if (dry) return { would_refresh: nsn };
      const { spawnSync } = require("child_process");
      const proc = spawnSync("npx", ["tsx", "scripts/refresh-ll-history-for-nsn.ts", "--nsn", nsn], {
        cwd: "C:\\tmp\\dibs-init\\dibs",
        encoding: "utf8",
        shell: true,
        timeout: 90_000,
      });
      const out = `${proc.stdout || ""}\n${proc.stderr || ""}`;
      if (proc.status !== 0) throw new Error(`refresh failed: ${out.slice(-400)}`);
      // Parse the stdout's summary lines
      const awardsMatch = out.match(/(\d+) newly inserted/g);
      return { nsn, output_tail: out.slice(-500), awards_inserted: awardsMatch?.[0], bids_inserted: awardsMatch?.[1] };
    }
    case "refresh_invoice_queue_from_ll": {
      // Scan LL kad_tab for today's posted DD219 invoices and sync state into
      // lamlinks_invoice_queue. Used after Abe posts manually and we want DIBS
      // to reflect that without re-pulling AX.
      const date = String(a.params?.date || new Date().toISOString().slice(0, 10));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`invalid date: ${date}`);
      if (dry) return { would_refresh: date };
      const { spawnSync } = require("child_process");
      const proc = spawnSync("npx", ["tsx", "scripts/_premark-already-invoiced.ts", `--date=${date}`], {
        cwd: "C:\\tmp\\dibs-init\\dibs",
        encoding: "utf8",
        shell: true,
        timeout: 60_000,
      });
      const out = `${proc.stdout || ""}\n${proc.stderr || ""}`;
      if (proc.status !== 0) throw new Error(`refresh failed: ${out.slice(-400)}`);
      const llCountMatch = out.match(/LL has (\d+) posted DD219 invoices/);
      const updatedMatch = out.match(/(\d+) inserted, (\d+) updated/);
      return {
        date,
        ll_posted_today: llCountMatch ? parseInt(llCountMatch[1], 10) : null,
        inserted: updatedMatch ? parseInt(updatedMatch[1], 10) : null,
        updated: updatedMatch ? parseInt(updatedMatch[2], 10) : null,
        output_tail: out.slice(-400),
      };
    }
    case "import_dd219_invoices": {
      // Pull today's DD219 invoices from AX and enqueue them in
      // lamlinks_invoice_queue. The post-batch UI's "Import" button calls
      // /api/invoicing/import which enqueues this rescue action.
      const date = String(a.params?.date || new Date().toISOString().slice(0, 10));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`invalid date: ${date}`);
      if (dry) return { would_import: date };
      const { spawnSync } = require("child_process");
      const proc = spawnSync("npx", ["tsx", "scripts/enqueue-ax-invoices-for-ll.ts", `--date=${date}`], {
        cwd: "C:\\tmp\\dibs-init\\dibs",
        encoding: "utf8",
        shell: true,
        timeout: 120_000,
      });
      const out = `${proc.stdout || ""}\n${proc.stderr || ""}`;
      if (proc.status !== 0) throw new Error(`import failed: ${out.slice(-400)}`);
      const enqueuedMatch = out.match(/Enqueued (\d+) invoices/);
      const totalMatch = out.match(/AX returned (\d+) DD219/);
      return {
        date,
        ax_total: totalMatch ? parseInt(totalMatch[1], 10) : null,
        enqueued: enqueuedMatch ? parseInt(enqueuedMatch[1], 10) : null,
        output_tail: out.slice(-500),
      };
    }
    case "refresh_dibbs_clins": {
      // Scrape DIBBS Package View for a sol to populate dibbs_sol_clins.
      // Used to fix the multi-CLIN qty gap: LL's own scraper only captures
      // the first CLIN's qty, so DIBS shows wrong totals on multi-CLIN sols.
      const sol = String(a.params?.sol || "").trim().toUpperCase();
      if (!/^SPE\w{3}-\d{2}-[A-Z]-\w{4}$/.test(sol)) throw new Error(`invalid sol format: ${sol}`);
      if (dry) return { would_scrape: sol };
      const { spawnSync } = require("child_process");
      const proc = spawnSync("npx", ["tsx", "scripts/scrape-dibbs-clins.ts", "--sol", sol], {
        cwd: "C:\\tmp\\dibs-init\\dibs",
        encoding: "utf8",
        shell: true,
        timeout: 120_000,
      });
      const out = `${proc.stdout || ""}\n${proc.stderr || ""}`;
      if (proc.status !== 0) throw new Error(`scrape failed: ${out.slice(-400)}`);
      const totalMatch = out.match(/Total qty across all CLINs: (\d+)/);
      const wroteMatch = out.match(/wrote (\d+) CLIN rows/);
      return {
        sol,
        clins_written: wroteMatch ? parseInt(wroteMatch[1], 10) : null,
        total_qty: totalMatch ? parseInt(totalMatch[1], 10) : null,
        output_tail: out.slice(-500),
      };
    }
    case "extract_to_temp":
    case "nuke": {
      // Keep UI shipping; these two are destructive enough that we route
      // them to the existing CLI scripts until we're fully confident in
      // button-driven execution. Operator runs the script directly.
      throw new Error(`action '${a.action}' is still CLI-only for safety — run scripts/ll-${a.action === "extract_to_temp" ? "extract-to-temp" : "nuke-envelope"}.ts locally`);
    }
    default:
      throw new Error(`unknown action '${a.action}'`);
  }
}

async function getInvoiceWritebackEnabled(supabase: any): Promise<boolean> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "lamlinks_invoice_writeback_enabled")
    .maybeSingle();
  return data?.value === "true";
}

/**
 * Drain lamlinks_invoice_queue: for each row in `approved` state, replicate
 * Abe's manual invoicing flow as a single SQL transaction:
 *
 *   1. Resolve kaj_tab shipment via contract # + invoice total match:
 *        AX CustomersOrderReference (e.g. SPE2DS-26-P-1489[SM3106])
 *        → strip [suffix] → cntrct_k79
 *        → k80_tab.idnk79_k80 = <idnk79> AND k80_tab.relext_k80 = <ax_total>
 *        → kaj_tab.idnk80_kaj = <idnk80>
 *   2. INSERT kad header (cinsta_kad='Posted' directly — no draft step).
 *      cin_no_kad = LL counter MAX+1; cinnum_kad = AX invoice digits.
 *   3. INSERT kae line(s) under the kad.
 *   4. UPDATE k80 to release: rlsdte_k80=GETDATE(), rlssta_k80='Closed'.
 *   4c. UPDATE k81.shpsta_k81 'Shipping'→'Shipped' (drives UI status label).
 *   5. INSERT 2 kbr rows: WAWF 810 (idnkap=24) + WAWF 856 (idnkap=25),
 *      itttbl_kbr='kaj', idnitt_kbr=<kaj_id>, xtcsta_kbr='WAWF X sent'.
 *
 * Validated against the 2026-04-28 trace of CIN0066169 ($17,796 against
 * SPE2DS-26-P-1489 → kaj=353326). Schema fields confirmed via direct
 * inspection of the row Abe just created.
 *
 * Lifecycle:
 *   Abe imports → state='pending' (review-only, worker ignores)
 *   Abe clicks "Post All" → bulk update pending→approved → worker drains
 *   Worker writes → state='posted' (terminal)
 *   Errors → state='error' with error_message
 */
async function processInvoiceQueue(): Promise<void> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  if (!(await getInvoiceWritebackEnabled(supabase))) return;

  const { data: approved } = await supabase
    .from("lamlinks_invoice_queue")
    .select("*")
    .eq("state", "approved")
    .order("enqueued_at", { ascending: true })
    .limit(25);
  if (!approved || approved.length === 0) return;
  console.log(`[${new Date().toISOString()}] processing ${approved.length} approved invoices`);

  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  try {
    for (const row of approved) {
      const { data: claimed } = await supabase
        .from("lamlinks_invoice_queue")
        .update({ state: "processing", picked_up_at: new Date().toISOString(), worker_host: require("os").hostname() })
        .eq("id", row.id)
        .eq("state", "approved")
        .select("id");
      if (!claimed || claimed.length === 0) continue;

      try {
        const result = await writeOneInvoice(pool, row);

        // Invalidate Abe's LL UI cursor cache for the shipping form so it
        // re-reads the kaj/k81/ka9/kae state we just wrote. Without this,
        // his UI shows stale state — Invoice # column blank, Shipped
        // checkbox unchecked — even though SQL is correct. (Discovered
        // 2026-04-29 live test on CIN0066250: Abe had to manually click
        // Shipped + enter Invoice # before LL UI displayed our writes.)
        // Mirrors the bid path's bumpK07 SOL_FORM_PREFERENCES pattern,
        // but for the shipping form's k07 keys.
        await bumpInvoiceK07(pool);

        // SQL writeback succeeded — now do the WAWF SFTP upload (the step that
        // actually transmits EDI to gov side). Without this, kad/kae/kbr/k20
        // exist locally but DLA never receives the invoice. Discovered via
        // procmon trace 2026-04-29 — see project_wawf_sftp_mechanism.md.
        const wawfDryRun = process.env.LL_WAWF_DRY_RUN === "true";
        const wawfResult = await transmitWawfForKaj(pool, result.kaj, result, wawfDryRun);

        // Bump again after SFTP so any UI element that reads kbr/SFTP
        // state (e.g. the 810/856 sent indicators) refreshes too.
        await bumpInvoiceK07(pool);

        await supabase.from("lamlinks_invoice_queue").update({
          state: "posted",
          posted_at: new Date().toISOString(),
          ll_idnkad: result.idnkad,
          ll_cin_no: String(result.cinNo),
          ll_kae_ids: result.idnkaeIds,
          ll_wawf_810_filename: wawfResult.filename810,
          ll_wawf_856_filename: wawfResult.filename856,
          ll_wawf_dry_run: wawfDryRun,
          error_message: null,
        }).eq("id", row.id);
        console.log(`  ✓ ${row.ax_invoice_number} → kad=${result.idnkad} kae=[${result.idnkaeIds.join(",")}] kbr=[${result.idnkbrIds.join(",")}]`);
      } catch (e: any) {
        await supabase.from("lamlinks_invoice_queue").update({
          state: "error",
          error_message: (e.message || String(e)).slice(0, 500),
        }).eq("id", row.id);
        console.log(`  ✗ ${row.ax_invoice_number}: ${e.message}`);
      }
    }
  } finally {
    await pool.close();
  }
}

/**
 * Single-invoice writeback (kad+kae+k80+kbr) in one SQL transaction.
 * Returns the new LL ids on success. Throws on any mismatch or DB error.
 */
async function writeOneInvoice(
  pool: sql.ConnectionPool,
  row: any,
): Promise<{ idnkad: number; idnkaeIds: number[]; idnkbrIds: number[]; cinNo: number; kaj: number; trnId: number }> {
  // 1. Resolve kaj via contract # + invoice total.
  const orderRef = String(row.ax_customer_order_reference || "").trim();
  const contractNo = orderRef.split("[")[0].trim();
  if (!contractNo) throw new Error("missing ax_customer_order_reference");
  const total = Number(row.ax_total_amount) || 0;
  if (total <= 0) throw new Error("missing ax_total_amount");

  // Match either Shipped (already past Abe's manual "click Shipped") or
  // Packing (warehouse-fresh; we'll flip to Shipped inside the transaction
  // below, mimicking Abe's manual flow). Packed=T is the real "warehouse
  // is done" signal — anything still in Packing without packed=T is in
  // motion and shouldn't be invoiced yet.
  //
  // Total match is against SUM(ka9.selval_ka9) — the kaj-level shipment
  // value — NOT k80.relext_k80 (the full original order total). For
  // partial shipments, k80.relext spans multiple kaj rows and won't
  // equal a single shipment's invoice total. (Discovered 2026-04-29:
  // SPE2DS-26-V-4327 had kaj=351633 ($34.72, shipped 4/6) + kaj=353359
  // ($69.44, shipping now); k80.relext=$104.16 matched neither invoice.)
  const kajLookup = await pool.request().query(`
    SELECT TOP 5
      kaj.idnkaj_kaj, kaj.shpnum_kaj, kaj.shpsta_kaj, kaj.packed_kaj,
      k80.idnk80_k80, k80.relext_k80, k80.rlssta_k80,
      SUM(ka9.selval_ka9) AS kaj_total
    FROM k79_tab k79
    JOIN k80_tab k80 ON k80.idnk79_k80 = k79.idnk79_k79
    JOIN kaj_tab kaj ON kaj.idnk80_kaj = k80.idnk80_k80
    JOIN ka9_tab ka9 ON ka9.idnkaj_ka9 = kaj.idnkaj_kaj
    WHERE LTRIM(RTRIM(k79.cntrct_k79)) = '${contractNo.replace(/'/g, "''")}'
      AND LTRIM(RTRIM(kaj.shpsta_kaj)) IN ('Shipped', 'Packing')
      AND LTRIM(RTRIM(ISNULL(kaj.packed_kaj, ''))) = 'T'
    GROUP BY kaj.idnkaj_kaj, kaj.shpnum_kaj, kaj.shpsta_kaj, kaj.packed_kaj,
             k80.idnk80_k80, k80.relext_k80, k80.rlssta_k80, kaj.uptime_kaj
    HAVING ABS(SUM(ka9.selval_ka9) - ${total}) < 0.01
    ORDER BY kaj.uptime_kaj DESC
  `);
  // If single-kaj lookup failed, try multi-kaj: maybe the AX invoice covers
  // ALL unfinished shipments for this contract (sum of per-kaj totals =
  // invoice total). Common when AX invoices the full PO at completion of
  // the last partial. Discovered 2026-04-29: SPE2DP-26-P-0726 = $30.20 +
  // $120.80 = $151 across 2 kajs.
  let multiKajIds: number[] = [];
  if (kajLookup.recordset.length === 0) {
    const allKajs = await pool.request().query(`
      SELECT kaj.idnkaj_kaj, k80.idnk80_k80, SUM(ka9.selval_ka9) AS kaj_total
      FROM k79_tab k79
      JOIN k80_tab k80 ON k80.idnk79_k80 = k79.idnk79_k79
      JOIN kaj_tab kaj ON kaj.idnk80_kaj = k80.idnk80_k80
      JOIN ka9_tab ka9 ON ka9.idnkaj_ka9 = kaj.idnkaj_kaj
      WHERE LTRIM(RTRIM(k79.cntrct_k79)) = '${contractNo.replace(/'/g, "''")}'
        AND LTRIM(RTRIM(kaj.shpsta_kaj)) IN ('Shipped', 'Packing')
        AND LTRIM(RTRIM(ISNULL(kaj.packed_kaj, ''))) = 'T'
      GROUP BY kaj.idnkaj_kaj, k80.idnk80_k80
      ORDER BY kaj.idnkaj_kaj
    `);
    const sumAll = allKajs.recordset.reduce((s: number, r: any) => s + Number(r.kaj_total || 0), 0);
    if (allKajs.recordset.length >= 2 && Math.abs(sumAll - total) < 0.01) {
      multiKajIds = allKajs.recordset.map((r: any) => r.idnkaj_kaj as number);
      const k80Set = new Set(allKajs.recordset.map((r: any) => r.idnk80_k80));
      if (k80Set.size !== 1) {
        throw new Error(`multi-kaj invoice spans multiple k80 (${[...k80Set].join(",")}) — not yet supported`);
      }
      console.log(`  multi-kaj: invoice $${total} matches sum of ${multiKajIds.length} kajs [${multiKajIds.join(",")}]`);
      // Re-run the single-kaj-shaped lookup but for all of them
      const detail = await pool.request().query(`
        SELECT TOP 1 kaj.idnkaj_kaj, kaj.shpnum_kaj, kaj.shpsta_kaj, kaj.packed_kaj,
               k80.idnk80_k80, k80.relext_k80, k80.rlssta_k80
        FROM kaj_tab kaj
        JOIN k80_tab k80 ON k80.idnk80_k80 = kaj.idnk80_kaj
        WHERE kaj.idnkaj_kaj = ${multiKajIds[0]}
      `);
      kajLookup.recordset.push(detail.recordset[0]);
    }
  }
  if (kajLookup.recordset.length === 0) {
    throw new Error(`no shipped kaj found for contract '${contractNo}' total $${total}`);
  }
  if (kajLookup.recordset.length > 1) {
    throw new Error(`ambiguous: ${kajLookup.recordset.length} shipped kaj rows for contract '${contractNo}' total $${total} — need additional disambiguation field`);
  }
  const m = kajLookup.recordset[0];
  const idnkaj: number = m.idnkaj_kaj;
  const idnk80: number = m.idnk80_k80;
  // For multi-kaj, all the additional kajs to update (kaj.shpsta, k81 status,
  // ka9 link, kbr per-kaj) — primary kaj is idnkaj, additional are these.
  const additionalKajIds = multiKajIds.filter(id => id !== idnkaj);

  // Guard against the kbr UNIQUE (itttbl, idnitt, idnkap) constraint: if any
  // of the bundled kajs already has a WAWF 810 or 856 row, someone (probably
  // Abe manually) already transmitted it. Don't try to post a duplicate.
  const allKajIdsForCheck = [idnkaj, ...additionalKajIds];
  const existingTrans = await pool.request().query(`
    SELECT idnitt_kbr, idnkap_kbr, xtcsta_kbr FROM kbr_tab
    WHERE itttbl_kbr = 'kaj' AND idnitt_kbr IN (${allKajIdsForCheck.join(",")}) AND idnkap_kbr IN (24, 25)
  `);
  if (existingTrans.recordset.length > 0) {
    const types = existingTrans.recordset.map((r: any) => `kaj=${r.idnitt_kbr}:${r.idnkap_kbr}:${String(r.xtcsta_kbr).trim()}`).join(", ");
    throw new Error(`kaj(s) already have WAWF transmissions [${types}] — likely posted manually. Skip.`);
  }

  // 2. Resolve customer + cinnum + cinno
  const k31r = await pool.request().query(`
    SELECT TOP 1 idnk31_k31 FROM k31_tab
    WHERE LTRIM(RTRIM(a_code_k31)) = 'DD219' OR LTRIM(RTRIM(c_name_k31)) LIKE '%DD219%'
  `);
  const idnk31 = k31r.recordset[0]?.idnk31_k31 || 203;

  const axInvoice = String(row.ax_invoice_number || "").trim();
  const cinnum = axInvoice.replace(/^CIN/i, "").replace(/[^0-9A-Z]/gi, "");

  const lines: any[] = Array.isArray(row.ax_lines) ? row.ax_lines : [];
  if (lines.length === 0) throw new Error("no ax_lines");

  // 3. Multi-table transaction
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);

    // Atomically allocate cin_no via k07 CIN_NO counter (Global). LL's UI
    // does the same — without this, our cin_no would collide with LL's next
    // manual invoice. Lock the row for the rest of the txn so no one else
    // grabs the same number.
    const cinAlloc = await req.query(`
      UPDATE k07_tab WITH (UPDLOCK, ROWLOCK)
      SET ss_val_k07 = CAST(TRY_CAST(LTRIM(RTRIM(ss_val_k07)) AS BIGINT) + 1 AS VARCHAR(32)),
          uptime_k07 = GETDATE()
      OUTPUT deleted.ss_val_k07 AS prev_val, inserted.ss_val_k07 AS next_val
      WHERE LTRIM(RTRIM(ss_key_k07)) = 'CIN_NO' AND LTRIM(RTRIM(ss_tid_k07)) = 'G'
    `);
    if (cinAlloc.recordset.length === 0) {
      throw new Error("k07 CIN_NO counter not found — invoice writeback aborted to avoid collision");
    }
    // The OUTPUT gives us the value that's now reserved (the new ss_val).
    // Use that as our cin_no so we match LL's allocation pattern (it stores
    // the LATEST allocated, not next-free).
    const cinNo = Number(String(cinAlloc.recordset[0].next_val).trim());
    if (!Number.isFinite(cinNo) || cinNo <= 0) throw new Error(`invalid cin_no allocated: ${cinNo}`);

    const kadRes = await req.query(`
      INSERT INTO kad_tab (
        cinsta_kad, cinnum_kad, cin_no_kad, cindte_kad, cisdte_kad,
        upname_kad, uptime_kad, idnk31_kad, idnk06_kad,
        pinval_kad, xinval_kad, mslval_kad, nmsval_kad, ppcval_kad,
        cshval_kad, crmval_kad, otcval_kad, ar_val_kad, cinact_kad
      )
      OUTPUT inserted.idnkad_kad AS newId
      VALUES (
        'Posted         ', '${cinnum}', '${cinNo}', GETDATE(), GETDATE(),
        'ajoseph   ', GETDATE(), ${idnk31}, 1,
        0, 0, ${total}, 0, 0,
        0, 0, 0, ${total}, 1
      )
    `);
    const idnkad: number = kadRes.recordset[0].newId;

    const idnkaeIds: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      const desc = String(L.productDescription || L.productNumber || "").replace(/'/g, "''").slice(0, 40);
      const qty = Number(L.invoicedQuantity) || 0;
      const up = Number(L.salesPrice) || 0;
      const ext = Number(L.lineAmount) || (qty * up);
      const ui = String(L.uom || "EA").slice(0, 2);
      const kaeRes = await req.query(`
        INSERT INTO kae_tab (
          uptime_kae, upname_kae, idnkad_kae, cilcls_kae, cil_no_kae, cildes_kae,
          cilqty_kae, cil_up_kae, cil_ui_kae, cilext_kae, pinval_kae, xinval_kae
        )
        OUTPUT inserted.idnkae_kae AS newId
        VALUES (
          GETDATE(), 'ajoseph   ', ${idnkad}, 'Material  ', ${i + 1}, '${desc}',
          ${qty}, ${up}, '${ui}', ${ext}, 0, 0
        )
      `);
      idnkaeIds.push(kaeRes.recordset[0].newId);
    }

    // 4a. Flip kaj.shpsta from 'Packing' to 'Shipped' (idempotent if already
    // Shipped). Mirrors Abe's manual "click Shipped" UI step. Packing-state
    // shipments wouldn't transmit otherwise. For multi-kaj invoices, flip
    // ALL kajs in the bundle.
    const allKajIds = [idnkaj, ...additionalKajIds];
    await req.query(`
      UPDATE kaj_tab
      SET shpsta_kaj = 'Shipped', uptime_kaj = GETDATE()
      WHERE idnkaj_kaj IN (${allKajIds.join(",")})
        AND LTRIM(RTRIM(shpsta_kaj)) <> 'Shipped'
    `);

    // 4a.1. Link each ka9 (shipped-item job line) back to its matching kae
    // (invoice line) and flip ka9.jlnsta from 'Shipping' to 'Shipped'. THIS
    // is what drives the LL UI's "Shipped" label and "Invoice #" display
    // on the shipment screen — without this update, the row appears as
    // 'Shipping' with a blank invoice number even though kad+kae+kbr exist.
    //
    // We pair ka9 rows to kae rows by ORDER (jln_no_ka9 ASC ↔ cil_no_kae
    // ASC, both 1-based but with potentially different starting offsets).
    // ka9 rows for partial shipments may not start at jln_no=1: when LL
    // ships an order in two batches, the second kaj's ka9 row(s) continue
    // the global jln_no count from the first batch. We can't assume
    // jln_no = i+1. Filter for ka9 rows that haven't been linked to a kae
    // yet (idnkae_ka9 = 0) — those are the unspoken-for rows for this
    // shipment. Discovered 2026-04-29 on SPE2DS-26-V-4327's second partial.
    // For multi-kaj, link ka9 across all kajs. Each ka9 from each kaj gets
    // assigned to a kae round-robin (most invoices have 1 kae for many ka9
    // rows when multiple shipments invoice as one line). Single-kaj is the
    // common case where ka9 count == kae count.
    const ka9Rows = await req.query(`
      SELECT idnka9_ka9, idnkaj_ka9 FROM ka9_tab
      WHERE idnkaj_ka9 IN (${allKajIds.join(",")})
        AND (idnkae_ka9 IS NULL OR idnkae_ka9 = 0)
      ORDER BY idnkaj_ka9, jln_no_ka9
    `);
    if (ka9Rows.recordset.length < lines.length) {
      throw new Error(
        `kajs [${allKajIds.join(",")}] have ${ka9Rows.recordset.length} unlinked ka9 row(s) but invoice has ${lines.length} kae line(s) — cannot pair`
      );
    }
    // Map each ka9 to a kae. If 1 kae, all ka9 rows link to it. Otherwise
    // pair sequentially (1st ka9 → 1st kae, etc.).
    for (let i = 0; i < ka9Rows.recordset.length; i++) {
      const idnka9 = ka9Rows.recordset[i].idnka9_ka9;
      const kaeIdx = lines.length === 1 ? 0 : Math.min(i, lines.length - 1);
      const ur = await req.query(`
        UPDATE ka9_tab
        SET idnkae_ka9 = ${idnkaeIds[kaeIdx]},
            jlnsta_ka9 = 'Shipped',
            uptime_ka9 = GETDATE()
        WHERE idnka9_ka9 = ${idnka9}
      `);
      if ((ur.rowsAffected?.[0] || 0) !== 1) {
        throw new Error(`failed to link ka9=${idnka9} → kae=${idnkaeIds[kaeIdx]} (${ur.rowsAffected?.[0] || 0} rows affected)`);
      }
    }

    // 4b. UPDATE k80: release date + status='Closed' (matches Abe's flow).
    // k80_tab has no uptime_k80 — rlsdte_k80 IS the touched-time signal.
    await req.query(`
      UPDATE k80_tab
      SET rlsdte_k80 = GETDATE(), rlssta_k80 = 'Closed'
      WHERE idnk80_k80 = ${idnk80}
    `);

    // 4c. UPDATE k81 (award/CLIN level): flip shpsta_k81 'Shipping' → 'Shipped'
    // and stamp stadte_k81. The LL shipment screen reads its STATUS LABEL from
    // k81.shpsta_k81 (NOT kaj.shpsta_kaj). Without this, the checkbox flips
    // 'Shipped' but the status text still reads 'Shipping'. Discovered
    // 2026-04-28 while debugging CIN0066186. One k80 may have multiple k81
    // CLIN rows; flip them all.
    await req.query(`
      UPDATE k81_tab
      SET shpsta_k81 = 'Shipped', stadte_k81 = GETDATE()
      WHERE idnk80_k81 = ${idnk80}
        AND LTRIM(RTRIM(shpsta_k81)) = 'Shipping'
    `);

    // 5. INSERT 2 kbr rows for WAWF 810 + 856.
    // The 810 carries an EDI transaction control number (xtcscn_kbr) which
    // LL allocates from the k07 TRN_ID_CK5 counter (Global). The 856 stores
    // '0' for xtcscn (per observed LL behavior). Without atomic allocation
    // here we'd risk duplicate xtcscn collisions with other simultaneous
    // EDI transmissions on the box.
    const trnAlloc = await req.query(`
      UPDATE k07_tab WITH (UPDLOCK, ROWLOCK)
      SET ss_val_k07 = CAST(TRY_CAST(LTRIM(RTRIM(ss_val_k07)) AS BIGINT) + 1 AS VARCHAR(32)),
          uptime_k07 = GETDATE()
      OUTPUT deleted.ss_val_k07 AS prev_val, inserted.ss_val_k07 AS next_val
      WHERE LTRIM(RTRIM(ss_key_k07)) = 'TRN_ID_CK5' AND LTRIM(RTRIM(ss_tid_k07)) = 'G'
    `);
    if (trnAlloc.recordset.length === 0) {
      throw new Error("k07 TRN_ID_CK5 counter not found — invoice writeback aborted to avoid xtcscn collision");
    }
    // Use prev_val so we line up with LL's pattern: LL stores the most-recently-
    // allocated value in k07.ss_val (i.e. the value just used by the kbr we're
    // about to INSERT). Wait — LL's actual behavior is k07 holds NEXT-FREE pre-bump,
    // so we use prev_val for our xtcscn.
    const xtcscnFor810 = String(trnAlloc.recordset[0].prev_val).trim();

    // For multi-kaj, create kbr 810+856 per-kaj so each shipment's
    // transmission is recorded against its own kaj. Single-kaj reduces
    // to the original one-pair behavior.
    const idnkbrIds: number[] = [];
    for (const kbrKaj of allKajIds) {
      for (const kap of [24, 25]) {
        const xtcsta = kap === 24 ? "WAWF 810 sent  " : "WAWF 856 sent  ";
        // Only the primary kaj's 810 gets the trn_id sequence; others use 0
        const xtcscn = (kap === 24 && kbrKaj === idnkaj) ? xtcscnFor810 : "0";
        const kbrRes = await req.query(`
          INSERT INTO kbr_tab (
            addtme_kbr, addnme_kbr, itttbl_kbr, idnitt_kbr, idnkap_kbr,
            xtcscn_kbr, xtcsta_kbr, xtctme_kbr
          )
          OUTPUT inserted.idnkbr_kbr AS newId
          VALUES (
            GETDATE(), 'ajoseph   ', 'kaj', ${kbrKaj}, ${kap},
            '${xtcscn}', '${xtcsta}', GETDATE()
          )
        `);
        idnkbrIds.push(kbrRes.recordset[0].newId);
      }
    }

    // 6. Write k20 log entries for the WAWF transmissions. LL UI parses
    // these to show the invoice number against the shipment row. Without
    // k20 entries, the shipment screen's "Invoice #" field reads blank
    // even though kad+kbr are correctly populated.
    //
    // Observed format (from 2026-04-28 manual trace):
    //   810: "WAWF 810 for <contract>, invoice '<cinnum>, shipment <shpnum> has been uploaded to the Lamlinks Corp Server"
    //   856: "WAWF 856 for , invoice ', shipment  has been uploaded to the Lamlinks Corp Server"
    //   (the 856 has empty fields by LL's own design — match it)
    const shpnumQ = await req.query(`SELECT shpnum_kaj FROM kaj_tab WHERE idnkaj_kaj = ${idnkaj}`);
    const shpnum = String(shpnumQ.recordset[0]?.shpnum_kaj || "").trim();
    const log810 = `WAWF 810 for ${contractNo}, invoice '${cinnum}, shipment ${shpnum} has been uploaded to the Lamlinks Corp Server`;
    const log856 = `WAWF 856 for , invoice ', shipment  has been uploaded to the Lamlinks Corp Server`;
    for (const msg of [log810, log856]) {
      const safeMsg80 = msg.slice(0, 80).replace(/'/g, "''");
      const safeFull = msg.replace(/'/g, "''");
      await req.query(`
        INSERT INTO k20_tab (
          uptime_k20, upname_k20, susnam_k20, msgtno_k20, msgcls_k20,
          logmsg_k20, llptyp_k20, idnllp_k20, logtxt_k20
        )
        VALUES (
          GETDATE(), 'ajoseph   ', 'WAWF_edi_upload', 102, 'routine',
          '${safeMsg80}', '', 0, '${safeFull}'
        )
      `);
    }

    await tx.commit();
    return { idnkad, idnkaeIds, idnkbrIds, cinNo, kaj: idnkaj, trnId: parseInt(xtcscnFor810, 10) };
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

/**
 * After SQL writeback commits, build the .laz (DBF + FPT) and SFTP-upload
 * to sftp.lamlinks.com:/incoming. This is the step that actually transmits
 * EDI to gov side. Discovered via procmon 2026-04-29 — see
 * project_wawf_sftp_mechanism.md and docs/lamlinks-invoice-writeback.md.
 *
 * Per LL: 810 (invoice) goes first, then 856 (shipment notice) ~2 sec later.
 * For DD219 the data is identical between the two — the gov-side processor
 * differentiates by the kap=24 vs kap=25 already on the kbr rows we INSERTed.
 *
 * Returns filenames used (or "DRY RUN" markers) for audit.
 */
async function transmitWawfForKaj(
  pool: sql.ConnectionPool,
  kaj: number,
  invoiceResult: { idnkad: number; cinNo: number; trnId: number },
  dryRun: boolean,
): Promise<{ filename810: string; filename856: string }> {
  // Pull all the source data needed for the DBF
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
    WHERE kaj.idnkaj_kaj = ${kaj}
  `);
  if (r.recordset.length === 0) throw new Error(`transmitWawf: no source data for kaj=${kaj}`);
  const src = r.recordset[0];

  // NSN + PIDTXT from k08 (procurement description text — varies per item)
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

  // Pull all 7 party blocks for this kaj from ka7_tab via ka6 link
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
    WHERE LTRIM(RTRIM(ka6.gdutbl_ka6)) = 'kaj' AND ka6.idngdu_ka6 = ${kaj}
  `);
  const parties: Record<string, any> = {};
  // MIRR-block-qualifier → ck5 party letter
  const mirrToLetter: Array<[RegExp, string]> = [
    [/Block 9\b/i,  "B"], // Prime Contractor
    [/Block 10\b/i, "C"], // Administered By
    [/Block 11\b/i, "H"], // Shipped From
    [/Block 12\b/i, "J"], // Payment
    [/Block 13\b/i, "K"], // Shipped To
    [/Block 14\b/i, "M"], // Marked For
    [/Block 21\b/i, "N"], // Quality Assurance
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
  console.log(`  Pulled ${Object.keys(parties).length} party blocks from ka7 for kaj=${kaj}`);

  const invoiceData = {
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
    shp_ui: normalizeWawfUom(src.shp_ui),
    shpext: parseFloat(src.shpext),
    shptme: src.shptme ? new Date(src.shptme) : new Date(),
    shpnum: src.shpnum,
    shpped: "",
    packed: src.packed || "T",
    cinval: parseFloat(src.cinval),
    insdte: src.insdte ? new Date(src.insdte) : new Date(),
    trn_id: invoiceResult.trnId,
    parties,
  };

  // Build TWO different DBF + FPT pairs — 810 (Commercial Invoice) and 856
  // (Advance Ship Notice). They share most fields but the 856 has an extra
  // 12 packaging fields and a different form-type code embedded at byte
  // offset 1134 ("10" → "56"). Reverse-engineered 2026-04-29 by diffing
  // captured ref-810.laz vs ref-856.laz from Abe's manual Post.
  const ck810 = buildCk5Dbf(invoiceData, WAWF_TEMPLATE_DIR, 810);
  const ck856 = buildCk5Dbf(invoiceData, WAWF_TEMPLATE_DIR, 856);

  // Upload twice (810 then 856) with proper distinct content
  const filename810 = buildLazFilename();
  await new Promise(r => setTimeout(r, 50)); // sequential timestamps
  const filename856 = buildLazFilename();

  if (dryRun) {
    console.log(`  [DRY RUN] Would upload ${filename810} (810, ${ck810.dbf.length}b) + ${filename856} (856, ${ck856.dbf.length}b) to /incoming/`);
    return { filename810: `${filename810} (DRY RUN)`, filename856: `${filename856} (DRY RUN)` };
  }

  console.log(`  Uploading 810: ${filename810} (${ck810.dbf.length + ck810.fpt.length} bytes pre-zip)`);
  const r1 = await uploadLaz({ dbf: ck810.dbf, fpt: ck810.fpt }, { filename: filename810 });
  console.log(`  ✓ 810 uploaded: ${r1.remote} (${r1.bytes} bytes zipped)`);
  console.log(`  Uploading 856: ${filename856} (${ck856.dbf.length + ck856.fpt.length} bytes pre-zip)`);
  const r2 = await uploadLaz({ dbf: ck856.dbf, fpt: ck856.fpt }, { filename: filename856 });
  console.log(`  ✓ 856 uploaded: ${r2.remote} (${r2.bytes} bytes zipped)`);

  return { filename810, filename856 };
}

async function main() {
  const loop = process.argv.includes("--loop");
  if (!loop) {
    const s = await processOnePass();
    console.log(`Result: processed=${s.processed}, failed=${s.failed}, waiting=${s.waiting}`);
    // Also process rescue actions on the single pass.
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });
    const rescueDone = await processRescueActions(pool, supabase);
    if (rescueDone > 0) console.log(`Rescue actions processed: ${rescueDone}`);
    await pool.close();
    return;
  }
  console.log(`Starting loop mode (poll every ${POLL_INTERVAL_MS / 1000}s). Ctrl-C to stop.`);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  while (true) {
    try { await processOnePass(); } catch (e: any) { console.error(`pass error: ${e.message}`); }
    try {
      const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });
      await processRescueActions(pool, supabase);
      await pool.close();
    } catch (e: any) { console.error(`rescue pass error: ${e.message}`); }
    try { await processInvoiceQueue(); } catch (e: any) { console.error(`invoice pass error: ${e.message}`); }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
