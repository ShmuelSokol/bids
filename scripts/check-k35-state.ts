import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  console.log("k35 MAX and recent highest:");
  const r = await pool.request().query(`SELECT TOP 20 idnk35_k35 FROM k35_tab ORDER BY idnk35_k35 DESC`);
  for (const row of r.recordset as any[]) console.log(`  ${row.idnk35_k35}`);

  // Our orphan k35s
  console.log("\nOur orphan k35 503388, 503389 and their k34 parent:");
  const mine = await pool.request().query(`SELECT idnk35_k35, idnk34_k35, qty_k35, up_k35 FROM k35_tab WHERE idnk35_k35 IN (503388, 503389)`);
  for (const r of mine.recordset as any[]) console.log(" ", JSON.stringify(r));

  // Probe neighborhood
  console.log("\nk35 occupancy 503383..503395:");
  const n = await pool.request().query(`SELECT idnk35_k35 FROM k35_tab WHERE idnk35_k35 BETWEEN 503383 AND 503395 ORDER BY idnk35_k35`);
  const taken = new Set(n.recordset.map((x: any) => x.idnk35_k35));
  for (let id = 503383; id <= 503395; id++) {
    console.log(`  ${id}: ${taken.has(id) ? "TAKEN" : "free"}`);
  }

  await pool.close();
}
main().catch(console.error);
