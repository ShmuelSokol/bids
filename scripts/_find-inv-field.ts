import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Search for any column with "inv" in name across kaj/k80/kae/kad/kbr
  for (const t of ["kaj_tab","k80_tab","kad_tab","kae_tab","kbr_tab","kbb_tab","ka4_tab","kaw_tab"]) {
    const cols = await pool.request().query(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('${t}')`);
    const invCols = cols.recordset.filter((r:any) => /inv|cin/i.test(r.name)).map((r:any) => r.name);
    if (invCols.length > 0) console.log(`${t}: ${invCols.join(", ")}`);
  }
  // Also dump full k80 row for ours vs abe
  const our = (await pool.request().query(`SELECT * FROM k80_tab WHERE idnk80_k80 = 224330`)).recordset[0];
  const abe = (await pool.request().query(`SELECT * FROM k80_tab WHERE idnk80_k80 = 224049`)).recordset[0];
  console.log("\n=== k80 diff INCLUDING blanks/zeros ===");
  for (const k of Object.keys(our).sort()) {
    const a = String(our[k] ?? "").trim();
    const b = String(abe[k] ?? "").trim();
    if (a === b) continue;
    if (["idnk80_k80","addtme_k80","idnk79_k80","reldte_k80","relext_k80","rlsdte_k80"].includes(k)) continue;
    console.log(`  ${k}: ours="${a}" abe="${b}"`);
  }
  await pool.close();
})();
