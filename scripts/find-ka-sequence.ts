// The invoice chain tables (ka8, ka9, kad, kae, kaj) have NO entry in kdy_tab.
// They must allocate ids via another mechanism. Find it.

import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // 1. Do ka tables have IDENTITY property on their PK?
  console.log("=== Do ka-chain tables use IDENTITY columns? ===");
  for (const t of ["kad_tab", "kae_tab", "ka9_tab", "ka8_tab", "kaj_tab"]) {
    const r = await pool.request().query(`
      SELECT c.name, c.is_identity, i.seed_value, i.increment_value, i.last_value
      FROM sys.columns c
      LEFT JOIN sys.identity_columns i ON i.object_id = c.object_id AND i.column_id = c.column_id
      WHERE c.object_id = OBJECT_ID('${t}') AND c.name LIKE 'idn${t.slice(0,3)}_${t.slice(0,3)}'
    `);
    const col = r.recordset[0];
    if (col) {
      console.log(`  ${t}.${col.name}: is_identity=${col.is_identity}${col.is_identity ? ` seed=${col.seed_value} inc=${col.increment_value} last=${col.last_value}` : ""}`);
    } else {
      console.log(`  ${t}: no PK col found`);
    }
  }

  // 2. Broader kdy_tab — is there any row for the ka-chain? Maybe under different tabnam
  console.log("\n=== All kdy_tab entries containing 'ka' or 'a' ===");
  const kdy = await pool.request().query(`
    SELECT tabnam_kdy, idnnam_kdy, idnval_kdy FROM kdy_tab
    WHERE tabnam_kdy LIKE '%ka%' OR tabnam_kdy LIKE 'a%' OR idnnam_kdy LIKE '%ka%'
  `);
  for (const r of kdy.recordset as any[]) {
    console.log(`  tabnam="${r.tabnam_kdy}" idnnam="${r.idnnam_kdy}" val=${r.idnval_kdy}`);
  }
  if (kdy.recordset.length === 0) console.log("  (no kdy entries for ka tables)");

  // 3. Find any int column anywhere whose value is very close to MAX of a ka table
  console.log("\n=== Scanning ALL int columns for values near ka-table MAX ===");
  const targets = [
    { name: "kad_tab max", val: 297162 },
    { name: "kae_tab max", val: 307452 },
    { name: "ka9_tab max", val: 357223 },
    { name: "ka8_tab max", val: 225727 },
    { name: "kaj_tab max", val: 352113 },
  ];
  const intCols = await pool.request().query(`
    SELECT c.TABLE_NAME, c.COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS c
    INNER JOIN INFORMATION_SCHEMA.TABLES t ON c.TABLE_NAME = t.TABLE_NAME
    WHERE c.DATA_TYPE IN ('int','bigint','numeric') AND t.TABLE_TYPE = 'BASE TABLE'
      AND c.TABLE_NAME NOT IN ('ka8_tab','ka9_tab','kad_tab','kae_tab','kaj_tab')
      -- Also exclude tables that hold lots of business data (idnxxx_xxx PKs are noisy)
  `);
  for (const target of targets) {
    let hits: string[] = [];
    for (const c of intCols.recordset as any[]) {
      try {
        const r = await pool.request().query(`
          SELECT TOP 1 [${c.COLUMN_NAME}] AS v FROM [${c.TABLE_NAME}]
          WHERE [${c.COLUMN_NAME}] BETWEEN ${target.val - 5} AND ${target.val + 100}
            AND NOT ([${c.COLUMN_NAME}] IS NULL)
        `);
        if (r.recordset.length > 0) hits.push(`${c.TABLE_NAME}.${c.COLUMN_NAME}=${r.recordset[0].v}`);
      } catch { /* skip */ }
    }
    console.log(`\n  ${target.name} (~${target.val}): ${hits.length} hits`);
    for (const h of hits.slice(0, 20)) console.log(`    ${h}`);
  }

  // 4. Look for tables named like sequence holders — patterns I haven't tried
  console.log("\n=== All base tables <=50 rows with int columns (could be sequence holders) ===");
  const small = await pool.request().query(`
    SELECT t.name AS tn, p.rows
    FROM sys.tables t
    INNER JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
    WHERE p.rows BETWEEN 1 AND 50
    ORDER BY p.rows
  `);
  console.log(`  ${small.recordset.length} small tables to inspect (<50 rows)`);
  // Dump any row that has an int value > 100000 (sequences track large ids)
  for (const t of small.recordset as any[]) {
    try {
      const r = await pool.request().query(`SELECT * FROM [${t.tn}]`);
      for (const row of r.recordset as any[]) {
        for (const [k, v] of Object.entries(row)) {
          if (typeof v === "number" && v > 100000 && v < 10_000_000 && !k.startsWith("idn") && !k.startsWith("uptime") && !k.startsWith("adtime")) {
            console.log(`    ${t.tn}.${k} = ${v}`);
          }
        }
      }
    } catch { /* skip */ }
  }

  await pool.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
