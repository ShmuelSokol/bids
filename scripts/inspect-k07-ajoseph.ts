import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // All ajoseph rows in k07_tab — look for counter-like keys
  console.log("=== ALL k07_tab rows where upname=ajoseph (idk34 / idk35 / counter / next / default / last) ===");
  const r = await pool.request().query(`
    SELECT idnk07_k07, ss_tid_k07, ss_idk_k07, ss_key_k07, ss_val_k07, uptime_k07
    FROM k07_tab
    WHERE LTRIM(RTRIM(upname_k07)) = 'ajoseph'
      AND (ss_key_k07 LIKE '%idk34%' OR ss_key_k07 LIKE '%IDK34%'
           OR ss_key_k07 LIKE '%idk35%' OR ss_key_k07 LIKE '%IDK35%'
           OR ss_key_k07 LIKE '%K34%'   OR ss_key_k07 LIKE '%K35%'
           OR ss_key_k07 LIKE '%COUNTER%' OR ss_key_k07 LIKE '%SEQ%'
           OR ss_key_k07 LIKE '%NEXT%'    OR ss_key_k07 LIKE '%LAST%'
           OR ss_key_k07 LIKE '%DEFAULT%' OR ss_key_k07 LIKE '%QUOTE%')
    ORDER BY uptime_k07 DESC
  `);
  for (const row of r.recordset as any[]) {
    console.log(`  tid=${row.ss_tid_k07} | ${(row.ss_idk_k07 || "").trim()} | ${(row.ss_key_k07 || "").trim()} = ${(row.ss_val_k07 || "").trim().slice(0, 60)}  (${row.uptime_k07?.toISOString?.().slice(0, 16)})`);
  }

  // Also rows where ss_val CONTAINS a number near 495xxx (maybe it's embedded in an XML string)
  console.log("\n=== ajoseph k07 rows containing 495 anywhere in value ===");
  const r2 = await pool.request().query(`
    SELECT TOP 30 ss_key_k07, ss_val_k07, uptime_k07
    FROM k07_tab
    WHERE LTRIM(RTRIM(upname_k07)) = 'ajoseph'
      AND ss_val_k07 LIKE '%495%'
    ORDER BY uptime_k07 DESC
  `);
  for (const row of r2.recordset as any[]) {
    console.log(`  ${(row.ss_key_k07 || "").trim()} = ${(row.ss_val_k07 || "").slice(0, 120)}  (${row.uptime_k07?.toISOString?.().slice(0, 16)})`);
  }

  // Any table that has a k34-sized int stored as an INT column but isn't a k34 FK
  // Specifically: look at recently-updated rows with an int column in range 495000-496000
  console.log("\n=== NON-k34/k35/k33/k11 tables with an int in range 495000-496000 and updated today ===");
  const intCols = await pool.request().query(`
    SELECT c.TABLE_NAME, c.COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS c
    INNER JOIN INFORMATION_SCHEMA.TABLES t ON c.TABLE_NAME = t.TABLE_NAME
    WHERE c.DATA_TYPE = 'int' AND t.TABLE_TYPE = 'BASE TABLE'
      AND c.TABLE_NAME NOT IN ('k11_tab','k32_tab','k34_tab','k35_tab','k10_tab','k28_tab','k15_tab','k63_tab','k62_tab','kc4_tab','k94_tab','kcg_tab','ka6_tab','kam_tab','kan_tab','kbr_tab','k30_tab')
      AND c.COLUMN_NAME NOT LIKE 'idn%'
  `);
  for (const c of intCols.recordset as any[]) {
    try {
      const q = await pool.request().query(`
        SELECT TOP 2 [${c.COLUMN_NAME}] AS v FROM [${c.TABLE_NAME}]
        WHERE [${c.COLUMN_NAME}] BETWEEN 495700 AND 496000
      `);
      if (q.recordset.length > 0) {
        console.log(`  ${c.TABLE_NAME}.${c.COLUMN_NAME}: ${q.recordset.map((x: any) => x.v).join(",")}`);
      }
    } catch (e: any) { /* skip */ }
  }

  await pool.close();
}
main().catch(console.error);
