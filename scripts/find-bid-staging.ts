import "./env";
import sql from "mssql/msnodesqlv8";
async function main() {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });

  // List all tables
  const tables = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  console.log("All tables (", tables.recordset.length, "total):");
  const k_tables = tables.recordset.filter((t: any) => t.TABLE_NAME.match(/^k\d+/i) || t.TABLE_NAME.toLowerCase().includes("bid") || t.TABLE_NAME.toLowerCase().includes("quot") || t.TABLE_NAME.toLowerCase().includes("draft") || t.TABLE_NAME.toLowerCase().includes("pend"));
  for (const t of k_tables) console.log(`  ${t.TABLE_NAME}`);

  // For each k_tab, show row count and what columns look like "bid" related
  console.log("\n\nk_tab row counts and status columns:");
  for (const t of k_tables) {
    const name = t.TABLE_NAME;
    try {
      const cnt = await pool.request().query(`SELECT COUNT(*) AS c FROM ${name}`);
      const cols = await pool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${name}' AND (
          COLUMN_NAME LIKE '%price%' OR
          COLUMN_NAME LIKE '%qty%' OR
          COLUMN_NAME LIKE '%bid%' OR
          COLUMN_NAME LIKE '%stat%' OR
          COLUMN_NAME LIKE '%sol%' OR
          COLUMN_NAME LIKE '%idn%' OR
          COLUMN_NAME LIKE '%up%'
        )
        ORDER BY ORDINAL_POSITION
      `);
      const colList = cols.recordset.map((c: any) => c.COLUMN_NAME).slice(0, 12).join(", ");
      console.log(`  ${name.padEnd(15)} ${String(cnt.recordset[0].c).padStart(8)} rows  cols: ${colList}`);
    } catch (e: any) {
      console.log(`  ${name} — error: ${e.message.slice(0, 50)}`);
    }
  }

  await pool.close();
}
main().catch(console.error);
