/**
 * Import solicitations from LamLinks SQL Server → Supabase.
 *
 * Pulls recent solicitations (last 30 days) from k10→k11→k08 join,
 * plus competitive intel from k34/k35 (who bid, at what price).
 *
 * Run locally (requires Windows Auth to NYEVRVSQL001):
 *   npx tsx scripts/import-lamlinks-solicitations.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== LamLinks Solicitation Import ===");
  console.log(`Started: ${new Date().toISOString()}\n`);

  const pool = await sql.connect(config);

  // 1. Pull recent solicitations (last 30 days) with item details
  console.log("Step 1: Querying solicitations from LamLinks...");
  const solResult = await pool.request().query(`
    SELECT
      k10.sol_no_k10   AS solicitation_number,
      k10.isudte_k10   AS issue_date,
      k10.closes_k10   AS return_by_date,
      k10.saside_k10   AS set_aside,
      k10.sol_ti_k10   AS posting_type,      -- T auto / Q manual
      k10.b_name_k10   AS buyer_name,
      k10.buyeml_k10   AS buyer_email,
      k10.b_phon_k10   AS buyer_phone,
      k10.cntpri_k10   AS priority_code,
      k08.fsc_k08      AS fsc,
      k08.niin_k08     AS niin,
      k08.p_desc_k08   AS nomenclature,
      k08.partno_k08   AS part_number,
      k08.p_cage_k08   AS mfr_cage,
      k08.weight_k08   AS item_weight,
      k11.idnk11_k11   AS idnk11,             -- for k32 ship-to join in pass 2
      k11.solqty_k11   AS quantity,
      k11.closes_k11   AS line_close_date,
      k34.fobcod_k34   AS fob_code,
      k34.bidtyp_k34   AS bid_type,
      -- File-reference batch metadata.
      k09.ref_no_k09   AS file_reference,
      k09.refdte_k09   AS file_reference_date,
      k09.ourref_k09   AS internal_edi_reference
    FROM k10_tab k10
    JOIN k11_tab k11 ON k11.idnk10_k11 = k10.idnk10_k10
    JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
    LEFT JOIN k09_tab k09 ON k09.idnk09_k09 = k11.idnk09_k11
    LEFT JOIN k34_tab k34 ON k34.idnk11_k34 = k11.idnk11_k11
      AND k34.scage_k34 = '0AG09'
    WHERE k10.closes_k10 >= CAST(GETDATE() AS DATE)
      AND k10.sol_no_k10 IS NOT NULL
      AND k08.fsc_k08 IS NOT NULL
      AND k08.niin_k08 IS NOT NULL
    ORDER BY k10.closes_k10 DESC
  `);

  const rawSols = solResult.recordset;
  console.log(`  Found ${rawSols.length} raw line items`);

  // Pull k32 ship-to rows for every k11 we just loaded — one query batched
  // by IN-list chunks of 500. Each k32 row is one destination+qty+delivery.
  console.log("\nPulling ship-to locations (k32_tab)...");
  const shipToByK11 = new Map<number, any[]>();
  const idnk11List = [...new Set(rawSols.map((r: any) => r.idnk11).filter(Boolean))] as number[];
  for (let i = 0; i < idnk11List.length; i += 500) {
    const batch = idnk11List.slice(i, i + 500);
    const placeholders = batch.map((_, j) => `@k${j}`).join(",");
    const req = pool.request();
    batch.forEach((id, j) => req.input(`k${j}`, sql.Int, id));
    const q = await req.query(`
      SELECT idnk11_k32, itemno_k32, shptol_k32, qty_k32, dlydte_k32
      FROM k32_tab WHERE idnk11_k32 IN (${placeholders})
    `);
    for (const r of q.recordset) {
      const k11 = r.idnk11_k32;
      if (!shipToByK11.has(k11)) shipToByK11.set(k11, []);
      shipToByK11.get(k11)!.push({
        clin: String(r.itemno_k32 || "").trim() || null,
        destination: String(r.shptol_k32 || "").trim() || null,
        qty: Number(r.qty_k32) || 0,
        delivery_date: r.dlydte_k32 ? new Date(r.dlydte_k32).toISOString().slice(0, 10) : null,
      });
    }
  }
  console.log(`  ${shipToByK11.size.toLocaleString()} k11 rows with ship-to, ${[...shipToByK11.values()].reduce((s, v) => s + v.length, 0).toLocaleString()} total destinations`);

  // 2. Deduplicate by solicitation_number + NSN
  const seen = new Set<string>();
  const solicitations: any[] = [];
  for (const r of rawSols) {
    const nsn = `${r.fsc?.trim()}-${r.niin?.trim()}`;
    const key = `${r.solicitation_number?.trim()}_${nsn}`;
    if (seen.has(key) || !r.solicitation_number?.trim() || !r.fsc?.trim()) continue;
    seen.add(key);

    // Format dates to MM-DD-YYYY (DIBBS format)
    const fmtDate = (d: Date | string | null) => {
      if (!d) return null;
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return null;
      return `${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}-${dt.getFullYear()}`;
    };

    // ISO date for file_reference_date so Supabase's DATE column accepts it
    const isoDate = (d: Date | string | null) => {
      if (!d) return null;
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return null;
      return dt.toISOString().slice(0, 10);
    };

    // Ship-to locations for this k11 (empty array when there are none —
    // we still store `[]` so the UI doesn't confuse "not imported yet" with
    // "has no destinations").
    const ship = shipToByK11.get(r.idnk11) || [];

    // Required delivery days: minimum delivery date across destinations,
    // measured from solicitation issue date. Per-destination dates differ
    // (some military sites want rush; others have 90-day windows), so we
    // use the earliest as "what's the tightest commitment we need to meet
    // if we win." Abe can override per bid.
    let requiredDeliveryDays: number | null = null;
    if (ship.length > 0 && r.issue_date) {
      const issueMs = new Date(r.issue_date).getTime();
      const earliest = ship
        .map((s: any) => s.delivery_date ? new Date(s.delivery_date).getTime() : null)
        .filter((t: any) => t !== null) as number[];
      if (earliest.length > 0) {
        const minMs = Math.min(...earliest);
        requiredDeliveryDays = Math.max(1, Math.round((minMs - issueMs) / 86400000));
      }
    }

    const postingType = String(r.posting_type || "").trim().toUpperCase().charAt(0) || null;

    solicitations.push({
      solicitation_number: r.solicitation_number.trim(),
      nsn,
      nomenclature: r.nomenclature?.trim() || "",
      fsc: r.fsc.trim(),
      quantity: r.quantity || 1,
      issue_date: fmtDate(r.issue_date) || "",
      return_by_date: fmtDate(r.return_by_date) || fmtDate(r.line_close_date) || "",
      set_aside: r.set_aside?.trim() || "None",
      data_source: "lamlinks",
      imported_at: new Date().toISOString(),
      scraped_at: new Date().toISOString(),
      file_reference: r.file_reference?.trim() || null,
      file_reference_date: isoDate(r.file_reference_date),
      internal_edi_reference: r.internal_edi_reference?.trim() || null,
      ship_to_locations: ship,
      buyer_name: r.buyer_name?.trim() || null,
      buyer_email: r.buyer_email?.trim() || null,
      buyer_phone: r.buyer_phone?.trim() || null,
      priority_code: r.priority_code?.trim() || null,
      posting_type: postingType,
      required_delivery_days: requiredDeliveryDays,
    });
  }
  console.log(`  Deduplicated: ${solicitations.length} unique solicitations`);

  // 3. Pull competitive intel — who else bid on these items recently
  console.log("\nStep 2: Pulling competitive intel (recent bids by CAGE)...");
  const competitorResult = await pool.request().query(`
    SELECT TOP 50000
      k10.sol_no_k10   AS solicitation_number,
      k08.fsc_k08 + '-' + k08.niin_k08 AS nsn,
      k34.mcage_k34    AS competitor_cage,
      k35.up_k35       AS bid_price,
      k35.qty_k35      AS bid_qty,
      k34.uptime_k34   AS bid_date
    FROM k34_tab k34
    JOIN k35_tab k35 ON k35.idnk34_k35 = k34.idnk34_k34
    JOIN k11_tab k11 ON k11.idnk11_k11 = k34.idnk11_k34
    JOIN k10_tab k10 ON k10.idnk10_k10 = k11.idnk10_k11
    JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
    WHERE k34.uptime_k34 >= DATEADD(day, -90, GETDATE())
      AND k34.scage_k34 != '0AG09'
      AND k34.mcage_k34 IS NOT NULL
    ORDER BY k34.uptime_k34 DESC
  `);
  console.log(`  Found ${competitorResult.recordset.length} competitor bids`);

  // Build competitor lookup by NSN
  const competitorsByNsn = new Map<string, Set<string>>();
  for (const r of competitorResult.recordset) {
    const nsn = r.nsn?.trim();
    if (!nsn || !r.competitor_cage?.trim()) continue;
    if (!competitorsByNsn.has(nsn)) competitorsByNsn.set(nsn, new Set());
    competitorsByNsn.get(nsn)!.add(r.competitor_cage.trim());
  }

  // 4. Get active FSCs from LamLinks (for telling DIBBS scrape what to skip)
  const fscResult = await pool.request().query(`
    SELECT DISTINCT k08.fsc_k08 AS fsc
    FROM k10_tab k10
    JOIN k11_tab k11 ON k11.idnk10_k11 = k10.idnk10_k10
    JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
    WHERE k10.closes_k10 >= DATEADD(day, -30, GETDATE())
  `);
  const llFscs = fscResult.recordset.map((r: any) => r.fsc?.trim()).filter(Boolean);
  console.log(`  LamLinks covers ${llFscs.length} active FSCs`);

  await pool.close();

  // 5. Save to Supabase
  console.log(`\nStep 3: Saving ${solicitations.length} solicitations to Supabase...`);
  let saved = 0, skipped = 0;

  for (let i = 0; i < solicitations.length; i += 100) {
    const batch = solicitations.slice(i, i + 100).map((s: any) => {
      const competitors = competitorsByNsn.get(s.nsn);
      return {
        ...s,
        competitor_cage: competitors ? Array.from(competitors).slice(0, 5).join(",") : null,
        award_count: competitors?.size || 0,
      };
    });

    const { error } = await sb
      .from("dibbs_solicitations")
      .upsert(batch, { onConflict: "solicitation_number,nsn", ignoreDuplicates: false });

    if (error) {
      console.error(`  Batch error: ${error.message}`);
      skipped += batch.length;
    } else {
      saved += batch.length;
    }
  }

  // 6. Save the FSC list so DIBBS scrape knows what to skip
  const { error: fscError } = await sb
    .from("sync_log")
    .insert({
      action: "lamlinks_import",
      details: {
        solicitations: solicitations.length,
        saved,
        skipped,
        active_fscs: llFscs,
        competitor_nsns: competitorsByNsn.size,
      },
    });

  if (fscError) console.error("  Sync log error:", fscError.message);

  console.log(`\nDone! ${saved} saved, ${skipped} errors`);
  console.log(`Active LamLinks FSCs: ${llFscs.join(", ")}`);
  console.log(`Competitor intel on ${competitorsByNsn.size} NSNs`);

  // Auto-trigger enrichment so the new rows actually get NSN-matched
  // and priced. Each enrich call processes up to 5K unsourced rows
  // (Railway 30s timeout). Loop until the backlog drains, max 8 calls
  // (40K rows) so the script doesn't spin forever.
  const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "https://dibs-gov-production.up.railway.app";
  console.log(`\nChaining enrichment at ${RAILWAY_URL}/api/dibbs/enrich until backlog drains ...`);

  // Fetch the MDB NSN set ONCE here and pass it to every chained
  // enrich call. Eliminates 29 redundant MDB roundtrips per morning.
  let mdbNsns: string[] = [];
  try {
    const KEY = process.env.MASTERDB_API_KEY;
    if (KEY) {
      const resp = await fetch(
        "https://masterdb.everreadygroup.com/api/dibs/items/export?has_nsn=1",
        { headers: { "X-Api-Key": KEY }, signal: AbortSignal.timeout(30000) }
      );
      if (resp.ok) {
        const text = await resp.text();
        for (const line of text.split("\n")) {
          try {
            const item = JSON.parse(line);
            if (item.nsn) mdbNsns.push(item.nsn);
          } catch {}
        }
        console.log(`  fetched ${mdbNsns.length} MDB NSNs once — will pass to each enrich call`);
      } else {
        console.warn(`  MDB fetch HTTP ${resp.status} — falling back to per-call fetch`);
      }
    }
  } catch (e: any) {
    console.warn(`  MDB fetch error: ${e?.message || "unknown"} — falling back to per-call fetch`);
  }
  const enrichBody = mdbNsns.length > 0 ? JSON.stringify({ mdbNsns }) : undefined;

  let totalSourceable = 0;
  let totalChecked = 0;
  let totalCost = 0;
  // Allow up to 30 calls (60K rows of headroom). Each call processes up
  // to 2K rows in <30s. Tiny delay between calls so Railway doesn't see
  // them as a thundering herd.
  for (let i = 0; i < 30; i++) {
    let body: any = {};
    let succeeded = false;
    // Single retry on 502/504 — usually Railway cold-start or transient
    for (let attempt = 0; attempt < 2 && !succeeded; attempt++) {
      try {
        const resp = await fetch(`${RAILWAY_URL}/api/dibbs/enrich`, {
          method: "POST",
          headers: enrichBody ? { "Content-Type": "application/json" } : undefined,
          body: enrichBody,
        });
        body = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          if (attempt === 0 && (resp.status === 502 || resp.status === 504)) {
            console.warn(`  call ${i + 1} attempt 1: HTTP ${resp.status}, retrying in 5s ...`);
            await new Promise((r) => setTimeout(r, 5000));
            continue;
          }
          console.warn(`  call ${i + 1}: HTTP ${resp.status}: ${JSON.stringify(body).slice(0, 200)}`);
          break;
        }
        succeeded = true;
      } catch (e: any) {
        console.warn(`  call ${i + 1} fetch error: ${e?.message || "unknown"}`);
        break;
      }
    }
    if (!succeeded) break;
    totalSourceable += body.sourceable || 0;
    totalChecked += body.total_checked || 0;
    totalCost += body.with_cost_data || 0;
    const remaining = body.remaining_unsourced || 0;
    console.log(`  call ${i + 1}: ${body.sourceable || 0} new sourceable of ${body.total_checked || 0} checked, ${remaining} unsourced left`);
    if (body.warnings?.length) console.warn(`    warnings: ${body.warnings.join(", ")}`);
    if (remaining === 0 || (body.total_checked || 0) === 0) break;
    // pause briefly so Railway has room to breathe between calls
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(`Enrich totals: ${totalSourceable} marked sourceable across ${totalChecked} rows checked (${totalCost} got cost data)`);
}

main().catch(console.error);
