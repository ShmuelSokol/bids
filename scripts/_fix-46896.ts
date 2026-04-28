import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });
  // Before
  const before = await pool.request().query(`SELECT idnk33_k33, qotref_k33, o_stat_k33, t_stat_k33, uptime_k33 FROM k33_tab WHERE idnk33_k33 = 46896`);
  console.log("BEFORE:", JSON.stringify(before.recordset[0], null, 2));
  // UPDATE — only flip o_stat, leave t_stat so daemon transmits
  const res = await pool.request().query(`UPDATE k33_tab SET o_stat_k33 = 'quotes added', uptime_k33 = GETDATE() WHERE idnk33_k33 = 46896`);
  console.log(`Rows affected: ${res.rowsAffected?.[0]}`);
  const after = await pool.request().query(`SELECT idnk33_k33, qotref_k33, o_stat_k33, t_stat_k33, uptime_k33 FROM k33_tab WHERE idnk33_k33 = 46896`);
  console.log("AFTER:", JSON.stringify(after.recordset[0], null, 2));
  await pool.close();
})();
