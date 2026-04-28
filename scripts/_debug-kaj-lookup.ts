import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  const contract = "SPE2DS-26-V-4743";
  const total = 43.77;

  // Step 1: k79 lookup
  const k79 = await pool.request().query(`
    SELECT idnk79_k79, cntrct_k79, idnk31_k79
    FROM k79_tab WHERE LTRIM(RTRIM(cntrct_k79)) = '${contract}'
  `);
  console.log(`k79 for ${contract}: ${k79.recordset.length} row(s)`);
  for (const r of k79.recordset) console.log(`  idnk79=${r.idnk79_k79} cntrct=${String(r.cntrct_k79).trim()} k31=${r.idnk31_k79}`);

  // Step 2: k80 lookup with various relext values
  if (k79.recordset.length > 0) {
    const idnk79 = k79.recordset[0].idnk79_k79;
    const k80 = await pool.request().query(`
      SELECT idnk80_k80, idnk79_k80, relext_k80, rlssta_k80, rlsdte_k80
      FROM k80_tab WHERE idnk79_k80 = ${idnk79}
      ORDER BY idnk80_k80 DESC
    `);
    console.log(`\nk80 rows for idnk79=${idnk79}: ${k80.recordset.length}`);
    for (const r of k80.recordset) {
      console.log(`  idnk80=${r.idnk80_k80} relext=$${r.relext_k80} rlssta=${String(r.rlssta_k80 || "").trim()} rlsdte=${r.rlsdte_k80?.toISOString?.()}`);
    }

    // Step 3: kaj for these k80s
    const kaj = await pool.request().query(`
      SELECT idnkaj_kaj, idnk80_kaj, shpnum_kaj, shpsta_kaj, uptime_kaj
      FROM kaj_tab
      WHERE idnk80_kaj IN (SELECT idnk80_k80 FROM k80_tab WHERE idnk79_k80 = ${idnk79})
    `);
    console.log(`\nkaj rows linked to those k80s: ${kaj.recordset.length}`);
    for (const r of kaj.recordset) {
      console.log(`  idnkaj=${r.idnkaj_kaj} idnk80=${r.idnk80_kaj} shp=${String(r.shpnum_kaj).trim()} sta=${String(r.shpsta_kaj).trim()}`);
    }
  }
  await pool.close();
})();
