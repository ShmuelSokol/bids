import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });

  // Find views that join kd8/kda/kdb to k33/k34/k35 or sol tables — those show how staging connects to posted
  console.log("Views referencing kd8_tab or kda_tab or kdb_tab:");
  const vrefs = await pool.request().query(`
    SELECT TABLE_NAME, VIEW_DEFINITION FROM INFORMATION_SCHEMA.VIEWS
    WHERE VIEW_DEFINITION LIKE '%kd8_tab%' OR VIEW_DEFINITION LIKE '%kda_tab%' OR VIEW_DEFINITION LIKE '%kdb_tab%' OR VIEW_DEFINITION LIKE '%kd0_tab%'
  `);
  for (const r of vrefs.recordset as any[]) {
    console.log(`\n=== ${r.TABLE_NAME} ===`);
    console.log(r.VIEW_DEFINITION?.slice(-800));
  }

  // Where is the "pending" / "draft" bid data? Search views with names that hint at Abe's workflow
  console.log("\n\nViews with 'save', 'post', 'trans', 'our_quote', 'quote_send' in NAME:");
  const names = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS
    WHERE TABLE_NAME LIKE '%save%' OR TABLE_NAME LIKE '%post%' OR TABLE_NAME LIKE '%our_quote%'
       OR TABLE_NAME LIKE '%quote_send%' OR TABLE_NAME LIKE '%trans%' OR TABLE_NAME LIKE '%pend%'
       OR TABLE_NAME LIKE '%draft%' OR TABLE_NAME LIKE '%stag%' OR TABLE_NAME LIKE '%bid%' OR TABLE_NAME LIKE '%_qte%' OR TABLE_NAME LIKE '%_qry%'
    ORDER BY TABLE_NAME
  `);
  for (const r of names.recordset as any[]) console.log(`  ${r.TABLE_NAME}`);

  // Find tables with recent activity (any row with uptime in last 7 days) — points to active workflow tables
  console.log("\n\nTables with rows modified in the last 3 days (top 30):");
  const cols = await pool.request().query(`
    SELECT DISTINCT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME IN ('uptime_k33','uptime_k34','uptime_k35','uptime_kd0','uptime_kd8','uptime_kda','uptime_kdb','uptime_kc4','uptime_kad','adtime_kd0','adtime_kd8','adtime_kda','adtime_kdb')
  `);

  // Show last 5 rows from k33/k34 + kd*/kc4
  for (const tn of ["k33_tab","k34_tab","kc4_tab","kad_tab"]) {
    try {
      const upCol = `uptime_${tn.slice(0,3)}`;
      const r = await pool.request().query(`SELECT TOP 3 ${upCol} FROM ${tn} ORDER BY ${upCol} DESC`);
      console.log(`  ${tn}: latest uptime: ${r.recordset.map((x: any) => x[upCol]?.toISOString?.()?.slice(0, 16)).join(" | ")}`);
    } catch (e: any) { console.log(`  ${tn}: ${e.message.slice(0, 60)}`); }
  }

  // Also check kc4 (solicitation identity) and kad — the summary mentioned these
  console.log("\n\nkc4 and kad schema:");
  for (const tn of ["kc4_tab", "kad_tab"]) {
    const cnt = await pool.request().query(`SELECT COUNT(*) AS c FROM ${tn}`);
    const cs = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${tn}' ORDER BY ORDINAL_POSITION`);
    console.log(`  ${tn}: ${cnt.recordset[0].c} rows, cols: ${cs.recordset.map((c: any) => c.COLUMN_NAME).join(", ")}`);
  }

  await pool.close();
}
main().catch(console.error);
