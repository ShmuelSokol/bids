import "./env";
import sql from "mssql/msnodesqlv8";
import fs from "fs";
import path from "path";

// Usage:
//   npx tsx scripts/bid-staging-snapshot.ts before   (run BEFORE Abe saves)
//   npx tsx scripts/bid-staging-snapshot.ts after    (run AFTER Abe saves, before Post)
//   npx tsx scripts/bid-staging-snapshot.ts diff     (show tables that changed)

async function main() {
  const mode = process.argv[2];
  if (!mode || !["before", "after", "diff"].includes(mode)) {
    console.log("Usage: npx tsx scripts/bid-staging-snapshot.ts [before|after|diff]");
    process.exit(1);
  }

  const outDir = path.join(__dirname, "..", "tmp");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const beforePath = path.join(outDir, "bid-snapshot-before.json");
  const afterPath = path.join(outDir, "bid-snapshot-after.json");

  if (mode === "diff") {
    if (!fs.existsSync(beforePath) || !fs.existsSync(afterPath)) {
      console.log("Need both before + after snapshots. Run 'before' first, then 'after'.");
      process.exit(1);
    }
    const before = JSON.parse(fs.readFileSync(beforePath, "utf8"));
    const after = JSON.parse(fs.readFileSync(afterPath, "utf8"));
    console.log("Tables that changed between before and after:\n");
    let anyChanged = false;
    for (const name of Object.keys(after)) {
      const b = before[name];
      const a = after[name];
      if (!b) {
        console.log(`  + NEW TABLE: ${name} (rows=${a.rows})`);
        anyChanged = true;
      } else if (b.rows !== a.rows || b.maxId !== a.maxId) {
        console.log(`  * ${name.padEnd(25)} rows: ${b.rows} → ${a.rows} (Δ ${a.rows - b.rows})   maxId: ${b.maxId} → ${a.maxId}`);
        anyChanged = true;
      }
    }
    if (!anyChanged) console.log("  (no changes in any table)");
    return;
  }

  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });
  const tables = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);

  const snap: Record<string, { rows: number; maxId: number | null }> = {};
  for (const t of tables.recordset as any[]) {
    const name = t.TABLE_NAME;
    try {
      const r = await pool.request().query(`SELECT COUNT(*) AS c FROM [${name}]`);
      const rows = r.recordset[0].c;
      // Find the table's primary int id column (idnXXX_YYY pattern)
      const idCol = await pool.request().query(`
        SELECT TOP 1 COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${name}' AND DATA_TYPE = 'int' AND COLUMN_NAME LIKE 'idn%'
        ORDER BY ORDINAL_POSITION
      `);
      let maxId: number | null = null;
      if (idCol.recordset.length > 0) {
        const m = await pool.request().query(`SELECT MAX([${idCol.recordset[0].COLUMN_NAME}]) AS m FROM [${name}]`);
        maxId = m.recordset[0].m;
      }
      snap[name] = { rows, maxId };
    } catch (e: any) {
      snap[name] = { rows: -1, maxId: null };
    }
  }

  const outPath = mode === "before" ? beforePath : afterPath;
  fs.writeFileSync(outPath, JSON.stringify(snap, null, 2));
  console.log(`Snapshot saved to ${outPath} — ${Object.keys(snap).length} tables captured`);
  await pool.close();
}
main().catch(console.error);
