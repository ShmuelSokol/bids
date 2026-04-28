import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // For the last 10 DD219 invoices, find the linked kaj (via the kbr WAWF
  // 810 record — kbr.itttbl='kaj', kbr.idnitt=<kaj>) and check whether the
  // kaj was created BEFORE the kad. If yes, Abe doesn't create kaj — he
  // reuses an existing warehouse-created shipment.
  const kads = await pool.request().query(`
    SELECT TOP 10 idnkad_kad, uptime_kad, cin_no_kad, cinnum_kad, mslval_kad
    FROM kad_tab WHERE idnk31_kad = 203
    ORDER BY uptime_kad DESC
  `);
  for (const k of kads.recordset) {
    // Find kbr for this invoice — kbr stores invoice link via xtcscn=cin_no?
    // Our trace showed: kbr.itttbl='kaj', kbr.idnitt=<kaj_id>.
    // But which kbr belongs to which kad? Look at the row inserted right after kad.
    const kbr = await pool.request().query(`
      SELECT TOP 5 idnkbr_kbr, idnitt_kbr, idnkap_kbr, xtcscn_kbr, xtcsta_kbr, addtme_kbr
      FROM kbr_tab
      WHERE itttbl_kbr = 'kaj'
        AND addtme_kbr BETWEEN DATEADD(MINUTE, -2, '${k.uptime_kad.toISOString()}') AND DATEADD(MINUTE, 5, '${k.uptime_kad.toISOString()}')
        AND idnkap_kbr IN (24, 25)
    `);
    console.log(`\nkad=${k.idnkad_kad} cin_no=${String(k.cin_no_kad).trim()} cinnum=${String(k.cinnum_kad).trim()} $${k.mslval_kad}  uptime=${k.uptime_kad.toISOString()}`);
    if (kbr.recordset.length === 0) { console.log("  (no kbr nearby)"); continue; }
    for (const r of kbr.recordset) {
      // For each kbr, fetch the kaj and compare timestamps
      const kaj = await pool.request().query(`SELECT TOP 1 idnkaj_kaj, uptime_kaj, shpnum_kaj, shpsta_kaj, idnk80_kaj FROM kaj_tab WHERE idnkaj_kaj = ${r.idnitt_kbr}`);
      const kj = kaj.recordset[0];
      if (!kj) continue;
      const kajPrecedes = kj.uptime_kaj < k.uptime_kad;
      const ageMin = Math.round((k.uptime_kad.getTime() - kj.uptime_kaj.getTime()) / 60000);
      console.log(`  kbr=${r.idnkbr_kbr} kap=${r.idnkap_kbr} (${String(r.xtcsta_kbr).trim()}) → kaj=${kj.idnkaj_kaj} shpnum=${String(kj.shpnum_kaj).trim()} shpsta=${String(kj.shpsta_kaj).trim()} kaj.uptime=${kj.uptime_kaj.toISOString()} ${kajPrecedes ? `[kaj precedes kad by ${ageMin} min]` : "[kaj LATER than kad]"}`);
    }
  }
  await pool.close();
})();
