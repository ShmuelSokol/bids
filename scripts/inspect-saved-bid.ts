import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });

  console.log("=== k33 row 46852 (STAGING — saved but not posted) ===\n");
  const k33 = await pool.request().query(`SELECT * FROM k33_tab WHERE idnk33_k33 = 46852`);
  for (const row of k33.recordset as any[]) {
    for (const [k, v] of Object.entries(row)) {
      const str = v instanceof Date ? v.toISOString() : JSON.stringify(v);
      console.log(`  ${k.padEnd(18)} ${str}`);
    }
  }

  console.log("\n=== k33 row 46851 (POSTED earlier today — for comparison) ===\n");
  const k33b = await pool.request().query(`SELECT * FROM k33_tab WHERE idnk33_k33 = 46851`);
  for (const row of k33b.recordset as any[]) {
    for (const [k, v] of Object.entries(row)) {
      const str = v instanceof Date ? v.toISOString() : JSON.stringify(v);
      console.log(`  ${k.padEnd(18)} ${str}`);
    }
  }

  console.log("\n=== k34 rows 495722 + 495723 (STAGING lines for 46852) ===\n");
  const k34 = await pool.request().query(`SELECT * FROM k34_tab WHERE idnk34_k34 IN (495722, 495723) ORDER BY idnk34_k34`);
  for (const row of k34.recordset as any[]) {
    console.log("--- line ---");
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === "" || v === 0) continue;
      const str = v instanceof Date ? v.toISOString() : JSON.stringify(v);
      console.log(`  ${k.padEnd(18)} ${str}`);
    }
  }

  console.log("\n=== k35 rows (pricing for 495722 + 495723) ===\n");
  const k35 = await pool.request().query(`SELECT * FROM k35_tab WHERE idnk34_k35 IN (495722, 495723) ORDER BY idnk35_k35`);
  for (const row of k35.recordset as any[]) {
    console.log("--- price ---");
    for (const [k, v] of Object.entries(row)) {
      const str = v instanceof Date ? v.toISOString() : JSON.stringify(v);
      console.log(`  ${k.padEnd(18)} ${str}`);
    }
  }

  await pool.close();
}
main().catch(console.error);
