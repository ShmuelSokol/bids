import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Check 495750-495760 occupancy
  console.log("k34 occupancy 495748-495760:");
  const r = await pool.request().query(`SELECT idnk34_k34 FROM k34_tab WHERE idnk34_k34 BETWEEN 495748 AND 495760 ORDER BY idnk34_k34`);
  const taken = new Set(r.recordset.map((x: any) => x.idnk34_k34));
  for (let id = 495748; id <= 495760; id++) {
    console.log(`  ${id}: ${taken.has(id) ? "TAKEN" : "free"}`);
  }

  // Find gaps in the full k34 history — any holes we could drop orphans into?
  console.log("\nSearching for recent gaps in k34 (last 10 gaps)...");
  const gaps = await pool.request().query(`
    WITH Nums AS (
      SELECT TOP 100 idnk34_k34 FROM k34_tab ORDER BY idnk34_k34 DESC
    ), Paired AS (
      SELECT idnk34_k34, LEAD(idnk34_k34) OVER (ORDER BY idnk34_k34 DESC) AS next_lower
      FROM Nums
    )
    SELECT next_lower + 1 AS gap_start, idnk34_k34 - 1 AS gap_end
    FROM Paired
    WHERE next_lower IS NOT NULL AND idnk34_k34 - next_lower > 1
  `);
  for (const g of gaps.recordset as any[]) {
    console.log(`  gap: ${g.gap_start}..${g.gap_end}`);
  }

  await pool.close();
}
main().catch(console.error);
