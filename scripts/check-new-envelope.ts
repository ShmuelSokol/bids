import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // k33 details
  console.log("=== k33 46853 ===");
  const k33 = await pool.request().query(`SELECT * FROM k33_tab WHERE idnk33_k33 = 46853`);
  for (const [k, v] of Object.entries(k33.recordset[0])) {
    const s = v instanceof Date ? v.toISOString() : JSON.stringify(v);
    console.log(`  ${k.padEnd(18)} ${s}`);
  }

  // k34 line(s) — full detail, just the non-empty/non-zero fields
  console.log("\n=== k34 lines under 46853 ===");
  const k34 = await pool.request().query(`SELECT * FROM k34_tab WHERE idnk33_k34 = 46853 ORDER BY idnk34_k34`);
  for (const row of k34.recordset as any[]) {
    console.log(`\n--- k34 id=${row.idnk34_k34} ---`);
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === "" || v === 0) continue;
      const s = v instanceof Date ? v.toISOString() : JSON.stringify(v);
      console.log(`  ${k.padEnd(18)} ${s}`);
    }
  }

  // k35 pricing
  console.log("\n=== k35 pricing ===");
  const k35 = await pool.request().query(`
    SELECT k35.* FROM k35_tab k35
    INNER JOIN k34_tab k34 ON k35.idnk34_k35 = k34.idnk34_k34
    WHERE k34.idnk33_k34 = 46853 ORDER BY k35.idnk35_k35
  `);
  for (const row of k35.recordset as any[]) {
    console.log(`\n--- k35 id=${row.idnk35_k35} ---`);
    for (const [k, v] of Object.entries(row)) {
      const s = v instanceof Date ? v.toISOString() : JSON.stringify(v);
      console.log(`  ${k.padEnd(18)} ${s}`);
    }
  }

  // Compare id jumps — what did Abe's client use vs our previous 495751?
  console.log("\n=== ID jumps from last posted envelope ===");
  const prev = await pool.request().query(`
    SELECT MAX(idnk34_k34) AS m FROM k34_tab WHERE idnk33_k34 = 46852
  `);
  const abeNext34 = k34.recordset[0].idnk34_k34;
  console.log(`  Previous envelope (46852) MAX k34 = ${prev.recordset[0].m}`);
  console.log(`  Abe's new k34 on envelope 46853 = ${abeNext34}`);
  console.log(`  Jump = ${abeNext34 - prev.recordset[0].m}`);

  await pool.close();
}
main().catch(console.error);
