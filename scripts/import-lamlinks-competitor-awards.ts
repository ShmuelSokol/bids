/**
 * Import competitor awards from LamLinks kc4_tab → Supabase awards.
 *
 * kc4_tab is LamLinks' per-solicitation award record:
 *   - a_cage_kc4 = awardee CAGE (us OR competitor)
 *   - awd_up_kc4 = awarded unit price
 *   - awdqty_kc4 = awarded qty
 *   - reldte_kc4 = release / award date
 *   - cntrct_kc4 = contract number
 *   - idnk08_kc4 → k08 (item: FSC + NIIN)
 *   - idnk10_kc4 → k10 (solicitation #)
 *
 * Replaces an earlier plan to scrape DIBBS directly — LamLinks already
 * pulls this data into kc4 so we just join in SQL.
 *
 *   npx tsx scripts/import-lamlinks-competitor-awards.ts
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
  console.log("=== LamLinks Competitor Awards Import ===");
  console.log(`Started: ${new Date().toISOString()}`);

  const pool = await sql.connect(config);

  // 2-year window. kc4 has both our wins and competitor wins.
  //
  // Skip "Removed" status rows — those are cancelled/withdrawn awards
  // that shouldn't show in history. They have all-zero price/qty/uom
  // and would just be noise. Keep "Awarded" rows even if their price
  // is 0 (that's a real event, LamLinks just didn't capture the price
  // for some of them).
  const result = await pool.request().query(`
    SELECT
      kc4.cntrct_kc4   AS contract_number,
      kc4.a_cage_kc4   AS cage,
      kc4.awd_up_kc4   AS unit_price,
      kc4.awdqty_kc4   AS quantity,
      kc4.awd_um_kc4   AS unit_of_measure,
      kc4.reldte_kc4   AS award_date,
      kc4.c_stat_kc4   AS contract_status,
      kc4.piidno_kc4   AS piid,
      kc4.adddte_kc4   AS imported_at,
      k08.fsc_k08      AS fsc,
      k08.niin_k08     AS niin,
      k08.p_desc_k08   AS description,
      k08.partno_k08   AS part_number,
      k10.sol_no_k10   AS solicitation_number
    FROM kc4_tab kc4
    LEFT JOIN k08_tab k08 ON k08.idnk08_k08 = kc4.idnk08_kc4
    LEFT JOIN k10_tab k10 ON k10.idnk10_k10 = kc4.idnk10_kc4
    WHERE kc4.adddte_kc4 >= DATEADD(year, -2, GETDATE())
      AND kc4.a_cage_kc4 IS NOT NULL
      AND k08.fsc_k08 IS NOT NULL
      AND k08.niin_k08 IS NOT NULL
      AND RTRIM(LTRIM(kc4.c_stat_kc4)) != 'Removed'
    ORDER BY kc4.reldte_kc4 DESC
  `);

  const raw = result.recordset;
  console.log(`Found ${raw.length} kc4 award rows`);

  await pool.close();

  // Transform to the awards-table schema. Tag with data_source so we
  // can tell competitor data apart from our own LamLinks-k81 imports.
  const seen = new Set<string>();
  const rows: any[] = [];
  let ourCount = 0;
  let compCount = 0;
  for (const r of raw) {
    const cage = r.cage?.trim();
    if (!cage) continue;
    const fsc = r.fsc?.trim();
    const niin = r.niin?.trim();
    if (!fsc || !niin) continue;
    const contract = r.contract_number?.trim() || r.piid?.trim() || "";
    if (!contract) continue;

    const key = `${contract}_${fsc}_${niin}_${cage}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (cage === "0AG09") ourCount++;
    else compCount++;

    rows.push({
      contract_number: contract,
      cage,
      fsc,
      niin,
      unit_price: r.unit_price ? Number(r.unit_price) : null,
      quantity: r.quantity ? Number(r.quantity) : 1,
      description: r.description?.trim() || "",
      award_date: r.award_date || null,
      data_source: cage === "0AG09" ? "lamlinks_kc4_self" : "lamlinks_kc4_competitor",
    });
  }
  console.log(`Deduped to ${rows.length} unique rows (${ourCount} ours, ${compCount} competitors)`);

  // Upsert in batches of 200
  let saved = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    // Conflict key matches the awards_contract_fsc_niin_cage_unique
    // constraint we added on the awards table — different CAGEs winning
    // the same contract+NSN are different rows (rare but possible with
    // contract mods).
    const { error } = await sb
      .from("awards")
      .upsert(batch, { onConflict: "contract_number,fsc,niin,cage", ignoreDuplicates: false });
    if (error) {
      // Fallback: if the constraint isn't there yet, try plain insert
      // (will skip rows that violate any existing PK / unique).
      const { error: insertErr } = await sb.from("awards").insert(batch);
      if (insertErr) {
        console.warn(`  batch ${i / 200 + 1} error:`, error.message);
        errors += batch.length;
      } else {
        saved += batch.length;
      }
    } else {
      saved += batch.length;
    }
    if ((i + 200) % 1000 === 0) console.log(`  ${saved} saved...`);
  }

  console.log(`\nDone! ${saved} saved, ${errors} errors`);

  await sb.from("sync_log").insert({
    action: "lamlinks_competitor_awards_import",
    details: { raw: raw.length, deduped: rows.length, ours: ourCount, competitors: compCount, saved, errors },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
