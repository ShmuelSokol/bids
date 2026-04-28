import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  for (const k of [353349, 353327]) {
    const r = await pool.request().query(`
      SELECT idnka9_ka9, idnkae_ka9, idnkaj_ka9, jln_no_ka9, jlnsta_ka9, jlnqty_ka9
      FROM ka9_tab WHERE idnkaj_ka9 = ${k}
    `);
    console.log(`\n=== ka9 rows for kaj ${k}: ${r.recordset.length} ===`);
    for (const row of r.recordset) {
      console.log(`  ka9=${row.idnka9_ka9} idnkae=${row.idnkae_ka9 || "NULL"} jln=${row.jln_no_ka9} sta=${String(row.jlnsta_ka9 || "").trim()} qty=${row.jlnqty_ka9}`);
    }
  }
  await pool.close();
})();
