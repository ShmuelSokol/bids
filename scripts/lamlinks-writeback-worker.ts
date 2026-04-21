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
// - Uses MAX+30 for idnk34/idnk35 (guards against Abe's client-side counter)
// - Wraps each insert in a TABLOCKX+HOLDLOCK transaction
// - Marks 'done' with k33/k34/k35 ids on success; 'failed' with error on errors

import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

const ID_GAP = 30;                 // MAX+30 to stay ahead of Abe's client counter
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

    // Pick ids with a 30-gap cushion over MAX to stay ahead of Abe's client-side counter
    const l34 = await req.query(`SELECT ISNULL(MAX(idnk34_k34),0) AS m FROM k34_tab WITH (TABLOCKX, HOLDLOCK)`);
    const l35 = await req.query(`SELECT ISNULL(MAX(idnk35_k35),0) AS m FROM k35_tab WITH (TABLOCKX, HOLDLOCK)`);
    const newK34 = l34.recordset[0].m + ID_GAP;
    const newK35 = l35.recordset[0].m + ID_GAP;

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

async function processOnePass(): Promise<{ processed: number; failed: number; waiting: number }> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
    const envelope = await findStagedEnvelope(pool);
    if (!envelope) {
      console.log(`  no staged envelope for ajoseph — waiting for him to save a seed line`);
      waiting = queue.length;
      return { processed, failed, waiting };
    }
    console.log(`  piggybacking into envelope ${envelope.idnk33}, template k34=${envelope.templateK34}`);

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
  } finally {
    await pool.close();
  }

  return { processed, failed, waiting };
}

async function main() {
  const loop = process.argv.includes("--loop");
  if (!loop) {
    const s = await processOnePass();
    console.log(`Result: processed=${s.processed}, failed=${s.failed}, waiting=${s.waiting}`);
    return;
  }
  console.log(`Starting loop mode (poll every ${POLL_INTERVAL_MS / 1000}s). Ctrl-C to stop.`);
  while (true) {
    try { await processOnePass(); } catch (e: any) { console.error(`pass error: ${e.message}`); }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
