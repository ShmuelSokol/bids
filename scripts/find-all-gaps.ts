import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  console.log("All gaps in k34_tab (can take many seconds)...");
  const r = await pool.request().query(`
    WITH ordered AS (SELECT idnk34_k34, LAG(idnk34_k34) OVER (ORDER BY idnk34_k34) AS prev_id FROM k34_tab)
    SELECT prev_id + 1 AS gap_start, idnk34_k34 - 1 AS gap_end, (idnk34_k34 - prev_id - 1) AS gap_size
    FROM ordered WHERE idnk34_k34 - prev_id > 1 ORDER BY idnk34_k34 DESC
  `);
  console.log(`Found ${r.recordset.length} gaps:`);
  for (const g of r.recordset.slice(0, 30) as any[]) {
    console.log(`  ${g.gap_start}..${g.gap_end}  (size ${g.gap_size})`);
  }

  console.log("\nSame for k35_tab...");
  const r35 = await pool.request().query(`
    WITH ordered AS (SELECT idnk35_k35, LAG(idnk35_k35) OVER (ORDER BY idnk35_k35) AS prev_id FROM k35_tab)
    SELECT prev_id + 1 AS gap_start, idnk35_k35 - 1 AS gap_end, (idnk35_k35 - prev_id - 1) AS gap_size
    FROM ordered WHERE idnk35_k35 - prev_id > 1 ORDER BY idnk35_k35 DESC
  `);
  console.log(`Found ${r35.recordset.length} gaps in k35:`);
  for (const g of r35.recordset.slice(0, 30) as any[]) {
    console.log(`  ${g.gap_start}..${g.gap_end}  (size ${g.gap_size})`);
  }

  await pool.close();
}
main().catch(console.error);
