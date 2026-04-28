import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // The kbr just inserted referenced idnkaj=353326. Pull that kaj and its
  // joined contract / sol to learn how to match a kaj to an AX invoice.
  const r = await pool.request().query(`
    SELECT * FROM kaj_tab WHERE idnkaj_kaj = 353326
  `);
  if (!r.recordset.length) { console.log("kaj 353326 not found"); await pool.close(); return; }
  const kaj = r.recordset[0];
  console.log("=== kaj 353326 ===");
  for (const k of Object.keys(kaj)) {
    const v = kaj[k];
    if (v == null || v === "" || v === 0) continue;
    const s = v instanceof Date ? v.toISOString() : String(v).trim().slice(0, 80);
    if (s) console.log(`  ${k} = ${s}`);
  }

  // Walk the FK chain: kaj.idnk80 → k80 (shipment line) → contract/sol
  const k80 = await pool.request().query(`
    SELECT TOP 5 * FROM k80_tab WHERE idnk80_k80 = ${kaj.idnk80_kaj}
  `);
  console.log("\n=== k80 (shipment line) for kaj.idnk80 ===");
  for (const row of k80.recordset) {
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (v == null || v === "" || v === 0) continue;
      const s = v instanceof Date ? v.toISOString() : String(v).trim().slice(0, 80);
      if (s) console.log(`  ${k} = ${s}`);
    }
  }

  // Probe what idnkap_kbr=24 and 25 mean — maybe a kap_tab lookup
  const kap = await pool.request().query(`SELECT TOP 30 * FROM kap_tab ORDER BY idnkap_kap`);
  console.log("\n=== kap_tab (first 30) ===");
  for (const row of kap.recordset) {
    const fields = Object.entries(row).filter(([_, v]) => v != null && v !== "" && v !== 0).map(([k, v]) => `${k}=${String(v).trim().slice(0,40)}`).join(" | ");
    console.log("  " + fields);
  }
  await pool.close();
})();
