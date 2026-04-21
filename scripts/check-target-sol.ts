import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // 1. Does the sol exist?
  const sol = await pool.request().query(`
    SELECT idnk10_k10, sol_no_k10, uptime_k10
    FROM k10_tab WHERE sol_no_k10 LIKE 'SPE2DP-26-T-2975%'
  `);
  console.log("k10 matches for SPE2DP-26-T-2975:", sol.recordset.length);
  for (const r of sol.recordset as any[]) console.log(" ", JSON.stringify(r));

  if (sol.recordset.length === 0) {
    console.log("\nSol not in LamLinks. Check what we know about this NSN in k08:");
    const k08 = await pool.request().query(`
      SELECT TOP 5 idnk08_k08, niin_k08, fsc_k08, partno_k08, p_cage_k08, p_desc_k08
      FROM k08_tab WHERE niin_k08 LIKE '%5787887%'
    `);
    for (const r of k08.recordset as any[]) console.log(" ", JSON.stringify(r));
    await pool.close();
    return;
  }

  const idnk10 = sol.recordset[0].idnk10_k10;

  // 2. Show k11 lines under that sol
  const k11 = await pool.request().query(`
    SELECT k11.idnk11_k11, k11.itemno_k11, k11.solqty_k11, k11.sol_um_k11,
           k08.idnk08_k08, k08.niin_k08, k08.fsc_k08, k08.partno_k08, k08.p_cage_k08
    FROM k11_tab k11
    INNER JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
    WHERE k11.idnk10_k11 = ${idnk10}
  `);
  console.log(`\nk11 lines under idnk10=${idnk10}:`);
  for (const r of k11.recordset as any[]) console.log(" ", JSON.stringify(r));

  await pool.close();
}
main().catch(console.error);
