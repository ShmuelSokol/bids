// Determine whether kdy_tab.idnval_kdy stores "next id to assign" or "last id assigned".
// Compare against MAX(id) for that table — if they match, idnval = last. If idnval > MAX
// by exactly 1, idnval = next.

import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  const checks = [
    { kdy: "k34_tab", max_table: "k34_tab", max_col: "idnk34_k34" },
    { kdy: "k35_tab", max_table: "k35_tab", max_col: "idnk35_k35" },
    { kdy: "k33_tab", max_table: "k33_tab", max_col: "idnk33_k33" },
    { kdy: "k11_tab", max_table: "k11_tab", max_col: "idnk11_k11" },
    { kdy: "k10_tab", max_table: "k10_tab", max_col: "idnk10_k10" },
  ];

  for (const c of checks) {
    const r = await pool.request().query(`
      SELECT
        (SELECT idnval_kdy FROM kdy_tab WHERE tabnam_kdy = '${c.kdy}') AS idnval,
        (SELECT MAX(${c.max_col}) FROM ${c.max_table}) AS max_id
    `);
    const row = r.recordset[0];
    const diff = row.idnval - row.max_id;
    console.log(`${c.kdy.padEnd(10)}  kdy.idnval=${row.idnval}  MAX=${row.max_id}  diff=${diff > 0 ? "+" : ""}${diff}`);
  }
}
main().catch(console.error);
