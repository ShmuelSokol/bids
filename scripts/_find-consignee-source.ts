/**
 * Find where consignee (party N — ship-to destination) data comes from for
 * an invoice. Reference data showed USNS SOJOURNER TRUTH with CAGE N2999C
 * for kaj=353355 (the procmon-captured invoice).
 */
import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Inspect kaj_tab schema for ship-to fields
  console.log("=== kaj_tab ALL columns ===");
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME='kaj_tab' ORDER BY ORDINAL_POSITION
  `);
  console.log(cols.recordset.map((r:any)=>r.COLUMN_NAME).join(", "));

  // Sample our test kaj's full row
  console.log("\n=== kaj=353349 row (CIN0066186) — non-empty fields ===");
  const r = await pool.request().query(`SELECT * FROM kaj_tab WHERE idnkaj_kaj = 353349`);
  for (const [k, v] of Object.entries(r.recordset[0] || {})) {
    if (v != null && v !== "" && v !== 0 && !(v instanceof Date && v.getTime() < new Date('2000-01-01').getTime())) {
      const display = v instanceof Date ? v.toISOString() : String(v).trim();
      if (display) console.log(`  ${k.padEnd(20)} = ${display.slice(0, 80)}`);
    }
  }

  // Check k81 for related routing/CAGE — ordrno/tcn often encode destination
  console.log("\n=== k81 rows for our kaj's k80 ===");
  const k81 = await pool.request().query(`
    SELECT k81.idnk81_k81, LTRIM(RTRIM(k81.ordrno_k81)) AS ordrno, LTRIM(RTRIM(k81.tcn_k81)) AS tcn,
           LTRIM(RTRIM(k81.fob_od_k81)) AS fob_od, LTRIM(RTRIM(k81.acrn_k81)) AS acrn
    FROM k81_tab k81
    INNER JOIN k80_tab k80 ON k80.idnk80_k80 = k81.idnk80_k81
    INNER JOIN kaj_tab kaj ON kaj.idnk80_kaj = k80.idnk80_k80
    WHERE kaj.idnkaj_kaj = 353349
  `);
  for (const row of k81.recordset) console.log(`  ${JSON.stringify(row)}`);

  // Find tables that might have CAGE-keyed destination data
  console.log("\n=== Tables with cage/code/destination columns ===");
  const candidates = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME LIKE 'k%_tab' AND TABLE_NAME NOT IN ('k81_tab','k80_tab','k79_tab','k08_tab','k71_tab','kaj_tab','kad_tab','kae_tab','ka9_tab')
      AND (COLUMN_NAME LIKE '%cage%' OR COLUMN_NAME LIKE '%consign%' OR COLUMN_NAME LIKE '%shipto%' OR COLUMN_NAME LIKE '%delto%' OR COLUMN_NAME LIKE '%dest%' OR COLUMN_NAME LIKE '%markto%' OR COLUMN_NAME LIKE '%markfor%')
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);
  for (const c of candidates.recordset.slice(0, 30)) console.log(`  ${c.TABLE_NAME}.${c.COLUMN_NAME}`);

  await pool.close();
})().catch(e => { console.error(e); process.exit(1); });
