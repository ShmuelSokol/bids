import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Compare ALL kaj fields including blanks/zeros
  const our = (await pool.request().query(`SELECT * FROM kaj_tab WHERE idnkaj_kaj = 353349`)).recordset[0];
  const abe = (await pool.request().query(`SELECT * FROM kaj_tab WHERE idnkaj_kaj = 353327`)).recordset[0];
  console.log("=== kaj diff INCLUDING blanks/zeros ===");
  for (const k of Object.keys(our).sort()) {
    const a = String(our[k] ?? "").trim();
    const b = String(abe[k] ?? "").trim();
    if (a === b) continue;
    if (["idnkaj_kaj","uptime_kaj","idnk80_kaj","shptme_kaj","insdte_kaj"].includes(k)) continue;
    console.log(`  ${k}: ours="${a}" abe="${b}"`);
  }
  // ka6/kbb/kaw rows for our kaj at the time we wrote
  console.log("\n=== Tables touched in last 10 min by ANYONE (system included) ===");
  for (const t of ["kbb_tab", "ka4_tab", "kaw_tab"]) {
    const cols = await pool.request().query(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('${t}')`);
    const colNames = cols.recordset.map((r:any) => r.name);
    const time = colNames.find((n:string) => /addtme|uptime/.test(n));
    if (!time) continue;
    const r = await pool.request().query(`
      SELECT TOP 5 * FROM ${t} WHERE ${time} >= DATEADD(MINUTE, -15, GETDATE()) ORDER BY ${time} DESC
    `);
    if (r.recordset.length === 0) continue;
    console.log(`\n${t}:`);
    for (const row of r.recordset.slice(0,3)) {
      const summary = Object.entries(row).filter(([_, v]) => v != null && v !== "" && v !== 0).map(([k,v]) => `${k}=${String(v).trim().slice(0,30)}`).join(" ");
      console.log(`  ${summary}`);
    }
  }
  await pool.close();
})();
