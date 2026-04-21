import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });

  // Distinct values + counts for all 4 status cols in k33
  console.log("k33 status distribution:\n");
  for (const col of ["o_stat_k33", "t_stat_k33", "a_stat_k33", "s_stat_k33"]) {
    const r = await pool.request().query(`SELECT ${col} AS v, COUNT(*) AS c FROM k33_tab GROUP BY ${col} ORDER BY c DESC`);
    console.log(`  ${col}:`);
    for (const row of r.recordset as any[]) {
      console.log(`    ${String(row.v || "(null)").padEnd(20)} ${row.c}`);
    }
  }

  // The most recent 5 rows — full row content
  console.log("\n\n5 most recent k33 rows:\n");
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'k33_tab' ORDER BY ORDINAL_POSITION
  `);
  const colNames = cols.recordset.map((c: any) => c.COLUMN_NAME);
  const latest = await pool.request().query(`SELECT TOP 5 * FROM k33_tab ORDER BY uptime_k33 DESC`);
  for (const row of latest.recordset as any[]) {
    console.log("---");
    for (const c of colNames) {
      const v = row[c];
      if (v !== null && v !== undefined && v !== "") {
        const strV = typeof v === "object" && v instanceof Date ? v.toISOString().slice(0, 19) : String(v).slice(0, 60);
        console.log(`  ${c.padEnd(20)} ${strV}`);
      }
    }
  }

  // Now inspect the views that refer to k33 with filter conditions — those WHERE clauses define the state machine
  console.log("\n\nViews with WHERE clauses filtering k33 status:\n");
  const vrefs = await pool.request().query(`
    SELECT TABLE_NAME, VIEW_DEFINITION FROM INFORMATION_SCHEMA.VIEWS
    WHERE VIEW_DEFINITION LIKE '%o_stat_k33%' OR VIEW_DEFINITION LIKE '%t_stat_k33%'
  `);
  for (const r of vrefs.recordset as any[]) {
    const def = r.VIEW_DEFINITION || "";
    // Extract WHERE portion
    const m = def.match(/WHERE\s+[^$]+/gi);
    if (m) {
      console.log(`=== ${r.TABLE_NAME} ===`);
      for (const w of m) console.log(`  ${w.slice(0, 400)}`);
    }
  }

  await pool.close();
}
main().catch(console.error);
