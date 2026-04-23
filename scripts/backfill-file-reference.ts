/**
 * One-shot backfill: populate file_reference / file_reference_date /
 * internal_edi_reference on existing `dibbs_solicitations` rows by looking
 * each one up in LamLinks k10 → k11 → k09.
 *
 * Supabase-first direction: we only have ~21K DIBS rows but LamLinks has
 * ~1.84M (sol, nsn) pairs. Walking LL and filtering client-side (the old
 * approach) was slow AND didn't land matches. Fetching LL by specific
 * sol_no list is ~100x faster and directly tells us which rows resolved.
 *
 * Usage (local, needs Windows Auth to NYEVRVSQL001):
 *   npx tsx scripts/backfill-file-reference.ts [--dry-run]
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

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log("=== File Reference Backfill (Supabase-first) ===");
  if (dryRun) console.log("(DRY RUN — no updates will be written)\n");

  // 1. Pull every DIBS row with its (solicitation_number, nsn) key
  console.log("Loading dibbs_solicitations keys...");
  const dibsRows: { id: number; solicitation_number: string; nsn: string }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from("dibbs_solicitations")
      .select("id, solicitation_number, nsn")
      .range(from, from + 999);
    if (error) { console.error(error.message); return; }
    if (!data || data.length === 0) break;
    dibsRows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`  ${dibsRows.length.toLocaleString()} DIBS rows`);

  const wantKey = new Set(dibsRows.map((r) => `${r.solicitation_number.trim()}__${r.nsn.trim()}`));
  const dibsBySol = new Map<string, typeof dibsRows>();
  for (const r of dibsRows) {
    const sol = r.solicitation_number.trim();
    if (!dibsBySol.has(sol)) dibsBySol.set(sol, []);
    dibsBySol.get(sol)!.push(r);
  }
  const sols = [...dibsBySol.keys()];
  console.log(`  ${sols.length.toLocaleString()} distinct solicitation numbers\n`);

  // 2. Query LamLinks for those sols (chunked — SQL Server limits IN-list
  //    to a few thousand entries; 500 per chunk is conservative).
  console.log("Fetching k09 mappings from LamLinks...");
  const pool = await sql.connect(config);
  type LLRow = {
    solicitation_number: string;
    nsn: string;
    file_reference: string | null;
    file_reference_date: string | null;
    internal_edi_reference: string | null;
  };
  const byKey = new Map<string, LLRow>();
  const CHUNK = 500;
  let llTotal = 0;
  for (let i = 0; i < sols.length; i += CHUNK) {
    const batch = sols.slice(i, i + CHUNK);
    // msnodesqlv8 reserves the @p prefix internally — use @sol instead
    // so its auto-numbered @p1 doesn't collide with our bound names.
    const placeholders = batch.map((_, j) => `@sol${j}`).join(",");
    const req = pool.request();
    batch.forEach((s, j) => req.input(`sol${j}`, sql.VarChar, s));
    const q = await req.query(`
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
      WHERE k10.sol_no_k10 IN (${placeholders})
        AND k09.ref_no_k09 IS NOT NULL
    `);
    llTotal += q.recordset.length;
    for (const r of q.recordset) {
      const sol = String(r.solicitation_number || "").trim();
      const nsn = `${String(r.fsc || "").trim()}-${String(r.niin || "").trim()}`;
      const key = `${sol}__${nsn}`;
      if (!wantKey.has(key)) continue;
      const existing = byKey.get(key);
      const date = r.file_reference_date ? new Date(r.file_reference_date).toISOString().slice(0, 10) : null;
      if (!existing || (date && existing.file_reference_date && date > existing.file_reference_date)) {
        byKey.set(key, {
          solicitation_number: sol,
          nsn,
          file_reference: r.file_reference?.trim() || null,
          file_reference_date: date,
          internal_edi_reference: r.internal_edi_reference?.trim() || null,
        });
      }
    }
    if (i === 0 || (i / CHUNK) % 10 === 0) {
      console.log(`  ${Math.min(i + CHUNK, sols.length).toLocaleString()} / ${sols.length.toLocaleString()} sols scanned — ${llTotal.toLocaleString()} LL rows returned, ${byKey.size.toLocaleString()} DIBS keys resolved`);
    }
  }
  await pool.close();
  console.log(`\n  Resolved ${byKey.size.toLocaleString()} of ${dibsRows.length.toLocaleString()} DIBS rows (${((byKey.size / dibsRows.length) * 100).toFixed(1)}%)`);
  console.log(`  ${(dibsRows.length - byKey.size).toLocaleString()} rows had no k09 match in LL (expected for older / Army sols)`);

  if (dryRun) {
    console.log("\nDry run — sample of resolved rows:");
    const sample = [...byKey.values()].slice(0, 10);
    for (const s of sample) console.log(" ", JSON.stringify(s));
    return;
  }

  // 3. Update in chunks, keyed by DIBS row id. Group rows by identical
  //    (ref, date, edi) tuple so a single UPDATE covers many rows.
  console.log("\nUpdating dibbs_solicitations...");
  const byPayload = new Map<string, number[]>(); // payload key → dibs ids
  for (const [key, v] of byKey) {
    const payload = JSON.stringify({ r: v.file_reference, d: v.file_reference_date, e: v.internal_edi_reference });
    // Find the dibs id for this key
    const [sol, nsn] = key.split("__");
    const candidates = dibsBySol.get(sol) || [];
    for (const c of candidates) {
      if (c.nsn.trim() === nsn) {
        if (!byPayload.has(payload)) byPayload.set(payload, []);
        byPayload.get(payload)!.push(c.id);
        break;
      }
    }
  }

  let updated = 0;
  const UPDATE_CHUNK = 500;
  for (const [payload, ids] of byPayload) {
    const { r: file_reference, d: file_reference_date, e: internal_edi_reference } = JSON.parse(payload);
    for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
      const chunk = ids.slice(i, i + UPDATE_CHUNK);
      const { data, error } = await sb
        .from("dibbs_solicitations")
        .update({ file_reference, file_reference_date, internal_edi_reference })
        .in("id", chunk)
        .select("id");
      if (error) { console.error(`  batch error: ${error.message}`); continue; }
      updated += data?.length || 0;
    }
  }

  console.log(`  ${updated.toLocaleString()} rows updated\n`);

  // 4. Sanity sample
  const { data: sample } = await sb
    .from("dibbs_solicitations")
    .select("solicitation_number, nsn, file_reference, file_reference_date, internal_edi_reference")
    .not("file_reference", "is", null)
    .order("file_reference_date", { ascending: false })
    .limit(5);
  console.log("Sample of enriched rows (newest file_reference_date first):");
  for (const s of sample || []) console.log(" ", JSON.stringify(s));

  await sb.from("sync_log").insert({
    action: "file_reference_backfill",
    details: { dibs_rows: dibsRows.length, resolved: byKey.size, updated, dry_run: false },
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
