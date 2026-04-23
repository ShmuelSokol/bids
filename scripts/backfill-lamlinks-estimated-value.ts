/**
 * Patch every existing dibbs_solicitations row with LamLinks' estval_k11
 * (lamlinks_estimated_value). Supabase-first approach: pull DIBS keys,
 * query LL for their estval values, update by id.
 *
 *   npx tsx scripts/backfill-lamlinks-estimated-value.ts
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
  console.log("=== LamLinks Estimated Value Backfill ===");

  const rows: { id: number; solicitation_number: string; nsn: string }[] = [];
  let p = 0;
  while (true) {
    const { data } = await sb
      .from("dibbs_solicitations")
      .select("id, solicitation_number, nsn")
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    p++;
  }
  const bySolNsn = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.solicitation_number.trim()}__${r.nsn.trim()}`;
    if (!bySolNsn.has(k)) bySolNsn.set(k, []);
    bySolNsn.get(k)!.push(r);
  }
  const sols = [...new Set(rows.map((r) => r.solicitation_number.trim()))];
  console.log(`  ${rows.length.toLocaleString()} DIBS rows, ${sols.length.toLocaleString()} distinct sols\n`);

  const pool = await sql.connect(config);
  const byKey = new Map<string, number>(); // sol__nsn → estval
  const CHUNK = 500;
  for (let i = 0; i < sols.length; i += CHUNK) {
    const batch = sols.slice(i, i + CHUNK);
    const placeholders = batch.map((_, j) => `@sol${j}`).join(",");
    const req = pool.request();
    batch.forEach((s, j) => req.input(`sol${j}`, sql.VarChar, s));
    const q = await req.query(`
      SELECT k10.sol_no_k10 AS sol, k08.fsc_k08 AS fsc, k08.niin_k08 AS niin, k11.estval_k11 AS estval
      FROM k11_tab k11
      JOIN k10_tab k10 ON k10.idnk10_k10 = k11.idnk10_k11
      JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
      WHERE k10.sol_no_k10 IN (${placeholders})
    `);
    for (const r of q.recordset) {
      if (r.estval == null) continue;
      const sol = String(r.sol || "").trim();
      const nsn = `${String(r.fsc || "").trim()}-${String(r.niin || "").trim()}`;
      const k = `${sol}__${nsn}`;
      if (!bySolNsn.has(k)) continue;
      // If multiple k11 rows share sol+nsn, prefer the max estval (usually
      // an accurate total vs a zero'd placeholder).
      const prev = byKey.get(k);
      if (prev == null || Number(r.estval) > prev) byKey.set(k, Number(r.estval));
    }
    if ((i / CHUNK) % 5 === 0 || i + CHUNK >= sols.length) {
      console.log(`  ${Math.min(i + CHUNK, sols.length).toLocaleString()} / ${sols.length.toLocaleString()} — ${byKey.size.toLocaleString()} matched`);
    }
  }
  await pool.close();

  console.log(`\nUpdating dibbs_solicitations in parallel batches of 25...`);
  const updates: { id: number; value: number }[] = [];
  for (const [key, estval] of byKey) {
    const matches = bySolNsn.get(key) || [];
    for (const m of matches) updates.push({ id: m.id, value: estval });
  }
  let done = 0;
  const PARALLEL = 25;
  for (let i = 0; i < updates.length; i += PARALLEL) {
    const slice = updates.slice(i, i + PARALLEL);
    await Promise.all(
      slice.map((u) =>
        sb
          .from("dibbs_solicitations")
          .update({ lamlinks_estimated_value: u.value })
          .eq("id", u.id)
      )
    );
    done += slice.length;
    if (done % 2000 < PARALLEL) console.log(`  ${done.toLocaleString()} / ${updates.length.toLocaleString()} updated`);
  }
  console.log(`\n${done.toLocaleString()} rows updated.`);

  await sb.from("sync_log").insert({
    action: "lamlinks_estimated_value_backfill",
    details: { dibs_rows: rows.length, matched: byKey.size, updated: done },
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
