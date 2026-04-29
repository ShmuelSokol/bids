import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  for (const t of ["k79_tab", "k71_tab", "k08_tab", "k80_tab", "k81_tab", "kad_tab", "kae_tab"]) {
    const c = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}' ORDER BY ORDINAL_POSITION`);
    console.log(`${t}: ${c.recordset.map((r:any)=>r.COLUMN_NAME).join(", ")}`);
  }
  await pool.close();
})();
