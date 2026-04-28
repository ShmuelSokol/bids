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

async function createFreshEnvelope(pool: sql.ConnectionPool, templateK34: number): Promise<number> {
  // Mint a brand-new k33 staging envelope. Uses kdy_tab to allocate idnk33,
  // then inserts a k33 row with the same status-string shape LamLinks' own
  // client uses (o_stat/a_stat/s_stat='adding quotes', t_stat='not sent',
  // a_stat='not acknowledged'). itmcnt starts at 0; the regular append flow
  // will bump it as each k34 line is added.
  //
  // Runs in its own transaction so it's atomic even if the broader worker
  // loop blows up afterward.
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);
    const k33Alloc = await req.query(`
      DECLARE @newId INT;
      UPDATE kdy_tab WITH (ROWLOCK, HOLDLOCK)
      SET idnval_kdy = idnval_kdy + 1, @newId = idnval_kdy + 1
      WHERE tabnam_kdy = 'k33_tab';
      SELECT @newId AS id;
    `);
    const newK33: number = k33Alloc.recordset[0].id;
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
    return newK33;
  } catch (e) {
    try { await tx.rollback(); } catch {}
    throw e;
  }
}

async function resolveTarget(pool: sql.ConnectionPool, sol: string, nsn: string) {
  // NSN stored with dashes in LamLinks (01-578-7887 not 015787887), take everything after the FSC
  const niin = nsn.replace(/^\d{4}-/, "");
  const r = await pool.request().query(`
    SELECT k11.idnk11_k11, k11.solqty_k11, k11.sol_um_k11, k08.partno_k08, k08.p_cage_k08
    FROM k11_tab k11
    INNER JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
    INNER JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
    WHERE k10.sol_no_k10 = '${sol.replace(/'/g, "''")}' AND k08.niin_k08 = '${niin.replace(/'/g, "''")}'
  `);
  if (r.recordset.length === 0) return null;
  const row = r.recordset[0];
  return {
    idnk11: row.idnk11_k11 as number,
    solqty: row.solqty_k11 as number,
    uom: String(row.sol_um_k11 || "").trim() || "EA",
    mfrPn: String(row.partno_k08 || "").trim(),
    mfrCage: String(row.p_cage_k08 || "").trim(),
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
    const newK34: number = k34Alloc.recordset[0].id;
    const newK35: number = k35Alloc.recordset[0].id;
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
    return { idnk34: newK34, idnk35: newK35 };
  } catch (e) {
    try { await tx.rollback(); } catch {}
    throw e;
  }
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
        await supabase
          .from("lamlinks_write_queue")
          .update({
            status: "done",
            processed_at: new Date().toISOString(),
            envelope_idnk33: envelope.idnk33,
            line_idnk34: result.idnk34,
            price_idnk35: result.idnk35,
          })
          .eq("id", row.id);
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

    // Finalize the envelope: flip o_stat_k33 from 'adding quotes' to
    // 'quotes added' so LL's transmit daemon actually picks it up and
    // ships the bids to DLA. Without this, the envelope sat half-built
    // forever (the 2026-04-24 shipping outage). Only flip envelopes we
    // created in this pass — Abe's own in-progress envelopes are his to
    // Post. Skip if zero bids landed (nothing worth shipping).
    if (weCreatedEnvelope && processed > 0) {
      try {
        await pool.request().query(`
          UPDATE k33_tab
          SET o_stat_k33 = 'quotes added', s_stat_k33 = 'quotes added', uptime_k33 = GETDATE()
          WHERE idnk33_k33 = ${envelope.idnk33}
            AND LTRIM(RTRIM(o_stat_k33)) = 'adding quotes'
        `);
        console.log(`  ✓ finalized envelope ${envelope.idnk33} → 'quotes added' (daemon will ship ${processed} bids)`);
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
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
