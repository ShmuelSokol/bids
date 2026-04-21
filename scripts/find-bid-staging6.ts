import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });

  // d01-d04 tables
  console.log("d01-d04 tables schema:\n");
  for (const tn of ["d01_tab","d02_tab","d03_tab","d04_tab"]) {
    const cnt = await pool.request().query(`SELECT COUNT(*) AS c FROM ${tn}`);
    const cols = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${tn}' ORDER BY ORDINAL_POSITION`);
    console.log(`  ${tn}: ${cnt.recordset[0].c} rows — ${cols.recordset.map((c: any) => c.COLUMN_NAME).join(", ")}`);
    if (cnt.recordset[0].c > 0 && cnt.recordset[0].c < 20) {
      const sample = await pool.request().query(`SELECT TOP 5 * FROM ${tn}`);
      for (const row of sample.recordset as any[]) console.log(`    ${JSON.stringify(row).slice(0, 200)}`);
    }
  }

  // The 5 anomalous s_stat='acknowledged' rows in k33
  console.log("\n\nk33 rows with s_stat='acknowledged' (the 5 anomalies):\n");
  const anom = await pool.request().query(`SELECT TOP 10 idnk33_k33, uptime_k33, upname_k33, qotref_k33, o_stat_k33, t_stat_k33, a_stat_k33, s_stat_k33, o_stme_k33, t_stme_k33, itmcnt_k33 FROM k33_tab WHERE s_stat_k33 = 'acknowledged' ORDER BY uptime_k33 DESC`);
  for (const row of anom.recordset as any[]) console.log(`  ${JSON.stringify(row).slice(0, 300)}`);

  // The 126 rows where a_stat='not acknowledged'  — what timestamps look like
  console.log("\n\nk33 rows with a_stat='not acknowledged' — time gaps:\n");
  const na = await pool.request().query(`SELECT TOP 10 idnk33_k33, uptime_k33, qotref_k33, o_stat_k33, t_stat_k33, a_stat_k33, s_stat_k33, o_stme_k33, t_stme_k33, a_stme_k33, s_stme_k33 FROM k33_tab WHERE a_stat_k33='not acknowledged' ORDER BY uptime_k33 DESC`);
  for (const row of na.recordset as any[]) console.log(`  ${JSON.stringify(row).slice(0, 300)}`);

  // Check kdh (referenced by aq_quote_send views)
  console.log("\n\nkdh_tab and kdw_tab samples:\n");
  for (const tn of ["kdh_tab", "kdw_tab"]) {
    const cnt = await pool.request().query(`SELECT COUNT(*) AS c FROM ${tn}`);
    const sample = await pool.request().query(`SELECT TOP 3 * FROM ${tn}`);
    console.log(`  ${tn}: ${cnt.recordset[0].c} rows`);
    for (const row of sample.recordset as any[]) console.log(`    ${JSON.stringify(row).slice(0, 300)}`);
  }

  // Search all column names for hints of draft/temp/held state in tables with k34-like bid pricing columns
  console.log("\n\nTables with 'hld' or 'drf' or 'tmp' or 'pnd' or 'hold' or 'save' in any column name:\n");
  const cols2 = await pool.request().query(`
    SELECT DISTINCT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME LIKE '%hld%' OR COLUMN_NAME LIKE '%drf%' OR COLUMN_NAME LIKE '%tmp%'
       OR COLUMN_NAME LIKE '%hold%' OR COLUMN_NAME LIKE '%pend%' OR COLUMN_NAME LIKE '%save%'
       OR COLUMN_NAME LIKE '%_wrk_%' OR COLUMN_NAME LIKE '%stag%'
    ORDER BY TABLE_NAME
  `);
  for (const r of cols2.recordset as any[]) console.log(`  ${r.TABLE_NAME.padEnd(25)} ${r.COLUMN_NAME}`);

  // There's an 'a' table — that's unusual. Show its schema.
  console.log("\n\nTable 'a' schema:");
  try {
    const cols3 = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='a' ORDER BY ORDINAL_POSITION`);
    const cnt3 = await pool.request().query(`SELECT COUNT(*) AS c FROM [a]`);
    console.log(`  a: ${cnt3.recordset[0].c} rows, cols: ${cols3.recordset.map((c: any) => c.COLUMN_NAME).join(", ")}`);
  } catch (e: any) { console.log(`  a: error ${e.message.slice(0, 80)}`); }

  await pool.close();
}
main().catch(console.error);
