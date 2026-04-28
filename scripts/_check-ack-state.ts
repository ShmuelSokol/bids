import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Distribution of a_stat for Abe's recent envelopes
  const r = await pool.request().query(`
    SELECT
      LTRIM(RTRIM(a_stat_k33)) AS ack_state,
      LTRIM(RTRIM(t_stat_k33)) AS xmit_state,
      COUNT(*) AS n
    FROM k33_tab
    WHERE upname_k33 = 'ajoseph'
      AND uptime_k33 >= DATEADD(DAY, -30, GETDATE())
    GROUP BY LTRIM(RTRIM(a_stat_k33)), LTRIM(RTRIM(t_stat_k33))
    ORDER BY n DESC
  `);
  console.log("ajoseph last 30 days — a_stat × t_stat distribution:");
  console.table(r.recordset);

  // Specifically: of envelopes that are 'sent', how many ever flipped to 'acknowledged'?
  const r2 = await pool.request().query(`
    SELECT TOP 10 idnk33_k33, qotref_k33, t_stat_k33, a_stat_k33, t_stme_k33, a_stme_k33
    FROM k33_tab
    WHERE upname_k33 = 'ajoseph' AND LTRIM(RTRIM(t_stat_k33)) = 'sent'
    ORDER BY t_stme_k33 DESC
  `);
  console.log("\nLast 10 sent envelopes:");
  console.table(r2.recordset);

  await pool.close();
})();
