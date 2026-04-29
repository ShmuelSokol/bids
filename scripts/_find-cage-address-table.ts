/**
 * Find which LL table stores the full address for a CAGE code.
 * Reference DBF for kaj=353355 had K_NAME="0129 CS BN CO A COMPOSITE",
 * K_ADR1="AWCF SSF BLDG 5505A WICKHAM AVE" with K_CODE=W34GMT.
 *
 * Search every k%_tab for "0129 CS BN" or "WICKHAM" to find the source.
 */
import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // List char/varchar columns wide enough to hold an address (>=80) in any k%_tab
  const cols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME LIKE 'k%_tab'
      AND DATA_TYPE IN ('char','varchar','nchar','nvarchar')
      AND CHARACTER_MAXIMUM_LENGTH BETWEEN 50 AND 200
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);
  console.log(`Scanning ${cols.recordset.length} columns...`);

  const found: string[] = [];
  for (const c of cols.recordset) {
    try {
      const r = await pool.request().query(`
        SELECT TOP 1 ${c.COLUMN_NAME} AS v FROM ${c.TABLE_NAME}
        WHERE ${c.COLUMN_NAME} LIKE '%WICKHAM%' OR ${c.COLUMN_NAME} LIKE '%0129 CS%'
           OR ${c.COLUMN_NAME} LIKE '%SOJOURNER%' OR ${c.COLUMN_NAME} LIKE '%HARBOR DRIVE%'
      `);
      if (r.recordset.length > 0) {
        const sample = String(r.recordset[0].v).trim().slice(0, 70);
        found.push(`${c.TABLE_NAME}.${c.COLUMN_NAME}: "${sample}"`);
        console.log(`  HIT: ${c.TABLE_NAME}.${c.COLUMN_NAME} = "${sample}"`);
      }
    } catch (e) { /* skip permission errors etc */ }
  }
  console.log(`\nFound ${found.length} matching columns.`);

  // Once we know the table, dump the full row for CAGE=N2999C
  if (found.length > 0) {
    const firstHit = found[0];
    const tableName = firstHit.split(".")[0];
    console.log(`\n=== Looking up CAGE=N2999C in ${tableName} ===`);
    // Find a CAGE column on this table
    const cageCol = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='${tableName}' AND COLUMN_NAME LIKE '%cage%'
    `);
    if (cageCol.recordset.length > 0) {
      const cageColName = cageCol.recordset[0].COLUMN_NAME;
      const r = await pool.request().query(`SELECT TOP 5 * FROM ${tableName} WHERE LTRIM(RTRIM(${cageColName})) = 'N2999C'`);
      console.log(`  Found ${r.recordset.length} rows for CAGE=N2999C`);
      for (const row of r.recordset) {
        for (const [k, v] of Object.entries(row)) {
          if (v != null && v !== "" && v !== 0) {
            console.log(`    ${k.padEnd(15)} = ${String(v).trim().slice(0, 80)}`);
          }
        }
        console.log("    ---");
      }
    }
  }

  await pool.close();
})().catch(e => { console.error(e); process.exit(1); });
