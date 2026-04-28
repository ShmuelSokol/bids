import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Recent kad inserts by ajoseph
  const r = await pool.request().query(`
    SELECT TOP 10 idnkad_kad, cinnum_kad, cin_no_kad, cinsta_kad, cisdte_kad, mslval_kad, uptime_kad
    FROM kad_tab
    WHERE LTRIM(RTRIM(upname_kad)) = 'ajoseph'
      AND uptime_kad >= DATEADD(MINUTE, -15, GETDATE())
    ORDER BY uptime_kad DESC
  `);
  console.log(`ajoseph kad inserts last 15 min: ${r.recordset.length}`);
  for (const k of r.recordset) {
    console.log(`  kad=${k.idnkad_kad} cinnum=${String(k.cinnum_kad).trim()} cin_no=${String(k.cin_no_kad).trim()} state=${String(k.cinsta_kad).trim()} $${k.mslval_kad} time=${k.uptime_kad.toISOString()}`);
  }
  // Also recent kbr by ajoseph
  const k = await pool.request().query(`
    SELECT TOP 10 idnkbr_kbr, idnitt_kbr, idnkap_kbr, xtcscn_kbr, xtcsta_kbr, addtme_kbr
    FROM kbr_tab
    WHERE LTRIM(RTRIM(addnme_kbr)) = 'ajoseph'
      AND addtme_kbr >= DATEADD(MINUTE, -15, GETDATE())
    ORDER BY idnkbr_kbr DESC
  `);
  console.log(`\najoseph kbr inserts last 15 min: ${k.recordset.length}`);
  for (const r of k.recordset) {
    console.log(`  kbr=${r.idnkbr_kbr} kaj=${r.idnitt_kbr} kap=${r.idnkap_kbr} xtcscn=${String(r.xtcscn_kbr).trim()} sta=${String(r.xtcsta_kbr).trim()}`);
  }
  await pool.close();
})();
