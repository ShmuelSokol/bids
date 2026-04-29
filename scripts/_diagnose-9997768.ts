import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // What is k07 row 1585?
  console.log("=== k07_tab idnk07=1585 ===");
  const r = await pool.request().query(`SELECT * FROM k07_tab WHERE idnk07_k07 = 1585`);
  if (r.recordset.length > 0) {
    for (const [k, v] of Object.entries(r.recordset[0])) {
      console.log(`  ${k.padEnd(15)} = ${v instanceof Date ? v.toISOString() : String(v).slice(0, 100)}`);
    }
  } else {
    console.log("  NO ROW FOUND");
  }

  // Recent k07 updates (last 10 min)
  console.log("\n=== k07 rows touched in last 10 min ===");
  const recent = await pool.request().query(`
    SELECT idnk07_k07, LTRIM(RTRIM(ss_key_k07)) AS k, LTRIM(RTRIM(ss_tid_k07)) AS tid,
           LTRIM(RTRIM(upname_k07)) AS upname, LTRIM(RTRIM(ss_val_k07)) AS v, uptime_k07
    FROM k07_tab
    WHERE uptime_k07 >= DATEADD(minute, -10, GETDATE())
    ORDER BY uptime_k07 DESC
  `);
  for (const row of recent.recordset.slice(0, 15)) {
    console.log(`  k07=${row.idnk07_k07} ${row.uptime_k07?.toISOString?.()} key="${row.k}" tid=${row.tid} up=${row.upname} v="${row.v.slice(0,40)}"`);
  }

  // What are the related rows for SOL_FORM_PREFERENCES specifically (the row our worker bumps)
  console.log("\n=== All SOL_FORM_PREFERENCES rows ===");
  const sfp = await pool.request().query(`
    SELECT idnk07_k07, LTRIM(RTRIM(ss_tid_k07)) AS tid, LTRIM(RTRIM(upname_k07)) AS upname, uptime_k07
    FROM k07_tab WHERE LTRIM(RTRIM(ss_key_k07)) = 'SOL_FORM_PREFERENCES'
  `);
  for (const row of sfp.recordset) {
    console.log(`  k07=${row.idnk07_k07} tid=${row.tid} up=${row.upname} updated=${row.uptime_k07?.toISOString?.()}`);
  }
  await pool.close();
})().catch(e => { console.error(e); process.exit(1); });
