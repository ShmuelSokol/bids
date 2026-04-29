import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // k13_tab schema
  const cols = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='k13_tab' ORDER BY ORDINAL_POSITION`);
  console.log("k13_tab cols:", cols.recordset.map((r:any)=>r.COLUMN_NAME).join(", "));

  // Look up N2999C
  const n = await pool.request().query(`SELECT * FROM k13_tab WHERE LTRIM(RTRIM(cage_k13)) = 'N2999C'`);
  console.log(`\nk13 row for CAGE=N2999C: ${n.recordset.length}`);
  for (const [k, v] of Object.entries(n.recordset[0] || {})) {
    if (v != null && v !== "" && v !== 0) {
      console.log(`  ${k.padEnd(18)} = ${String(v).trim().slice(0,80)}`);
    }
  }

  // PIDTXT for our NSN (k08 idnk08=66653 from earlier)
  console.log("\n=== k08.pidtxt for our NSN (CIN0066186, idnk08=66653) ===");
  const p = await pool.request().query(`SELECT idnk08_k08, LTRIM(RTRIM(fsc_k08)) AS fsc, LTRIM(RTRIM(niin_k08)) AS niin, LTRIM(RTRIM(p_desc_k08)) AS p_desc, LEN(CAST(pidtxt_k08 AS VARCHAR(MAX))) AS pidtxt_len, CAST(pidtxt_k08 AS VARCHAR(MAX)) AS pidtxt FROM k08_tab WHERE idnk08_k08 = 66653`);
  if (p.recordset[0]) {
    const r = p.recordset[0];
    console.log(`  NSN: ${r.fsc}-${r.niin}`);
    console.log(`  desc: ${r.p_desc}`);
    console.log(`  pidtxt length: ${r.pidtxt_len} chars`);
    console.log(`  pidtxt preview:\n${(r.pidtxt || "").slice(0, 300)}`);
  }

  await pool.close();
})().catch(e => { console.error(e); process.exit(1); });
