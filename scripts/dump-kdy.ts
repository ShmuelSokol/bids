import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  console.log("=== kdy_tab full contents (all 59 rows) ===");
  const r = await pool.request().query(`SELECT * FROM kdy_tab ORDER BY idnval_kdy DESC`);
  console.log(`rows: ${r.recordset.length}\n`);
  console.log("idnkdy | idnnam | tabnam | idnval | uptime | adtime | upname");
  console.log("-------|--------|--------|--------|--------|--------|--------");
  for (const row of r.recordset as any[]) {
    console.log(`${String(row.idnkdy_kdy).padEnd(6)} | ${(row.idnnam_kdy || "").padEnd(16)} | ${(row.tabnam_kdy || "").padEnd(10)} | ${String(row.idnval_kdy).padEnd(7)} | ${row.uptime_kdy?.toISOString?.().slice(0, 19)} | ${row.adtime_kdy?.toISOString?.().slice(0, 19)} | ${(row.upname_kdy || "").trim()}`);
  }

  await pool.close();
}
main().catch(console.error);
