/**
 * One-shot backfill: populate file_reference / file_reference_date /
 * internal_edi_reference on existing `dibbs_solicitations` rows by joining
 * back to LamLinks via k10 → k11 → k09.
 *
 * Run AFTER ALTER TABLE adds the three columns. The normal import already
 * pulls these going forward; this script patches the backlog.
 *
 * Usage (local, needs Windows Auth to NYEVRVSQL001):
 *   npx tsx scripts/backfill-file-reference.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== File Reference Backfill ===");
  const pool = await sql.connect(config);

  // Pull (sol, nsn, k09.ref/date/ourref) for every k11 row. The (sol,nsn)
  // grain matches dibbs_solicitations. If LamLinks has multiple k09 refs
  // per (sol,nsn) we pick the most recent by refdte_k09 — which matches
  // Abe's mental model ("the batch this line showed up in most recently").
  console.log("Querying LamLinks for k09 → (sol, nsn) mapping...");
  const q = await pool.request().query(`
    SELECT
      k10.sol_no_k10 AS solicitation_number,
      k08.fsc_k08    AS fsc,
      k08.niin_k08   AS niin,
      k09.ref_no_k09 AS file_reference,
      k09.refdte_k09 AS file_reference_date,
      k09.ourref_k09 AS internal_edi_reference
    FROM k11_tab k11
    JOIN k10_tab k10 ON k10.idnk10_k10 = k11.idnk10_k11
    JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
    JOIN k09_tab k09 ON k09.idnk09_k09 = k11.idnk09_k11
    WHERE k09.ref_no_k09 IS NOT NULL
  `);
  console.log(`  ${q.recordset.length.toLocaleString()} k11 rows with a k09 reference`);

  // Reduce to one entry per (sol, nsn) — most recent refdte wins.
  const byKey = new Map<string, any>();
  for (const r of q.recordset) {
    const sol = r.solicitation_number?.trim();
    const nsn = `${r.fsc?.trim()}-${r.niin?.trim()}`;
    if (!sol || !r.fsc) continue;
    const key = `${sol}__${nsn}`;
    const existing = byKey.get(key);
    if (!existing || (r.file_reference_date && new Date(r.file_reference_date) > new Date(existing.file_reference_date))) {
      byKey.set(key, {
        solicitation_number: sol,
        nsn,
        file_reference: r.file_reference?.trim() || null,
        file_reference_date: r.file_reference_date ? new Date(r.file_reference_date).toISOString().slice(0, 10) : null,
        internal_edi_reference: r.internal_edi_reference?.trim() || null,
      });
    }
  }
  console.log(`  ${byKey.size.toLocaleString()} unique (sol, nsn) pairs`);
  await pool.close();

  // Update dibbs_solicitations in batches. PostgREST doesn't do bulk
  // UPDATE with per-row values cleanly, so we run one update per unique
  // `file_reference` value — all (sol, nsn) pairs sharing a file_ref get
  // updated together via `.in()`. That collapses the writes ~3 orders of
  // magnitude vs one-per-row.
  const byRef = new Map<string, any[]>();
  for (const v of byKey.values()) {
    if (!v.file_reference) continue;
    const key = JSON.stringify({ r: v.file_reference, d: v.file_reference_date, e: v.internal_edi_reference });
    if (!byRef.has(key)) byRef.set(key, []);
    byRef.get(key)!.push(v);
  }

  let updated = 0;
  let processed = 0;
  for (const [payload, rows] of byRef) {
    const { r: ref, d: date, e: edi } = JSON.parse(payload);
    // PostgREST `.in()` only filters on one column — we need (sol AND nsn).
    // Cheapest: fetch the matching ids, then update by id in 500-row chunks.
    // For small clusters (typical) this is still 2 round-trips per ref.
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const sols = slice.map((r: any) => r.solicitation_number);
      const nsns = slice.map((r: any) => r.nsn);
      const { data: matching } = await sb
        .from("dibbs_solicitations")
        .select("id, solicitation_number, nsn")
        .in("solicitation_number", sols)
        .in("nsn", nsns);
      if (!matching) continue;
      // Cartesian false-positives are possible with `.in().in()` — filter
      // to only pairs we actually want.
      const wanted = new Set(slice.map((r: any) => `${r.solicitation_number}__${r.nsn}`));
      const targetIds = (matching || [])
        .filter((m: any) => wanted.has(`${m.solicitation_number}__${m.nsn}`))
        .map((m: any) => m.id);
      if (targetIds.length === 0) { processed += slice.length; continue; }
      const { data: upd, error } = await sb
        .from("dibbs_solicitations")
        .update({
          file_reference: ref,
          file_reference_date: date,
          internal_edi_reference: edi,
        })
        .in("id", targetIds)
        .select("id");
      if (error) { console.error(`  batch error: ${error.message}`); continue; }
      updated += upd?.length || 0;
      processed += slice.length;
    }
    if (processed % 2000 < 500) {
      console.log(`  ${processed.toLocaleString()} / ${byKey.size.toLocaleString()} processed, ${updated.toLocaleString()} updated`);
    }
  }

  console.log(`\nDone. ${updated.toLocaleString()} rows updated with file_reference.`);

  // Surface a sample so you can sanity-check
  const { data: sample } = await sb
    .from("dibbs_solicitations")
    .select("solicitation_number, nsn, file_reference, file_reference_date, internal_edi_reference")
    .not("file_reference", "is", null)
    .order("file_reference_date", { ascending: false })
    .limit(5);
  console.log("\nSample of enriched rows:");
  for (const s of sample || []) console.log(" ", JSON.stringify(s));

  await sb.from("sync_log").insert({
    action: "file_reference_backfill",
    details: { total_pairs: byKey.size, updated },
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
