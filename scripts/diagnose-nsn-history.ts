/**
 * Dump every LamLinks row that touches a given NSN — awards, competitor
 * awards, historical bids — WITHOUT the usual 2-year / "Removed" filters
 * so we can see what the normal importers dropped and why.
 *
 * Usage (local only — needs NYEVRVSQL001 Windows Auth):
 *   npx tsx scripts/diagnose-nsn-history.ts 5315-01-525-4843
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const nsn = process.argv[2];
  if (!nsn || !/^\d{4}-\d{2}-\d{3}-\d{4}$/.test(nsn)) {
    console.error("Pass NSN in 4-2-3-4 format: npx tsx scripts/diagnose-nsn-history.ts 5315-01-525-4843");
    process.exit(1);
  }
  const [fsc, ...niinParts] = nsn.split("-");
  const niin = niinParts.join("-"); // e.g. "01-525-4843"
  console.log(`NSN = ${nsn}  (fsc=${fsc}, niin=${niin})\n`);

  const pool = await sql.connect(config);

  // 1. k08 — the item record this NSN maps to
  console.log("=== k08_tab (the item) ===");
  const k08 = await pool.request()
    .input("fsc", sql.VarChar, fsc)
    .input("niin", sql.VarChar, niin)
    .query(`
      SELECT idnk08_k08, fsc_k08, niin_k08, p_desc_k08, partno_k08, p_cage_k08, addtme_k08
      FROM k08_tab WHERE fsc_k08=@fsc AND niin_k08=@niin
    `);
  console.log(`  ${k08.recordset.length} row(s)`);
  for (const r of k08.recordset) console.log(" ", JSON.stringify(r));

  if (k08.recordset.length === 0) {
    console.log("\nItem isn't in k08 — LamLinks doesn't know this NSN at all. DIBS can't import what LL doesn't have.");
    await pool.close();
    return;
  }
  const idnk08 = k08.recordset[0].idnk08_k08;

  // 2. kc4 — competitor + our awards, ALL dates, ALL statuses
  console.log("\n=== kc4_tab (awards — competitor + ours, NO filters) ===");
  const kc4 = await pool.request()
    .input("idnk08", sql.Int, idnk08)
    .query(`
      SELECT
        kc4.idnkc4_kc4, kc4.a_cage_kc4 AS cage, kc4.awd_up_kc4 AS unit_price,
        kc4.awdqty_kc4 AS qty, kc4.awd_um_kc4 AS uom,
        kc4.reldte_kc4 AS award_date, kc4.c_stat_kc4 AS status,
        kc4.piidno_kc4 AS piid, kc4.cntrct_kc4 AS contract_number,
        kc4.adddte_kc4 AS imported_at,
        k10.sol_no_k10 AS solicitation
      FROM kc4_tab kc4
      LEFT JOIN k10_tab k10 ON k10.idnk10_k10 = kc4.idnk10_kc4
      WHERE kc4.idnk08_kc4 = @idnk08
      ORDER BY kc4.reldte_kc4 DESC
    `);
  console.log(`  ${kc4.recordset.length} row(s)`);
  for (const r of kc4.recordset) console.log(" ", JSON.stringify(r));

  // 3. k81 — our awarded contract lines
  console.log("\n=== k81_tab (OUR awards — via k71 → k11 → k08) ===");
  const k81 = await pool.request()
    .input("idnk08", sql.Int, idnk08)
    .query(`
      SELECT k81.idnk81_k81, k79.cntrct_k79 AS contract_number,
             k81.clinno_k81 AS clin, k81.cln_up_k81 AS unit_price,
             k81.clnqty_k81 AS qty, k81.cln_ui_k81 AS uom,
             k81.addtme_k81 AS award_date, k81.shpsta_k81 AS ship_status
      FROM k81_tab k81
      JOIN k71_tab k71 ON k71.idnk71_k71 = k81.idnk71_k81
      JOIN k11_tab k11 ON k11.idnk11_k11 = k71.idnk11_k71
      JOIN k80_tab k80 ON k80.idnk80_k80 = k81.idnk80_k81
      JOIN k79_tab k79 ON k79.idnk79_k79 = k80.idnk79_k80
      WHERE k11.idnk08_k11 = @idnk08
      ORDER BY k81.addtme_k81 DESC
    `);
  console.log(`  ${k81.recordset.length} row(s)`);
  for (const r of k81.recordset) console.log(" ", JSON.stringify(r));

  // 4. Our historical bids (k33 envelope → k34 line → k35 price) via k11 → k08
  console.log("\n=== k33/k34/k35 (OUR historical bids) ===");
  const bids = await pool.request()
    .input("idnk08", sql.Int, idnk08)
    .query(`
      SELECT TOP 50
        k33.idnk33_k33, k33.addtme_k33 AS bid_date, k33.o_stat_k33 AS env_status,
        k35.bidprc_k35 AS bid_price, k34.lt_days_k34 AS lead_days,
        k10.sol_no_k10 AS solicitation
      FROM k33_tab k33
      JOIN k34_tab k34 ON k34.idnk33_k34 = k33.idnk33_k33
      JOIN k35_tab k35 ON k35.idnk34_k35 = k34.idnk34_k34
      JOIN k11_tab k11 ON k11.idnk11_k11 = k34.idnk11_k34
      LEFT JOIN k10_tab k10 ON k10.idnk10_k10 = k11.idnk10_k11
      WHERE k11.idnk08_k11 = @idnk08
      ORDER BY k33.addtme_k33 DESC
    `);
  console.log(`  ${bids.recordset.length} row(s)`);
  for (const r of bids.recordset) console.log(" ", JSON.stringify(r));

  await pool.close();

  // Diagnosis
  console.log("\n=== Diagnosis ===");
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const tooOldKc4 = kc4.recordset.filter((r: any) => r.award_date && new Date(r.award_date) < twoYearsAgo).length;
  const removedKc4 = kc4.recordset.filter((r: any) => String(r.status || "").trim() === "Removed").length;
  const tooOldK81 = k81.recordset.filter((r: any) => r.award_date && new Date(r.award_date) < twoYearsAgo).length;
  console.log(`  kc4: ${kc4.recordset.length} total, ${tooOldKc4} older than 2y, ${removedKc4} marked Removed`);
  console.log(`  k81: ${k81.recordset.length} total, ${tooOldK81} older than 2y`);
  if (tooOldKc4 || tooOldK81) {
    console.log(`  → Extending the import window beyond 2y would surface those.`);
  }
  if (removedKc4) {
    console.log(`  → ${removedKc4} kc4 row(s) dropped because status='Removed'. Most of those are cancelled awards — typically right to exclude.`);
  }
  if (!kc4.recordset.length && !k81.recordset.length && !bids.recordset.length) {
    console.log(`  → LamLinks has the item in k08 but zero award/bid history. There's nothing for DIBS to import.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
