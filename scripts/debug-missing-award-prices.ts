/**
 * Diagnostic: for the three award rows whose price is NULL in kc4,
 * look across other LamLinks tables (k80/k81/k79) to see if the
 * unit price is stored somewhere else we can fall back to.
 *
 *   npx tsx scripts/debug-missing-award-prices.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const TARGETS = [
  "SPE2DH25V4114",
  "SPE2DH25V3633",
  "SPE2DH25V3071",
  "SPE2DH-25-V-4114",
  "SPE2DH-25-V-3633",
  "SPE2DH-25-V-3071",
];

async function main() {
  const pool = await sql.connect(config);

  console.log("=== kc4_tab — full row for each target contract ===");
  for (const t of TARGETS) {
    const { recordset } = await pool.request().query(`
      SELECT TOP 5 *
      FROM kc4_tab
      WHERE cntrct_kc4 = '${t}' OR piidno_kc4 = '${t}'
    `);
    if (recordset.length > 0) {
      console.log(`\n  ${t}: ${recordset.length} row(s)`);
      for (const r of recordset) {
        console.log("   ", JSON.stringify(r));
      }
    }
  }

  console.log("\n=== k80_tab — contract header lookup by piidno_k80 ===");
  for (const t of TARGETS) {
    const { recordset } = await pool.request().query(`
      SELECT TOP 3 idnk80_k80, piidno_k80, cntpri_k80, rel_no_k80, reldte_k80, rlssta_k80
      FROM k80_tab
      WHERE piidno_k80 = '${t}'
    `);
    if (recordset.length > 0) {
      console.log(`\n  ${t}: ${recordset.length} row(s) in k80`);
      for (const r of recordset) console.log("   ", JSON.stringify(r));
    }
  }

  console.log("\n=== k81_tab — line items with prices (via k80) ===");
  for (const t of TARGETS) {
    const { recordset } = await pool.request().query(`
      SELECT TOP 5
        k81.idnk81_k81,
        k81.clinno_k81,
        k81.cln_up_k81   AS unit_price,
        k81.clnqty_k81   AS qty,
        k81.clnext_k81   AS extended,
        k81.cln_ui_k81   AS uom,
        k80.piidno_k80   AS contract,
        k80.rel_no_k80   AS rel
      FROM k80_tab k80
      JOIN k81_tab k81 ON k81.idnk80_k81 = k80.idnk80_k80
      WHERE k80.piidno_k80 = '${t}'
    `);
    if (recordset.length > 0) {
      console.log(`\n  ${t}: ${recordset.length} line(s) in k81`);
      for (const r of recordset) console.log("   ", JSON.stringify(r));
    }
  }

  console.log("\n=== k79_tab — maybe the original contract table has it ===");
  for (const t of TARGETS) {
    const { recordset } = await pool.request().query(`
      SELECT TOP 3 idnk79_k79, cntrct_k79, cntdte_k79, rqmtyp_k79
      FROM k79_tab
      WHERE cntrct_k79 = '${t}'
    `);
    if (recordset.length > 0) {
      console.log(`\n  ${t}: ${recordset.length} row(s) in k79`);
      for (const r of recordset) console.log("   ", JSON.stringify(r));
    }
  }

  // Broader check: show what columns kc4 has that might differ across these 3 rows
  console.log("\n=== kc4 field-by-field for the 3 NULL-price rows ===");
  const { recordset: nullRows } = await pool.request().query(`
    SELECT kc4.*
    FROM kc4_tab kc4
    JOIN k08_tab k08 ON k08.idnk08_k08 = kc4.idnk08_kc4
    WHERE k08.fsc_k08 = '6520'
      AND k08.niin_k08 = '01-612-0605'
      AND kc4.awd_up_kc4 IS NULL
  `);
  console.log(`Found ${nullRows.length} null-price kc4 rows for 6520-01-612-0605:`);
  for (const r of nullRows) {
    console.log("\n  ---");
    for (const [k, v] of Object.entries(r)) {
      if (v !== null && v !== undefined && v !== "") console.log(`    ${k}: ${v}`);
    }
  }

  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
