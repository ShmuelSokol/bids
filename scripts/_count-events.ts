import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;" });
  for (const prefix of ["dibs_ll_trace", "dibs_ll_trace_server"]) {
    const path = "D:\MSSQL11.MSSQLSERVER\MSSQL\LOG\\" + prefix + "*.xel";
    try {
      const r = await pool.request().input("p", sql.VarChar, path).query("SELECT COUNT(*) AS c FROM sys.fn_xe_file_target_read_file(@p, NULL, NULL, NULL)");
      console.log(prefix + ": " + r.recordset[0].c + " events");
    } catch (e: any) {
      console.log(prefix + ": ERR " + (e.message || "").slice(0, 120));
    }
  }
  await pool.close();
})();
