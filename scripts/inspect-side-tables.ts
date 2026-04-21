import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // k07 schema + recent rows by ajoseph
  console.log("=== k07_tab schema ===");
  const s07 = await pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='k07_tab' ORDER BY ORDINAL_POSITION`);
  for (const c of s07.recordset as any[]) console.log(`  ${c.COLUMN_NAME.padEnd(18)} ${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : ""}`);

  console.log("\n=== k07 rows by ajoseph in last 30 min ===");
  const r07 = await pool.request().query(`SELECT TOP 20 * FROM k07_tab WHERE upname_k07 LIKE 'ajoseph%' AND uptime_k07 > DATEADD(minute, -30, GETDATE()) ORDER BY uptime_k07 DESC`);
  for (const row of r07.recordset as any[]) console.log(" ", JSON.stringify(row).slice(0, 300));

  // k20 schema + recent rows
  console.log("\n\n=== k20_tab schema ===");
  const s20 = await pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='k20_tab' ORDER BY ORDINAL_POSITION`);
  for (const c of s20.recordset as any[]) console.log(`  ${c.COLUMN_NAME.padEnd(18)} ${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : ""}`);

  console.log("\n=== k20 rows by ajoseph in last 30 min (sample 10) ===");
  const r20 = await pool.request().query(`SELECT TOP 10 * FROM k20_tab WHERE upname_k20 LIKE 'ajoseph%' AND uptime_k20 > DATEADD(minute, -30, GETDATE()) ORDER BY uptime_k20 DESC`);
  for (const row of r20.recordset as any[]) console.log(" ", JSON.stringify(row).slice(0, 300));

  // Does k20 reference k34? (Look at any columns with 'idn' referring to known tables)
  console.log("\n\n=== k20 rows that match any of our envelope 46852's k34 ids ===");
  const envK34 = await pool.request().query(`SELECT idnk34_k34 FROM k34_tab WHERE idnk33_k34 = 46852`);
  const k34Ids = envK34.recordset.map((r: any) => r.idnk34_k34);
  console.log(`  k34 ids in envelope 46852: [${k34Ids.join(",")}]`);

  // Look at idn column content types in k20 — find which column might hold a k34 id
  // idnllp_k20 is the most promising
  for (const col of ["idnllp_k20"]) {
    const m = await pool.request().query(`
      SELECT COUNT(*) AS c FROM k20_tab WHERE [${col}] IN (${k34Ids.join(",")})
    `);
    console.log(`  k20.${col} matching k34 ids: ${m.recordset[0].c}`);
  }

  // Find rows in k20 linked to envelope's recent k34s
  console.log("\n=== k20 rows modified in last hour (all users) ===");
  const recent20 = await pool.request().query(`
    SELECT TOP 15 * FROM k20_tab WHERE uptime_k20 > DATEADD(minute, -60, GETDATE()) ORDER BY uptime_k20 DESC
  `);
  for (const row of recent20.recordset as any[]) console.log(" ", JSON.stringify(row).slice(0, 300));

  // Check if there's a sys-level recent_activity pattern via k07
  console.log("\n\n=== All k34 rows in envelope 46852 with their uptimes ===");
  const all34 = await pool.request().query(`
    SELECT idnk34_k34, uptime_k34, upname_k34, idnk11_k34 FROM k34_tab WHERE idnk33_k34 = 46852 ORDER BY idnk34_k34
  `);
  for (const row of all34.recordset as any[]) {
    console.log(`  k34=${row.idnk34_k34}  upname=${row.upname_k34?.trim()}  ${row.uptime_k34?.toISOString?.()}`);
  }

  await pool.close();
}
main().catch(console.error);
