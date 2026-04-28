import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;" });
  for (const name of ["dibs_ll_trace", "dibs_ll_trace_server"]) {
    const running = await pool.request().query("SELECT name FROM sys.dm_xe_sessions WHERE name='" + name + "'");
    if (running.recordset.length === 0) { console.log(name + ": not running"); continue; }
    await pool.request().query("ALTER EVENT SESSION [" + name + "] ON SERVER STATE = STOP");
    await pool.request().query("DROP EVENT SESSION [" + name + "] ON SERVER");
    console.log(name + ": STOPPED + DROPPED");
  }
  await pool.close();
})();
