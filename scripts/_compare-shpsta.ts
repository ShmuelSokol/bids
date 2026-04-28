import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  const r = await pool.request().query(`
    SELECT idnkaj_kaj, '|' + shpsta_kaj + '|' AS shpsta_raw, LEN(shpsta_kaj) AS len, packed_kaj, podcod_kaj, bolnum_kaj
    FROM kaj_tab WHERE idnkaj_kaj IN (353349, 353350, 353337, 353333, 353329, 353327, 353275, 353326)
    ORDER BY idnkaj_kaj
  `);
  console.log("=== kaj shpsta values ===");
  for (const row of r.recordset) {
    console.log(`  kaj=${row.idnkaj_kaj} shpsta=${row.shpsta_raw} (len=${row.len}) packed=${String(row.packed_kaj || "").trim()} pod=${String(row.podcod_kaj || "").trim()} bol=${String(row.bolnum_kaj || "").trim()}`);
  }
  // Also: distinct shpsta values across all today's kajs
  const dist = await pool.request().query(`
    SELECT DISTINCT LTRIM(RTRIM(shpsta_kaj)) AS shpsta, COUNT(*) AS n
    FROM kaj_tab WHERE uptime_kaj >= DATEADD(DAY, -7, GETDATE())
    GROUP BY LTRIM(RTRIM(shpsta_kaj))
  `);
  console.log("\n=== distinct shpsta values, last 7 days ===");
  for (const d of dist.recordset) console.log(`  ${d.shpsta || "(empty)"}: ${d.n}`);
  await pool.close();
})();
