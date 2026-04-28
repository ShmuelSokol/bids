import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  const tables = ["kbr_tab", "kaj_tab", "k20_tab", "kbb_tab", "ka4_tab", "ka6_tab", "kaw_tab"];
  for (const t of tables) {
    const cols = await pool.request().query(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('${t}')`);
    const colNames = cols.recordset.map((r:any) => r.name);
    const uptime = colNames.find((n:string) => n.startsWith("uptime_") || n.startsWith("addtme_"));
    if (!uptime) continue;
    try {
      const r = await pool.request().query(`
        SELECT TOP 5 * FROM ${t}
        WHERE ${uptime} >= DATEADD(MINUTE, -15, GETDATE())
        ORDER BY ${uptime} DESC
      `);
      if (r.recordset.length === 0) continue;
      console.log(`\n=== ${t} (${r.recordset.length} rows) ===`);
      for (const row of r.recordset) {
        const tag = t.replace("_tab","");
        const idCol = Object.keys(row).find(k => k.startsWith("idn") && k.endsWith(`_${tag}`));
        console.log(`  --- ${idCol}=${row[idCol!]} ---`);
        for (const k of Object.keys(row)) {
          const v = row[k];
          if (v == null || v === "" || v === 0) continue;
          const s = v instanceof Date ? v.toISOString() : String(v).trim().slice(0, 80);
          if (s) console.log(`    ${k} = ${s}`);
        }
      }
    } catch (e: any) { console.log(`${t}: ${e.message?.slice(0,80)}`); }
  }
  await pool.close();
})();
