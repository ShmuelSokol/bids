import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });

  // ALL tables — not just k_tab
  const tables = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  const allNames: string[] = tables.recordset.map((t: any) => t.TABLE_NAME);
  const nonK = allNames.filter((n) => !/^k\d+_tab$/i.test(n));
  console.log(`Non-k_tab tables (${nonK.length} of ${allNames.length} total):`);
  for (const n of nonK) console.log(`  ${n}`);

  // Also tables that have bid/quote/draft/pend/save/post in name
  console.log("\n\nTables with bid/quote/save/post/draft/pend/stag in name:");
  const keywordMatches = allNames.filter((n) => /bid|quot|save|post|draft|pend|stag|temp|work|hold/i.test(n));
  for (const n of keywordMatches) console.log(`  ${n}`);

  // Find tables with qotref, bidprc, up_, or bid-price-like columns
  console.log("\n\nTables with 'qotref' or 'bidprc' or bid-pricing-like columns:");
  const cols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE COLUMN_NAME LIKE '%qotref%' OR COLUMN_NAME LIKE '%bidprc%' OR COLUMN_NAME LIKE '%idnk11%' OR COLUMN_NAME LIKE '%o_stat%' OR COLUMN_NAME LIKE '%t_stat%'
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);
  const byTable = new Map<string, string[]>();
  for (const c of cols.recordset as any[]) {
    if (!byTable.has(c.TABLE_NAME)) byTable.set(c.TABLE_NAME, []);
    byTable.get(c.TABLE_NAME)!.push(c.COLUMN_NAME);
  }
  for (const [t, cs] of byTable) console.log(`  ${t.padEnd(20)} — ${cs.join(", ")}`);

  await pool.close();
}
main().catch(console.error);
