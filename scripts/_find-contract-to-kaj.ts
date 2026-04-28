import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // The AX invoice we traced: CustomersOrderReference = "SPE2DS-26-P-1489[SM3106]"
  // → kaj 353326. Walk up: kaj.idnk80 → k80.idnk79 → k79 → ?
  // Pull all rows in the chain and find where the contract # lives
  const k79 = await pool.request().query(`SELECT TOP 1 * FROM k79_tab WHERE idnk79_k79 = 197554`);
  console.log("=== k79 row 197554 ===");
  for (const k of Object.keys(k79.recordset[0] || {})) {
    const v = k79.recordset[0]?.[k];
    if (v == null || v === "" || v === 0) continue;
    const s = v instanceof Date ? v.toISOString() : String(v).trim().slice(0, 80);
    if (s) console.log(`  ${k} = ${s}`);
  }

  // Now search all string-ish columns in k79 for "SPE2DS-26-P-1489"
  const cols = await pool.request().query(`
    SELECT name, system_type_id FROM sys.columns WHERE object_id = OBJECT_ID('k79_tab')
  `);
  console.log("\n=== Searching k79 for 'SPE2DS-26-P-1489' ===");
  for (const c of cols.recordset) {
    if (![167, 175, 231, 239].includes(c.system_type_id)) continue; // varchar/char/nvarchar/nchar
    try {
      const r = await pool.request().query(`
        SELECT TOP 1 idnk79_k79, ${c.name} FROM k79_tab
        WHERE LTRIM(RTRIM(${c.name})) LIKE 'SPE2DS-26-P-1489%' OR ${c.name} = 'SPE2DS-26-P-1489'
      `);
      if (r.recordset.length > 0) console.log(`  HIT in k79.${c.name}: ${JSON.stringify(r.recordset[0])}`);
    } catch { /* ignore */ }
  }

  // Also check if k79 has a parent — k71 maybe (contract header per writeback memory)
  const k71 = await pool.request().query(`SELECT TOP 1 * FROM k71_tab WHERE idnk71_k71 = ${k79.recordset[0]?.idnk71_k79 || 0}`);
  if (k71.recordset.length > 0) {
    console.log("\n=== k71 row (contract header) ===");
    for (const k of Object.keys(k71.recordset[0])) {
      const v = k71.recordset[0][k];
      if (v == null || v === "" || v === 0) continue;
      const s = v instanceof Date ? v.toISOString() : String(v).trim().slice(0, 80);
      if (s) console.log(`  ${k} = ${s}`);
    }
  }

  await pool.close();
})();
