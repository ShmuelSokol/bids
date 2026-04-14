/**
 * Import OUR awards from LamLinks k81 → Supabase awards table.
 * These are contracts WE won (CAGE 0AG09), not public USASpending data.
 *
 * Run locally: npx tsx scripts/import-lamlinks-awards.ts
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
  console.log("=== LamLinks Award Import (Our Wins) ===\n");

  const pool = await sql.connect(config);

  // Pull our awards from k81 → k80 → k79 → k08
  const result = await pool.request().query(`
    SELECT
      k79.cntrct_k79   AS contract_number,
      k81.clinno_k81   AS clin,
      k81.cln_up_k81   AS unit_price,
      k81.clnqty_k81   AS quantity,
      k81.cln_ui_k81   AS unit_of_measure,
      k81.fob_od_k81   AS fob,
      k81.shpsta_k81   AS ship_status,
      k81.addtme_k81   AS award_date,
      k81.reqdly_k81   AS required_delivery,
      k08.fsc_k08      AS fsc,
      k08.niin_k08     AS niin,
      k08.p_desc_k08   AS description,
      k08.partno_k08   AS part_number,
      k08.p_cage_k08   AS mfr_cage
    FROM k81_tab k81
    JOIN k80_tab k80 ON k80.idnk80_k80 = k81.idnk80_k81
    JOIN k79_tab k79 ON k79.idnk79_k79 = k80.idnk79_k80
    LEFT JOIN k11_tab k11 ON k11.idnk11_k11 = k81.idnk71_k81
    LEFT JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
    WHERE k81.addtme_k81 >= DATEADD(year, -2, GETDATE())
      AND k08.fsc_k08 IS NOT NULL
    ORDER BY k81.addtme_k81 DESC
  `);

  const rawAwards = result.recordset;
  console.log(`Found ${rawAwards.length} awards from LamLinks (last 2 years)\n`);

  await pool.close();

  // Transform and deduplicate
  const awards = rawAwards.map((r: any) => ({
    fsc: r.fsc?.trim() || "",
    niin: r.niin?.trim() || "",
    description: r.description?.trim() || "",
    unit_price: r.unit_price || 0,
    quantity: r.quantity || 0,
    award_date: r.award_date ? new Date(r.award_date).toISOString() : null,
    contract_number: r.contract_number?.trim() || "",
    cage: "0AG09", // These are ALL our awards
    fob: r.fob?.trim() || null,
    order_number: r.clin?.trim() || null,
    data_source: "lamlinks_k81",
  })).filter((a: any) => a.fsc && a.niin && a.unit_price > 0);

  console.log(`After filtering: ${awards.length} valid awards`);

  // Upsert to Supabase (use contract_number + fsc + niin as dedup key)
  let saved = 0;
  for (let i = 0; i < awards.length; i += 100) {
    const batch = awards.slice(i, i + 100);
    const { error } = await sb
      .from("awards")
      .upsert(batch, { onConflict: "contract_number,fsc,niin", ignoreDuplicates: false });
    if (error) {
      // If unique constraint doesn't exist, just insert
      const { error: insertErr } = await sb.from("awards").insert(batch);
      if (insertErr) {
        console.error(`Batch error: ${insertErr.message}`);
      } else {
        saved += batch.length;
      }
    } else {
      saved += batch.length;
    }
    if ((i + 100) % 1000 === 0) console.log(`  ${saved} saved...`);
  }

  console.log(`\nDone! ${saved} of our awards imported to Supabase`);
  console.log(`These will show as CAGE 0AG09 (WON) in bid history`);

  await sb.from("sync_log").insert({
    action: "lamlinks_awards_import",
    details: { total_raw: rawAwards.length, saved },
  });

  // Auto-trigger reprice: newly imported wins become the "last winning bid"
  // for their NSN. Without this the sourceable-item prices stay stale until
  // someone manually hits the reprice endpoint.
  const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "https://dibs-gov-production.up.railway.app";
  console.log(`\nTriggering reprice at ${RAILWAY_URL}/api/dibbs/reprice ...`);
  try {
    const resp = await fetch(`${RAILWAY_URL}/api/dibbs/reprice`, { method: "POST" });
    const body: any = await resp.json().catch(() => ({}));
    if (resp.ok) {
      console.log(`  Reprice: ${body.updated || 0} updated, ${body.skipped || 0} skipped`);
    } else {
      console.warn(`  Reprice HTTP ${resp.status}: ${JSON.stringify(body).slice(0, 200)}`);
    }
  } catch (e: any) {
    console.warn(`  Reprice failed: ${e?.message || "unknown"}`);
  }
}

main().catch(console.error);
