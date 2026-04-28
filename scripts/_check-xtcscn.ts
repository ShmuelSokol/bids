import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Exact char length of xtcscn_kbr
  const cols = await pool.request().query(`
    SELECT name, max_length FROM sys.columns WHERE object_id = OBJECT_ID('kbr_tab')
      AND name IN ('xtcscn_kbr','xtcsta_kbr','itttbl_kbr','addnme_kbr')
  `);
  console.table(cols.recordset);

  // What's stored in xtcscn for 856 rows? (My filter dropped 0-values; show raw)
  const r = await pool.request().query(`
    SELECT TOP 6 idnkbr_kbr, idnkap_kbr, '|' + xtcscn_kbr + '|' AS scn_raw, LEN(xtcscn_kbr) AS scn_len, xtcsta_kbr
    FROM kbr_tab WHERE addnme_kbr = 'ajoseph   ' AND idnkap_kbr IN (24, 25)
    ORDER BY idnkbr_kbr DESC
  `);
  console.log("\n=== xtcscn raw values (6 most recent) ===");
  for (const row of r.recordset) {
    console.log(`  kbr=${row.idnkbr_kbr} kap=${row.idnkap_kbr} xtcscn=${row.scn_raw} len=${row.scn_len} sta="${String(row.xtcsta_kbr).trim()}"`);
  }

  // Max xtcscn_kbr + sample increment
  const max = await pool.request().query(`
    SELECT TOP 10 idnkbr_kbr, idnkap_kbr, xtcscn_kbr, addtme_kbr
    FROM kbr_tab WHERE idnkap_kbr = 24
    ORDER BY idnkbr_kbr DESC
  `);
  console.log("\n=== Last 10 xtcscn for kap=24 (WAWF 810) ===");
  for (const row of max.recordset) {
    console.log(`  kbr=${row.idnkbr_kbr} xtcscn=${String(row.xtcscn_kbr).trim()} time=${row.addtme_kbr.toISOString()}`);
  }

  await pool.close();
})();
