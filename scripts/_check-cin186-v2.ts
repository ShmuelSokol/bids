import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // kbr rows from the last 30 min by ajoseph
  const kbr = await pool.request().query(`
    SELECT idnkbr_kbr, idnitt_kbr AS kaj, idnkap_kbr AS kap, LTRIM(RTRIM(xtcsta_kbr)) AS sta,
           xtcscn_kbr, addtme_kbr
    FROM kbr_tab
    WHERE addnme_kbr = 'ajoseph   '
      AND addtme_kbr >= DATEADD(MINUTE, -30, GETDATE())
      AND idnkap_kbr IN (24, 25)
    ORDER BY idnkbr_kbr DESC
  `);
  console.log(`=== kbr last 30 min: ${kbr.recordset.length} ===`);
  for (const r of kbr.recordset) console.log(`  kbr=${r.idnkbr_kbr} kaj=${r.kaj} kap=${r.kap} sta=${r.sta} xtcscn=${String(r.xtcscn_kbr).trim()} time=${r.addtme_kbr.toISOString()}`);

  // Direct kaj 353349 (the one we resolved for test)
  const kaj = await pool.request().query(`SELECT * FROM kaj_tab WHERE idnkaj_kaj = 353349`);
  console.log(`\n=== kaj 353349 ===`);
  if (kaj.recordset[0]) for (const k of Object.keys(kaj.recordset[0])) {
    const v = kaj.recordset[0][k]; if (v == null || v === "" || v === 0) continue;
    console.log(`  ${k} = ${v instanceof Date ? v.toISOString() : String(v).trim().slice(0,80)}`);
  }
  await pool.close();
})();
