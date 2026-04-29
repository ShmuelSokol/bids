import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Looking for ka7 rows tied to our test invoice (kaj=353349, consignee N2999C)
  console.log("=== ka7 rows for CAGE=N2999C ===");
  const r = await pool.request().query(`
    SELECT TOP 10 idnka7_ka7, idnk12_ka7, LTRIM(RTRIM(gduset_ka7)) AS gduset,
           LTRIM(RTRIM(d_code_ka7)) AS code, LTRIM(RTRIM(d_name_ka7)) AS name,
           LTRIM(RTRIM(d_adr1_ka7)) AS adr1, LTRIM(RTRIM(d_city_ka7)) AS city,
           LTRIM(RTRIM(d_stte_ka7)) AS stte, LTRIM(RTRIM(d_zipc_ka7)) AS zipc
    FROM ka7_tab
    WHERE LTRIM(RTRIM(d_code_ka7)) = 'N2999C'
    ORDER BY idnka7_ka7 DESC
  `);
  console.log(`Found ${r.recordset.length} rows`);
  for (const row of r.recordset.slice(0, 5)) {
    console.log(`  k12=${row.idnk12_ka7} qualifier="${row.gduset}" name="${row.name}" adr1="${row.adr1}" city="${row.city}" ${row.stte} ${row.zipc}`);
  }

  // For OUR specific kaj=353349, find linked ka7 rows. Start from kaj and walk back
  console.log("\n=== ka7 rows linked to kaj=353349 (via k12) ===");
  const link = await pool.request().query(`
    SELECT TOP 20 ka7.idnka7_ka7, ka7.idnk12_ka7, LTRIM(RTRIM(ka7.gduset_ka7)) AS gduset,
           LTRIM(RTRIM(ka7.d_code_ka7)) AS code, LTRIM(RTRIM(ka7.d_name_ka7)) AS name
    FROM ka7_tab ka7
    INNER JOIN ka9_tab ka9 ON ka9.idnk12_ka9 = ka7.idnk12_ka7
    WHERE ka9.idnkaj_ka9 = 353349
    ORDER BY ka7.idnka7_ka7
  `).catch(async () => {
    // Try alternative path via kaj.idnk12_kaj or similar
    return await pool.request().query(`
      SELECT TOP 20 ka7.idnka7_ka7, ka7.idnk12_ka7, LTRIM(RTRIM(ka7.gduset_ka7)) AS gduset,
             LTRIM(RTRIM(ka7.d_code_ka7)) AS code, LTRIM(RTRIM(ka7.d_name_ka7)) AS name
      FROM ka7_tab ka7
      INNER JOIN ka6_tab ka6 ON ka6.idnka7_ka6 = ka7.idnka7_ka7
      WHERE LTRIM(RTRIM(ka6.gdutbl_ka6)) = 'kaj' AND ka6.idngdu_ka6 = 353349
      ORDER BY ka7.idnka7_ka7
    `).catch(() => null);
  });
  if (link) {
    console.log(`Found ${link.recordset.length} ka7 rows linked to our kaj`);
    for (const row of link.recordset) {
      console.log(`  k12=${row.idnk12_ka7} qualifier="${row.gduset}" code="${row.code}" name="${row.name}"`);
    }
  } else {
    console.log("No link path found — try via ka6_tab.gdutbl='kaj'");
  }

  await pool.close();
})().catch(e => { console.error(e); process.exit(1); });
