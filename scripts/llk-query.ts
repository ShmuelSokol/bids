/**
 * Reusable Lam Links SQL query runner.
 *
 * Usage:
 *   npx tsx scripts/llk-query.ts "SELECT TOP 10 * FROM k08_tab"
 *   npx tsx scripts/llk-query.ts "SELECT ..." --save data/llk-discovery/output.json
 *   npx tsx scripts/llk-query.ts --file scripts/my-query.sql
 */
import sql from "mssql/msnodesqlv8";
import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const args = process.argv.slice(2);
  let query = "";
  let savePath = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--save" && args[i + 1]) {
      savePath = args[++i];
    } else if (args[i] === "--file" && args[i + 1]) {
      query = readFileSync(args[++i], "utf-8");
    } else if (!query) {
      query = args[i];
    }
  }

  if (!query) {
    console.error("Usage: npx tsx scripts/llk-query.ts \"SQL\" [--save path.json]");
    process.exit(1);
  }

  const pool = await sql.connect(config);
  const start = Date.now();
  const result = await pool.request().query(query);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const rows = result.recordset;

  console.log(`${rows.length.toLocaleString()} rows (${elapsed}s)`);

  if (savePath) {
    mkdirSync(dirname(savePath), { recursive: true });
    writeFileSync(savePath, JSON.stringify(rows, null, 2));
    console.log(`Saved to ${savePath}`);
  } else {
    console.log(JSON.stringify(rows, null, 2));
  }

  await pool.close();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
