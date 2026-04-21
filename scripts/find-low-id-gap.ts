import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  console.log("Looking for gaps in k34_tab PK sequence...");
  const r = await pool.request().query(`
    SELECT MIN(idnk34_k34) AS min_id, MAX(idnk34_k34) AS max_id, COUNT(*) AS cnt FROM k34_tab
  `);
  console.log(`  ${JSON.stringify(r.recordset[0])}`);

  // Check a handful of candidate low ids for being FREE
  console.log("\nProbing candidate low ids...");
  for (const test of [1, 10, 100, 500, 1000, 5000, 10000, 50000, 100000]) {
    const chk = await pool.request().query(`SELECT COUNT(*) AS c FROM k34_tab WHERE idnk34_k34 = ${test}`);
    console.log(`  idnk34=${test}: ${chk.recordset[0].c > 0 ? "TAKEN" : "FREE"}`);
  }
  console.log("\nAlso for k35:");
  for (const test of [1, 10, 100, 500, 1000, 5000, 10000, 50000, 100000]) {
    const chk = await pool.request().query(`SELECT COUNT(*) AS c FROM k35_tab WHERE idnk35_k35 = ${test}`);
    console.log(`  idnk35=${test}: ${chk.recordset[0].c > 0 ? "TAKEN" : "FREE"}`);
  }

  await pool.close();
}
main().catch(console.error);
