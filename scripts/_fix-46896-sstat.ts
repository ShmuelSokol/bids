import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });
  await pool.request().query(`UPDATE k33_tab SET s_stat_k33='quotes added', s_stme_k33=GETDATE(), uptime_k33=GETDATE() WHERE idnk33_k33=46896`);
  const after = await pool.request().query(`SELECT idnk33_k33, o_stat_k33, t_stat_k33, s_stat_k33, t_stme_k33 FROM k33_tab WHERE idnk33_k33=46896`);
  console.log("AFTER:", JSON.stringify(after.recordset[0], null, 2));
  await pool.close();
})();
