import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Direct lookup of kad=297401 (our test) and its kbr+kaj
  const kad = await pool.request().query(`SELECT * FROM kad_tab WHERE idnkad_kad = 297401`);
  console.log("=== kad 297401 (our test) ===");
  if (kad.recordset[0]) for (const k of Object.keys(kad.recordset[0])) {
    const v = kad.recordset[0][k]; if (v == null || v === "" || v === 0) continue;
    console.log(`  ${k} = ${v instanceof Date ? v.toISOString() : String(v).trim().slice(0,80)}`);
  }
  // kbr for that kad — find by addtme proximity (same window we wrote in)
  const kbr = await pool.request().query(`
    SELECT idnkbr_kbr, idnitt_kbr AS kaj, idnkap_kbr AS kap, LTRIM(RTRIM(xtcsta_kbr)) AS sta, xtcscn_kbr
    FROM kbr_tab
    WHERE addnme_kbr = 'ajoseph   '
      AND addtme_kbr BETWEEN '2026-04-28T22:12:50' AND '2026-04-28T22:13:00'
      AND idnkap_kbr IN (24, 25)
  `);
  console.log("\n=== kbr inserted by us ===");
  for (const r of kbr.recordset) console.log(`  kbr=${r.idnkbr_kbr} kaj=${r.kaj} kap=${r.kap} sta=${r.sta} xtcscn=${String(r.xtcscn_kbr).trim()}`);

  // The kaj for our test
  if (kbr.recordset[0]) {
    const kajId = kbr.recordset[0].kaj;
    const kaj = await pool.request().query(`SELECT * FROM kaj_tab WHERE idnkaj_kaj = ${kajId}`);
    console.log(`\n=== kaj ${kajId} (linked to our test) ===`);
    if (kaj.recordset[0]) for (const k of Object.keys(kaj.recordset[0])) {
      const v = kaj.recordset[0][k]; if (v == null || v === "" || v === 0) continue;
      console.log(`  ${k} = ${v instanceof Date ? v.toISOString() : String(v).trim().slice(0,80)}`);
    }
    // Compare with one of Abe's manuals — kaj for CIN0066174 (kad=297393)
    // Find its kbr first
    const abeKbr = await pool.request().query(`
      SELECT TOP 1 idnitt_kbr AS kaj
      FROM kbr_tab WHERE addnme_kbr = 'ajoseph   '
        AND idnkap_kbr = 24
        AND addtme_kbr BETWEEN '2026-04-28T17:55:00' AND '2026-04-28T17:56:30'
    `);
    if (abeKbr.recordset[0]) {
      const abeKaj = await pool.request().query(`SELECT * FROM kaj_tab WHERE idnkaj_kaj = ${abeKbr.recordset[0].kaj}`);
      console.log(`\n=== Abe's manual kaj ${abeKbr.recordset[0].kaj} (CIN0066174) — for comparison ===`);
      if (abeKaj.recordset[0]) for (const k of Object.keys(abeKaj.recordset[0])) {
        const v = abeKaj.recordset[0][k]; if (v == null || v === "" || v === 0) continue;
        console.log(`  ${k} = ${v instanceof Date ? v.toISOString() : String(v).trim().slice(0,80)}`);
      }
    }
  }
  await pool.close();
})();
