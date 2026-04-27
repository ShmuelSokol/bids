/**
 * Pull recent LL history (awards + Abe's bids) for a specific NSN and
 * upsert into Supabase (awards + abe_bids tables). Use when the DIBS
 * solicitation modal shows empty history but Abe says LL has it —
 * usually means our nightly sync didn't cover the NSN (e.g., international
 * FSCs like 6665-12-... were missed).
 *
 *   npx tsx scripts/refresh-ll-history-for-nsn.ts --nsn 6665-12-193-2113
 *
 * Queries llk_db1 directly (requires msnodesqlv8) — only runs on boxes
 * with the mapped LL SQL server, i.e. NYEVRVSQL001 or Shmuel's dev box.
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const nsnIdx = process.argv.indexOf("--nsn");
  if (nsnIdx < 0) { console.error("Usage: --nsn <NSN like 6665-12-193-2113>"); process.exit(1); }
  const nsn = process.argv[nsnIdx + 1];
  const [fsc, ...niinParts] = nsn.split("-");
  const niin = niinParts.join("-");

  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Pull awards (k81 joined to k11/k08) — last 5 years
  const awards = await pool.request().query(`
    SELECT
      k81.addtme_k81 AS award_date,
      k81.pr_num_k81 AS pr_num,
      k81.ordrno_k81 AS contract_number,
      k81.cln_up_k81 AS unit_price,
      k81.clnqty_k81 AS quantity,
      k81.cln_ui_k81 AS uom,
      k08.niin_k08 AS niin,
      k08.fsc_k08 AS fsc
    FROM k81_tab k81
    INNER JOIN k11_tab k11 ON k81.idnk71_k81 = k11.idnk09_k11
    INNER JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
    WHERE k08.niin_k08 = '${niin.replace(/'/g, "''")}'
      AND k08.fsc_k08 = '${fsc.replace(/'/g, "''")}'
      AND k81.addtme_k81 >= DATEADD(YEAR, -5, GETDATE())
    ORDER BY k81.addtme_k81 DESC
  `);

  // Pull Abe's bids via our_quote_line_5_view (single denormalized join,
  // includes t_stat_k33 + kc4 award linkage for free).
  // Discovered 2026-04-27 via XE trace mining; replaces hand-rolled k34/k35/k11/k08/k10 join.
  const bids = await pool.request().query(`
    SELECT
      uptime_k34 AS bid_time,
      sol_no_k10 AS solicitation_number,
      qty_k35 AS bid_qty,
      up_k35 AS bid_price,
      daro_k35 AS lead_days,
      pn_k34 AS part_number,
      mcage_k34 AS mfr_cage,
      t_stat_k33 AS transmit_status,
      idnkc4_kc4 AS award_kc4
    FROM our_quote_line_5_view
    WHERE niin_k08 = '${niin.replace(/'/g, "''")}'
      AND fsc_k08 = '${fsc.replace(/'/g, "''")}'
      AND UPPER(LTRIM(RTRIM(upname_k34))) = 'AJOSEPH'
      AND uptime_k34 >= DATEADD(YEAR, -5, GETDATE())
    ORDER BY uptime_k34 DESC
  `);

  console.log(`LL: ${awards.recordset.length} awards, ${bids.recordset.length} Abe bids for NSN ${nsn}`);

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Schema:
  //   awards   -> fsc, niin, award_date, piid (contract), unit_price, quantity
  //               (no 'nsn' column; fsc+niin is the key)
  //   abe_bids -> nsn, solicitation_number, bid_date, bid_price, bid_qty, lead_time_days
  const awardRows = awards.recordset.map((a: any) => ({
    fsc,
    niin,
    award_date: a.award_date,
    piid: String(a.contract_number || "").trim(),
    unit_price: Number(a.unit_price || 0),
    quantity: Number(a.quantity || 0),
  }));
  // Pre-dedup: query existing piids for this NSN and skip them.
  const { data: existingAwards } = await sb.from("awards").select("piid").eq("fsc", fsc).eq("niin", niin);
  const existingSet = new Set((existingAwards || []).map((r: any) => String(r.piid || "").trim()));
  const newAwards = awardRows.filter((a) => a.piid && !existingSet.has(a.piid));
  let insertedAwards = 0;
  for (let i = 0; i < newAwards.length; i += 500) {
    const chunk = newAwards.slice(i, i + 500);
    const { error } = await sb.from("awards").insert(chunk);
    if (error) { console.error("awards insert error:", error.message); break; }
    insertedAwards += chunk.length;
  }
  console.log(`  awards: ${awardRows.length} in LL, ${existingSet.size} already in Supabase, ${newAwards.length} newly inserted`);

  const toIso = (v: any) => {
    if (!v) return null;
    try { return new Date(v).toISOString().slice(0, 10); } catch { return null; }
  };
  const bidRows = bids.recordset.map((b: any) => ({
    nsn,
    solicitation_number: String(b.solicitation_number || "").trim(),
    bid_date: toIso(b.bid_time),
    bid_price: Number(b.bid_price || 0),
    bid_qty: Number(b.bid_qty || 0),
    lead_time_days: Number(b.lead_days || 0),
  }));
  // Pre-dedup bids by (nsn, solicitation_number) — that's the unique index shape.
  const { data: existingBids } = await sb.from("abe_bids").select("solicitation_number").eq("nsn", nsn);
  const existingBidSet = new Set((existingBids || []).map((r: any) => String(r.solicitation_number || "").trim()));
  // Also dedup within the batch — Abe may have bid the same sol twice (revisions),
  // and LL keeps both; we only keep the latest bid_date per sol.
  const batchDedup = new Map<string, any>();
  for (const b of bidRows) {
    if (!b.solicitation_number || existingBidSet.has(b.solicitation_number)) continue;
    const prior = batchDedup.get(b.solicitation_number);
    if (!prior || (b.bid_date || "") > (prior.bid_date || "")) batchDedup.set(b.solicitation_number, b);
  }
  const newBids = [...batchDedup.values()];
  let insertedBids = 0;
  for (let i = 0; i < newBids.length; i += 500) {
    const chunk = newBids.slice(i, i + 500);
    const { error } = await sb.from("abe_bids").insert(chunk);
    if (error) { console.error("abe_bids insert error:", error.message); break; }
    insertedBids += chunk.length;
  }
  console.log(`  bids: ${bidRows.length} in LL, ${existingBidSet.size} already in Supabase, ${newBids.length} newly inserted`);

  console.log(`✓ Upserted ${insertedAwards} awards, ${insertedBids} bids into Supabase for NSN ${nsn}`);
  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
