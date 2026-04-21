// After a LamLinks post, DIBS's bid_decisions still shows status='quoted'
// until something tells it the bid actually went out. This script reconciles:
// for each bid_decisions row in 'quoted' state, check if LamLinks k33/k34/k35
// has a matching sent bid today — if yes, flip status → 'submitted'.

import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const execute = process.argv.includes("--execute");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // 1. DIBS bid_decisions currently in 'quoted' state
  const { data: quoted, error } = await supabase
    .from("bid_decisions")
    .select("solicitation_number, nsn, status, final_price, comment, decided_by, created_at")
    .eq("status", "quoted")
    .order("created_at", { ascending: false });
  if (error) throw error;
  console.log(`DIBS bid_decisions in 'quoted' state: ${quoted?.length || 0}`);
  for (const q of quoted || []) {
    console.log(`  ${q.solicitation_number}  NSN ${q.nsn}  $${q.final_price}  decided_by=${q.decided_by}  at ${q.created_at}`);
  }

  if (!quoted || quoted.length === 0) { await pool.close(); return; }

  // 2. For each quoted sol, check if LamLinks has a posted k34 line for it in the last 24h
  console.log(`\nChecking LamLinks posted bids for matches...\n`);
  const toUpdate: { sol: string; nsn: string; idnk34: number }[] = [];
  for (const q of quoted) {
    const sol = q.solicitation_number;
    const r = await pool.request().query(`
      SELECT TOP 1 k34.idnk34_k34, k33.t_stat_k33, k33.t_stme_k33, k35.up_k35
      FROM k34_tab k34
      INNER JOIN k33_tab k33 ON k34.idnk33_k34 = k33.idnk33_k33
      INNER JOIN k11_tab k11 ON k34.idnk11_k34 = k11.idnk11_k11
      INNER JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
      LEFT JOIN k35_tab k35 ON k35.idnk34_k35 = k34.idnk34_k34
      WHERE k10.sol_no_k10 = '${sol}'
        AND k33.t_stat_k33 LIKE 'sent%'
        AND k33.t_stme_k33 > DATEADD(hour, -24, GETDATE())
      ORDER BY k33.t_stme_k33 DESC
    `);
    if (r.recordset.length > 0) {
      const row = r.recordset[0];
      console.log(`  ✓ ${sol} — posted at ${row.t_stme_k33?.toISOString?.()}, k34=${row.idnk34_k34}, price=$${row.up_k35}`);
      toUpdate.push({ sol, nsn: q.nsn, idnk34: row.idnk34_k34 });
    } else {
      console.log(`  · ${sol} — no matching sent bid in LamLinks (still awaiting Abe's post)`);
    }
  }

  console.log(`\n${toUpdate.length} sols to flip from 'quoted' → 'submitted' in DIBS.`);

  if (!execute) {
    console.log(`DRY RUN. Re-run with --execute to apply.`);
    await pool.close();
    return;
  }

  for (const u of toUpdate) {
    const { error } = await supabase
      .from("bid_decisions")
      .update({ status: "submitted", comment: `Transmitted via LamLinks k34=${u.idnk34}` })
      .eq("solicitation_number", u.sol)
      .eq("nsn", u.nsn);
    if (error) console.log(`  ✗ ${u.sol}: ${error.message}`);
    else console.log(`  ✓ ${u.sol} flipped to 'submitted'`);
  }

  await pool.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
