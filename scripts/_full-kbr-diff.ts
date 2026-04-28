import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  // Our 810: 559243, our 856: 559244
  // Abe's recent 810: 559234 (kaj=353327), Abe's 856: 559233
  const ours810 = (await pool.request().query(`SELECT * FROM kbr_tab WHERE idnkbr_kbr = 559243`)).recordset[0];
  const abes810 = (await pool.request().query(`SELECT * FROM kbr_tab WHERE idnkbr_kbr = 559234`)).recordset[0];
  console.log("=== WAWF 810 (kap=24) field comparison ===");
  for (const k of Object.keys(ours810)) {
    const a = ours810[k]; const b = abes810[k];
    const aStr = a == null ? "<null>" : a instanceof Date ? a.toISOString() : `"${String(a)}"`;
    const bStr = b == null ? "<null>" : b instanceof Date ? b.toISOString() : `"${String(b)}"`;
    const same = aStr === bStr;
    console.log(`  ${same ? " " : "≠"} ${k.padEnd(15)}: ours=${aStr.slice(0,50)} abe=${bStr.slice(0,50)}`);
  }
  const ours856 = (await pool.request().query(`SELECT * FROM kbr_tab WHERE idnkbr_kbr = 559244`)).recordset[0];
  const abes856 = (await pool.request().query(`SELECT * FROM kbr_tab WHERE idnkbr_kbr = 559233`)).recordset[0];
  console.log("\n=== WAWF 856 (kap=25) field comparison ===");
  for (const k of Object.keys(ours856)) {
    const a = ours856[k]; const b = abes856[k];
    const aStr = a == null ? "<null>" : a instanceof Date ? a.toISOString() : `"${String(a)}"`;
    const bStr = b == null ? "<null>" : b instanceof Date ? b.toISOString() : `"${String(b)}"`;
    const same = aStr === bStr;
    console.log(`  ${same ? " " : "≠"} ${k.padEnd(15)}: ours=${aStr.slice(0,50)} abe=${bStr.slice(0,50)}`);
  }
  await pool.close();
})();
