/**
 * Import solicitations from LamLinks SQL Server → Supabase.
 *
 * Pulls recent solicitations (last 30 days) from k10→k11→k08 join,
 * plus competitive intel from k34/k35 (who bid, at what price).
 *
 * Run locally (requires Windows Auth to NYEVRVSQL001):
 *   npx tsx scripts/import-lamlinks-solicitations.ts
 */
import "dotenv/config";
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
      k08.fsc_k08      AS fsc,
      k08.niin_k08     AS niin,
      k08.p_desc_k08   AS nomenclature,
      k08.partno_k08   AS part_number,
      k08.p_cage_k08   AS mfr_cage,
      k08.weight_k08   AS item_weight,
      k11.solqty_k11   AS quantity,
      k11.closes_k11   AS line_close_date,
      k34.fobcod_k34   AS fob_code,
      k34.bidtyp_k34   AS bid_type
    FROM k10_tab k10
    JOIN k11_tab k11 ON k11.idnk10_k11 = k10.idnk10_k10
    JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
    LEFT JOIN k34_tab k34 ON k34.idnk11_k34 = k11.idnk11_k11
      AND k34.scage_k34 = '0AG09'
    WHERE k10.closes_k10 >= DATEADD(day, -30, GETDATE())
      AND k10.sol_no_k10 IS NOT NULL
      AND k08.fsc_k08 IS NOT NULL
      AND k08.niin_k08 IS NOT NULL
    ORDER BY k10.closes_k10 DESC
  `);

  const rawSols = solResult.recordset;
  console.log(`  Found ${rawSols.length} raw line items`);

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
}

main().catch(console.error);
