import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Find kajs for today's invoices via the kad→k80→kaj chain, plus their full state
  const r = await pool.request().query(`
    SELECT
      kad.idnkad_kad, LTRIM(RTRIM(kad.cinnum_kad)) AS cinnum,
      kad.uptime_kad,
      kad.upname_kad,
      kaj.idnkaj_kaj, LTRIM(RTRIM(kaj.shpnum_kaj)) AS shpnum, LTRIM(RTRIM(kaj.shpsta_kaj)) AS shpsta,
      LTRIM(RTRIM(ISNULL(kaj.packed_kaj, ''))) AS packed,
      kaj.uptime_kaj, kaj.shptme_kaj,
      LTRIM(RTRIM(k80.rlssta_k80)) AS k80_rlssta,
      k80.rlsdte_k80
    FROM kad_tab kad
    JOIN kae_tab kae ON kae.idnkad_kae = kad.idnkad_kad
    LEFT JOIN k80_tab k80 ON k80.idnk79_k80 IN (
      SELECT k79.idnk79_k79 FROM k79_tab k79 WHERE LTRIM(RTRIM(k79.cntrct_k79)) IN (
        SELECT LEFT(LTRIM(RTRIM(kad2.cinnum_kad)), 0) FROM kad_tab kad2 WHERE 1=0
      )
    )
    LEFT JOIN kaj_tab kaj ON kaj.idnk80_kaj = k80.idnk80_k80
    WHERE kad.idnk31_kad = 203 AND CAST(kad.cisdte_kad AS DATE) = CAST(GETDATE() AS DATE)
    GROUP BY kad.idnkad_kad, kad.cinnum_kad, kad.uptime_kad, kad.upname_kad,
             kaj.idnkaj_kaj, kaj.shpnum_kaj, kaj.shpsta_kaj, kaj.packed_kaj,
             kaj.uptime_kaj, kaj.shptme_kaj, k80.rlssta_k80, k80.rlsdte_k80
    ORDER BY kad.idnkad_kad
  `);
  // The above join chain is hard; do it differently — use kbr to find linked kaj
  const better = await pool.request().query(`
    SELECT
      kad.idnkad_kad, LTRIM(RTRIM(kad.cinnum_kad)) AS cinnum,
      LTRIM(RTRIM(kad.cinsta_kad)) AS cinsta,
      kbr.idnitt_kbr AS idnkaj,
      LTRIM(RTRIM(kaj.shpsta_kaj)) AS kaj_shpsta,
      LTRIM(RTRIM(ISNULL(kaj.packed_kaj, ''))) AS packed,
      LTRIM(RTRIM(k80.rlssta_k80)) AS k80_rlssta,
      LTRIM(RTRIM(kad.upname_kad)) AS posted_by
    FROM kad_tab kad
    LEFT JOIN kbr_tab kbr ON kbr.itttbl_kbr = 'kaj' AND kbr.idnkap_kbr = 24
      AND kbr.addtme_kbr BETWEEN DATEADD(MINUTE, -3, kad.uptime_kad) AND DATEADD(MINUTE, 5, kad.uptime_kad)
    LEFT JOIN kaj_tab kaj ON kaj.idnkaj_kaj = kbr.idnitt_kbr
    LEFT JOIN k80_tab k80 ON k80.idnk80_k80 = kaj.idnk80_kaj
    WHERE kad.idnk31_kad = 203 AND CAST(kad.cisdte_kad AS DATE) = CAST(GETDATE() AS DATE)
    ORDER BY kad.idnkad_kad
  `);
  console.log("=== Today's DD219 kad rows + linked kaj/k80 state ===");
  for (const row of better.recordset) {
    console.log(`  kad=${row.idnkad_kad} ${row.cinnum} cinsta=${row.cinsta} | kaj=${row.idnkaj} shpsta=${row.kaj_shpsta} packed=${row.packed} | k80.rlssta=${row.k80_rlssta} | by=${row.posted_by}`);
  }
  await pool.close();
})();
