import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Full kbr column list
  const cols = await pool.request().query(`
    SELECT name, system_type_id, is_nullable, max_length
    FROM sys.columns WHERE object_id = OBJECT_ID('kbr_tab')
    ORDER BY column_id
  `);
  console.log("=== kbr_tab columns ===");
  for (const c of cols.recordset) {
    const typeMap: any = { 56: "int", 175: "char", 167: "varchar", 61: "datetime", 62: "float", 106: "decimal", 36: "uniqueidentifier" };
    const t = typeMap[c.system_type_id] || `type${c.system_type_id}`;
    console.log(`  ${c.name.padEnd(20)} ${t.padEnd(10)} nullable=${c.is_nullable}`);
  }

  // Recent kbr rows (full) for WAWF 810 — see what columns are populated
  const r = await pool.request().query(`
    SELECT TOP 5 * FROM kbr_tab
    WHERE idnkap_kbr IN (24, 25)
    ORDER BY idnkbr_kbr DESC
  `);
  console.log("\n=== Last 5 kbr rows (WAWF 810/856) ===");
  for (const row of r.recordset) {
    console.log(`--- idnkbr=${row.idnkbr_kbr} kap=${row.idnkap_kbr} (${String(row.xtcsta_kbr).trim()}) ---`);
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (v == null) continue;
      const s = v instanceof Date ? v.toISOString() : String(v).trim();
      if (s === "" || s === "0") continue;
      console.log(`  ${k} = ${s.slice(0, 80)}`);
    }
  }

  // What's xtcscn_kbr? Compare 810 (xtcscn=511544) vs the related kad/kae
  const kbr810 = await pool.request().query(`
    SELECT idnkbr_kbr, idnitt_kbr, xtcscn_kbr, addtme_kbr
    FROM kbr_tab WHERE idnkap_kbr = 24 AND addnme_kbr = 'ajoseph'
    ORDER BY idnkbr_kbr DESC
    OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY
  `);
  console.log("\n=== xtcscn pattern check (5 most recent WAWF 810 by ajoseph) ===");
  for (const r of kbr810.recordset) {
    // Find kad inserted at the same time (closest by addtme)
    const kad = await pool.request().query(`
      SELECT TOP 1 idnkad_kad, cin_no_kad FROM kad_tab
      WHERE upname_kad = 'ajoseph   '
        AND uptime_kad BETWEEN DATEADD(MINUTE, -2, '${r.addtme_kbr.toISOString()}') AND '${r.addtme_kbr.toISOString()}'
      ORDER BY uptime_kad DESC
    `);
    console.log(`  kbr=${r.idnkbr_kbr} xtcscn=${r.xtcscn_kbr} kaj=${r.idnitt_kbr} → matched kad cin_no=${String(kad.recordset[0]?.cin_no_kad || "?").trim()}`);
  }

  await pool.close();
})();
