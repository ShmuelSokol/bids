import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Our test: kad=297401, cinnum=0066186, kaj=353349
  // Find shipment number
  const shpQ = await pool.request().query(`SELECT shpnum_kaj FROM kaj_tab WHERE idnkaj_kaj = 353349`);
  const shpnum = String(shpQ.recordset[0]?.shpnum_kaj || "").trim();
  const contract = "SPE2DS-26-V-4743";
  const log810 = `WAWF 810 for ${contract}, invoice '0066186, shipment ${shpnum} has been uploaded to the Lamlinks Corp Server`;
  const log856 = `WAWF 856 for , invoice ', shipment  has been uploaded to the Lamlinks Corp Server`;
  for (const msg of [log810, log856]) {
    const m80 = msg.slice(0, 80).replace(/'/g, "''");
    const r = await pool.request().query(`
      INSERT INTO k20_tab (uptime_k20, upname_k20, susnam_k20, msgtno_k20, msgcls_k20, logmsg_k20, llptyp_k20, idnllp_k20, logtxt_k20)
      OUTPUT inserted.idnk20_k20 AS newId
      VALUES (GETDATE(), 'ajoseph   ', 'WAWF_edi_upload', 102, 'routine', '${m80}', '', 0, '${msg.replace(/'/g, "''")}')
    `);
    console.log(`  ✓ k20 ${r.recordset[0].newId}: ${m80}`);
  }
  await pool.close();
})();
