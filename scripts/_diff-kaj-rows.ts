import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Our test kaj
  const ours = await pool.request().query(`SELECT * FROM kaj_tab WHERE idnkaj_kaj = 353349`);
  // Abe's most recent manual kaj (CIN0066229 → kaj?). Find via kbr.
  const abeKaj = await pool.request().query(`
    SELECT TOP 1 idnitt_kbr AS kaj FROM kbr_tab
    WHERE addnme_kbr = 'ajoseph   ' AND idnkap_kbr = 24
      AND addtme_kbr BETWEEN '2026-04-28T18:08:00' AND '2026-04-28T18:09:30'
  `);
  const abe = await pool.request().query(`SELECT * FROM kaj_tab WHERE idnkaj_kaj = ${abeKaj.recordset[0]?.kaj ?? 0}`);

  if (!ours.recordset[0] || !abe.recordset[0]) { console.log("missing"); await pool.close(); return; }

  const our = ours.recordset[0];
  const ab = abe.recordset[0];
  console.log(`=== Field-level diff: ours kaj=${our.idnkaj_kaj} vs Abe kaj=${ab.idnkaj_kaj} ===`);
  for (const k of Object.keys(our)) {
    const a = our[k];
    const b = ab[k];
    const aStr = a instanceof Date ? a.toISOString() : String(a ?? "").trim();
    const bStr = b instanceof Date ? b.toISOString() : String(b ?? "").trim();
    if (aStr !== bStr) console.log(`  ${k}: ours="${aStr.slice(0,80)}" vs abe="${bStr.slice(0,80)}"`);
  }
  await pool.close();
})();
