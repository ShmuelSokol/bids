import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Check all k11 columns
  const k11cols = await pool.request().query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='k11_tab' ORDER BY ORDINAL_POSITION
  `);
  console.log("k11 columns:", k11cols.recordset.map((r:any)=>r.COLUMN_NAME).join(", "));

  // For SPE2DS-26-T-021R, idnk10=1778451
  const k11 = await pool.request().query(`
    SELECT * FROM k11_tab WHERE idnk10_k11 = 1778451
  `);
  console.log(`\nk11 rows: ${k11.recordset.length}`);
  if (k11.recordset.length) console.log("first row keys:", Object.keys(k11.recordset[0]).join(", "));

  // k32 (CLIN-level data per writeback memory)
  const k32cols = await pool.request().query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='k32_tab' ORDER BY ORDINAL_POSITION
  `);
  console.log("\nk32 columns:", k32cols.recordset.map((r:any)=>r.COLUMN_NAME).join(", "));
  const k32 = await pool.request().query(`
    SELECT * FROM k32_tab WHERE idnk11_k32 IN (SELECT idnk11_k11 FROM k11_tab WHERE idnk10_k11 = 1778451)
  `);
  console.log(`k32 rows for sol: ${k32.recordset.length}`);
  if (k32.recordset.length) console.table(k32.recordset.slice(0, 6));

  await pool.close();
})();
