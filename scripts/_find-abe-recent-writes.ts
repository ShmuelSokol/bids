import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Find tables that ajoseph touched in the last 15 min
  const tables = await pool.request().query(`
    SELECT name FROM sys.tables
    WHERE EXISTS (
      SELECT 1 FROM sys.columns c WHERE c.object_id = sys.tables.object_id AND c.name LIKE 'uptime_%'
    )
    ORDER BY name
  `);
  const candidates = ["kaj_tab", "kbr_tab", "kad_tab", "ka9_tab", "kae_tab", "ka8_tab", "k89_tab", "k90_tab"];
  for (const t of candidates) {
    if (!tables.recordset.some((r:any) => r.name === t)) { console.log(`${t}: missing`); continue; }
    // Find the uptime + upname columns
    const cols = await pool.request().query(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('${t}') AND (name LIKE 'uptime_%' OR name LIKE 'upname_%')`);
    const tag = t.replace("_tab","");
    const upname = cols.recordset.find((r:any) => r.name.startsWith("upname_"))?.name;
    const uptime = cols.recordset.find((r:any) => r.name.startsWith("uptime_"))?.name;
    if (!upname || !uptime) { console.log(`${t}: no upname/uptime`); continue; }
    const r = await pool.request().query(`
      SELECT TOP 5 * FROM ${t}
      WHERE ${uptime} >= DATEADD(MINUTE, -20, GETDATE())
        AND LTRIM(RTRIM(${upname})) = 'ajoseph'
      ORDER BY ${uptime} DESC
    `);
    if (r.recordset.length === 0) { console.log(`${t}: no ajoseph writes in last 20 min`); continue; }
    console.log(`\n=== ${t} — ${r.recordset.length} ajoseph rows in last 20 min ===`);
    for (const row of r.recordset) {
      const id = Object.keys(row).find(k => k.startsWith("idn") && k.endsWith(`_${tag}`));
      const allKeys = Object.keys(row);
      // Print all non-null fields (compact)
      const nonNull = allKeys.filter(k => row[k] != null && row[k] !== "" && row[k] !== 0).slice(0, 30);
      console.log(`  ${id}=${row[id!]} ${uptime}=${row[uptime].toISOString?.() || row[uptime]}`);
      for (const k of nonNull) {
        if (k === id || k === uptime || k === upname) continue;
        const v = row[k] instanceof Date ? row[k].toISOString() : String(row[k]).trim().slice(0, 60);
        if (v) console.log(`    ${k} = ${v}`);
      }
    }
  }
  await pool.close();
})();
