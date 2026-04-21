import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });

  const sols = ["SPE2DS-26-T-9788", "SPE2DS-26-T-9784"];

  // 1. Find idnk10 + idnk11 for each
  console.log("Step 1: Find k10 + k11 rows for target sols\n");
  const solRows: { sol: string; idnk10: number; idnk11s: number[] }[] = [];
  for (const sol of sols) {
    const k10 = await pool.request()
      .input("sol", sol)
      .query(`SELECT idnk10_k10, uptime_k10 FROM k10_tab WHERE sol_no_k10 = @sol`);
    if (k10.recordset.length === 0) { console.log(`  ${sol}: NOT FOUND in k10_tab`); continue; }
    const idnk10 = k10.recordset[0].idnk10_k10;
    const k11 = await pool.request()
      .input("id", idnk10)
      .query(`SELECT idnk11_k11 FROM k11_tab WHERE idnk10_k11 = @id`);
    const idnk11s = k11.recordset.map((r: any) => r.idnk11_k11);
    console.log(`  ${sol}: idnk10=${idnk10}, idnk11s=[${idnk11s.join(",")}]`);
    solRows.push({ sol, idnk10, idnk11s });
  }

  const allK11s = solRows.flatMap((s) => s.idnk11s);
  if (allK11s.length === 0) { console.log("No k11 rows found — aborting"); await pool.close(); return; }

  // 2. Find ALL tables with an idnk11_* column, then search each for our k11 ids
  console.log("\nStep 2: Search every table with an idnk11_* column for our k11 ids\n");
  const cols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME LIKE 'idnk11_%'
    ORDER BY TABLE_NAME
  `);

  const inList = allK11s.join(",");
  for (const c of cols.recordset as any[]) {
    const t = c.TABLE_NAME;
    const col = c.COLUMN_NAME;
    // Only check actual tables (not views)
    try {
      const chk = await pool.request().query(`
        SELECT TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${t}'
      `);
      if (chk.recordset[0]?.TABLE_TYPE !== "BASE TABLE") continue;

      const r = await pool.request().query(`SELECT COUNT(*) AS c FROM [${t}] WHERE [${col}] IN (${inList})`);
      const cnt = r.recordset[0].c;
      if (cnt > 0) {
        console.log(`  ${t}.${col}: ${cnt} row(s) match`);
        // Show the actual rows
        const sample = await pool.request().query(`SELECT TOP 10 * FROM [${t}] WHERE [${col}] IN (${inList})`);
        for (const row of sample.recordset as any[]) {
          const keys = Object.keys(row).filter((k) => row[k] !== null && row[k] !== "" && row[k] !== 0);
          const brief = keys.slice(0, 12).map((k) => `${k}=${String(row[k]).trim().slice(0, 30)}`).join(" | ");
          console.log(`     ${brief}`);
        }
      }
    } catch (e: any) {
      // skip
    }
  }

  // 3. Also search every table with a uptime_* column for rows modified in last 24 hours matching upname='ajoseph'
  console.log("\nStep 3: Rows modified in last 24h by ajoseph (any table)\n");
  const upCols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME LIKE 'upname_%' AND DATA_TYPE = 'char'
  `);
  for (const c of upCols.recordset as any[]) {
    const t = c.TABLE_NAME;
    const col = c.COLUMN_NAME;
    const timeCol = col.replace("upname", "uptime");
    try {
      const chk = await pool.request().query(`SELECT TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${t}'`);
      if (chk.recordset[0]?.TABLE_TYPE !== "BASE TABLE") continue;

      const r = await pool.request().query(`
        SELECT COUNT(*) AS c FROM [${t}]
        WHERE [${col}] LIKE 'ajoseph%' AND [${timeCol}] > DATEADD(day, -1, GETDATE())
      `);
      const cnt = r.recordset[0].c;
      if (cnt > 0) {
        console.log(`  ${t}: ${cnt} row(s) by ajoseph in last 24h`);
      }
    } catch (e: any) {
      // skip — timeCol might not exist
    }
  }

  await pool.close();
}
main().catch(console.error);
