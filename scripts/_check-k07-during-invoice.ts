import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Did k07 get bumped by ajoseph in the window of today's invoice (16:35-16:37)?
  // The bid flow bumps SOL_FORM_PREFERENCES. Invoice flow may bump a different ss_key.
  const r = await pool.request().query(`
    SELECT TOP 30 idnk07_k07, uptime_k07, upname_k07, ss_key_k07, ss_tid_k07, ss_val_k07
    FROM k07_tab
    WHERE LTRIM(RTRIM(upname_k07)) = 'ajoseph'
      AND uptime_k07 BETWEEN '2026-04-28T16:30:00' AND '2026-04-28T16:42:00'
    ORDER BY uptime_k07 DESC
  `);
  console.log(`k07 bumps by ajoseph 16:30-16:42 today: ${r.recordset.length}`);
  for (const row of r.recordset) {
    console.log(`  ${row.uptime_k07.toISOString()} ss_key=${String(row.ss_key_k07).trim()} ss_tid=${String(row.ss_tid_k07).trim()} ss_val=${String(row.ss_val_k07).trim().slice(0,40)}`);
  }

  // What ss_key values are used? Group by
  const keys = await pool.request().query(`
    SELECT LTRIM(RTRIM(ss_key_k07)) AS k, COUNT(*) AS n
    FROM k07_tab WHERE LTRIM(RTRIM(upname_k07)) = 'ajoseph'
    AND uptime_k07 >= DATEADD(DAY, -2, GETDATE())
    GROUP BY LTRIM(RTRIM(ss_key_k07))
    ORDER BY n DESC
  `);
  console.log("\n=== distinct ss_key values for ajoseph (last 2 days) ===");
  for (const row of keys.recordset) console.log(`  ${row.k}: ${row.n}`);

  await pool.close();
})();
