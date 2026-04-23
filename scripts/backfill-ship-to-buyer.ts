/**
 * Backfill ship_to_locations + buyer_* + posting_type + required_delivery_days
 * on existing dibbs_solicitations rows.
 *
 *   npx tsx scripts/backfill-ship-to-buyer.ts
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
  console.log("=== Ship-to + Buyer Backfill ===");

  // 1. Pull every (id, sol_no, nsn) from DIBS
  console.log("Loading dibbs_solicitations keys...");
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
    const sol = r.solicitation_number.trim();
    const key = `${sol}__${r.nsn.trim()}`;
    if (!bySolNsn.has(key)) bySolNsn.set(key, []);
    bySolNsn.get(key)!.push(r);
  }
  const sols = [...new Set(rows.map((r) => r.solicitation_number.trim()))];
  console.log(`  ${rows.length.toLocaleString()} DIBS rows, ${sols.length.toLocaleString()} distinct sols\n`);

  // 2. Pull k10 + k11 + k32 info for these sols in batches.
  console.log("Fetching LamLinks k10 + k32 for those sols...");
  const pool = await sql.connect(config);
  type Payload = {
    solicitation_number: string;
    nsn: string;
    buyer_name: string | null;
    buyer_email: string | null;
    buyer_phone: string | null;
    priority_code: string | null;
    posting_type: string | null;
    issue_date: string | null;
    ship_to_locations: any[];
    required_delivery_days: number | null;
  };
  const byKey = new Map<string, Payload>();

  const CHUNK = 500;
  let totalK11 = 0;
  let totalK32 = 0;
  for (let i = 0; i < sols.length; i += CHUNK) {
    const batch = sols.slice(i, i + CHUNK);
    const placeholders = batch.map((_, j) => `@sol${j}`).join(",");
    const req = pool.request();
    batch.forEach((s, j) => req.input(`sol${j}`, sql.VarChar, s));

    // k10 + k11 + k08 to find each (sol, nsn) + its idnk11 + buyer/posting fields.
    const k11Q = await req.query(`
      SELECT
        k10.sol_no_k10 AS solicitation_number,
        k08.fsc_k08 AS fsc, k08.niin_k08 AS niin,
        k10.b_name_k10 AS buyer_name, k10.buyeml_k10 AS buyer_email,
        k10.b_phon_k10 AS buyer_phone, k10.cntpri_k10 AS priority_code,
        k10.sol_ti_k10 AS posting_type, k10.isudte_k10 AS issue_date,
        k11.idnk11_k11 AS idnk11
      FROM k10_tab k10
      JOIN k11_tab k11 ON k11.idnk10_k11 = k10.idnk10_k10
      JOIN k08_tab k08 ON k08.idnk08_k08 = k11.idnk08_k11
      WHERE k10.sol_no_k10 IN (${placeholders})
    `);
    totalK11 += k11Q.recordset.length;

    // Collect idnk11 ids we actually need (those that match a DIBS row).
    const wantedIdnk11: number[] = [];
    const k11ToKey = new Map<number, string>();
    for (const r of k11Q.recordset) {
      const sol = String(r.solicitation_number || "").trim();
      const nsn = `${String(r.fsc || "").trim()}-${String(r.niin || "").trim()}`;
      const key = `${sol}__${nsn}`;
      if (!bySolNsn.has(key)) continue;
      wantedIdnk11.push(r.idnk11);
      k11ToKey.set(r.idnk11, key);
      if (!byKey.has(key)) {
        byKey.set(key, {
          solicitation_number: sol,
          nsn,
          buyer_name: String(r.buyer_name || "").trim() || null,
          buyer_email: String(r.buyer_email || "").trim() || null,
          buyer_phone: String(r.buyer_phone || "").trim() || null,
          priority_code: String(r.priority_code || "").trim() || null,
          posting_type: String(r.posting_type || "").trim().toUpperCase().charAt(0) || null,
          issue_date: r.issue_date ? new Date(r.issue_date).toISOString().slice(0, 10) : null,
          ship_to_locations: [],
          required_delivery_days: null,
        });
      }
    }

    // k32 pull for only the ids we want, in inner chunks.
    for (let j = 0; j < wantedIdnk11.length; j += CHUNK) {
      const inner = wantedIdnk11.slice(j, j + CHUNK);
      const innerPl = inner.map((_, k) => `@k${k}`).join(",");
      const innerReq = pool.request();
      inner.forEach((id, k) => innerReq.input(`k${k}`, sql.Int, id));
      const k32Q = await innerReq.query(`
        SELECT idnk11_k32, itemno_k32, shptol_k32, qty_k32, dlydte_k32
        FROM k32_tab WHERE idnk11_k32 IN (${innerPl})
      `);
      totalK32 += k32Q.recordset.length;
      for (const r of k32Q.recordset) {
        const key = k11ToKey.get(r.idnk11_k32);
        if (!key) continue;
        const p = byKey.get(key);
        if (!p) continue;
        p.ship_to_locations.push({
          clin: String(r.itemno_k32 || "").trim() || null,
          destination: String(r.shptol_k32 || "").trim() || null,
          qty: Number(r.qty_k32) || 0,
          delivery_date: r.dlydte_k32 ? new Date(r.dlydte_k32).toISOString().slice(0, 10) : null,
        });
      }
    }

    if ((i / CHUNK) % 4 === 0 || i + CHUNK >= sols.length) {
      console.log(`  ${Math.min(i + CHUNK, sols.length).toLocaleString()} / ${sols.length.toLocaleString()} sols — ${byKey.size.toLocaleString()} DIBS keys resolved, ${totalK32.toLocaleString()} ship-to rows seen`);
    }
  }
  await pool.close();

  // 3. Compute required_delivery_days from earliest ship-to vs issue_date
  for (const p of byKey.values()) {
    if (!p.issue_date || p.ship_to_locations.length === 0) continue;
    const issueMs = new Date(p.issue_date).getTime();
    const ts = p.ship_to_locations
      .map((s: any) => s.delivery_date ? new Date(s.delivery_date).getTime() : null)
      .filter((t: any) => t !== null) as number[];
    if (ts.length === 0) continue;
    p.required_delivery_days = Math.max(1, Math.round((Math.min(...ts) - issueMs) / 86400000));
  }

  console.log(`\nResolved ${byKey.size.toLocaleString()} of ${rows.length.toLocaleString()} DIBS rows`);
  const withShip = [...byKey.values()].filter((p) => p.ship_to_locations.length > 0).length;
  console.log(`  ${withShip.toLocaleString()} have ship-to, ${(byKey.size - withShip).toLocaleString()} have buyer-only`);

  // 4. Update one DIBS id at a time (can't easily batch because payload
  //    differs per row). Do it in parallel Promise.all batches of 20.
  console.log("\nUpdating dibbs_solicitations (parallel batches)...");
  const updates: { id: number; payload: any }[] = [];
  for (const [key, p] of byKey) {
    const matches = bySolNsn.get(key) || [];
    for (const m of matches) {
      updates.push({
        id: m.id,
        payload: {
          ship_to_locations: p.ship_to_locations,
          buyer_name: p.buyer_name,
          buyer_email: p.buyer_email,
          buyer_phone: p.buyer_phone,
          priority_code: p.priority_code,
          posting_type: p.posting_type,
          required_delivery_days: p.required_delivery_days,
        },
      });
    }
  }
  let done = 0;
  const PARALLEL = 20;
  for (let i = 0; i < updates.length; i += PARALLEL) {
    const slice = updates.slice(i, i + PARALLEL);
    await Promise.all(slice.map((u) => sb.from("dibbs_solicitations").update(u.payload).eq("id", u.id)));
    done += slice.length;
    if (done % 2000 < PARALLEL) console.log(`  ${done.toLocaleString()} / ${updates.length.toLocaleString()} updated`);
  }

  console.log(`\nDone. ${done.toLocaleString()} rows updated.`);

  // 5. Sanity sample
  const { data: sample } = await sb
    .from("dibbs_solicitations")
    .select("solicitation_number, nsn, buyer_name, posting_type, required_delivery_days, ship_to_locations")
    .not("ship_to_locations", "is", null)
    .order("updated_at", { ascending: false })
    .limit(3);
  console.log("\nSample of enriched rows:");
  for (const s of sample || []) console.log(" ", JSON.stringify(s).slice(0, 300));

  await sb.from("sync_log").insert({
    action: "ship_to_buyer_backfill",
    details: { dibs_rows: rows.length, resolved: byKey.size, updated: done },
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
