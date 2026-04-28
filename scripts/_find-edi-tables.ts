import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Find any table with rows from the last 15 min and ajoseph involvement
  // Limit search to "k*" tables (LL convention)
  const tables = await pool.request().query(`
    SELECT name FROM sys.tables WHERE name LIKE 'k%_tab' ORDER BY name
  `);
  for (const tr of tables.recordset) {
    const t = tr.name;
    const cols = await pool.request().query(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('${t}')`);
    const colNames = cols.recordset.map((r:any) => r.name);
    const upname = colNames.find((n:string) => n.startsWith("upname_"));
    const uptime = colNames.find((n:string) => n.startsWith("uptime_") || n.startsWith("addtme_"));
    if (!uptime) continue;
    try {
      const r = await pool.request().query(`
        SELECT COUNT(*) AS n FROM ${t}
        WHERE ${uptime} >= DATEADD(MINUTE, -15, GETDATE())
        ${upname ? `AND LTRIM(RTRIM(${upname})) = 'ajoseph'` : ""}
      `);
      const n = r.recordset[0].n;
      if (n > 0) console.log(`${t}: ${n} rows in last 15 min ${upname ? "(ajoseph)" : "(any user)"}`);
    } catch { /* skip */ }
  }
  await pool.close();
})();
