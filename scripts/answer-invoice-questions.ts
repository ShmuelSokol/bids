// Answer questions 1-5 from docs/flows/invoicing.md (LamLinks invoice write-back)
// via direct SQL inspection. Reduces what we need from Yosef to Qs 6-7 only.

import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // ----- Q1: cinsta_kad state distribution + recent transitions -----
  console.log("=== Q1: cinsta_kad state transitions ===");
  const states = await pool.request().query(`
    SELECT LTRIM(RTRIM(cinsta_kad)) AS state, COUNT(*) AS c, MAX(uptime_kad) AS last_seen
    FROM kad_tab GROUP BY cinsta_kad ORDER BY c DESC
  `);
  console.log("Distribution:");
  for (const r of states.recordset as any[]) {
    console.log(`  ${r.state.padEnd(15)} ${r.c.toString().padStart(8)}  last_seen=${r.last_seen?.toISOString?.().slice(0, 19)}`);
  }
  console.log("\nRecent 'Not Posted' rows (anything still pending?):");
  const notPosted = await pool.request().query(`
    SELECT TOP 10 idnkad_kad, cin_no_kad, cinnum_kad, cinsta_kad, cisdte_kad, uptime_kad, upname_kad, cindte_kad
    FROM kad_tab WHERE LTRIM(RTRIM(cinsta_kad)) = 'Not Posted' ORDER BY uptime_kad DESC
  `);
  const s = (v: any) => typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v);
  for (const r of notPosted.recordset as any[]) {
    console.log(`  idnkad=${r.idnkad_kad} cin_no="${s(r.cin_no_kad)}" cinnum="${s(r.cinnum_kad)}" uptime=${r.uptime_kad?.toISOString?.().slice(0,19)} cisdte=${r.cisdte_kad?.toISOString?.().slice(0,19)} by=${s(r.upname_kad)}`);
  }
  // Look for invoices that were Not Posted and later became Posted — check if
  // uptime advanced when state flipped (suggests an UPDATE, not a separate row)
  console.log("\nRecent Posted rows with cisdte (create) vs uptime (last modified):");
  const posted = await pool.request().query(`
    SELECT TOP 5 idnkad_kad, cinsta_kad, cisdte_kad, uptime_kad, upname_kad,
           DATEDIFF(MINUTE, cisdte_kad, uptime_kad) AS mins_create_to_update
    FROM kad_tab WHERE LTRIM(RTRIM(cinsta_kad)) = 'Posted' ORDER BY uptime_kad DESC
  `);
  for (const r of posted.recordset as any[]) {
    console.log(`  idnkad=${r.idnkad_kad} mins_create→update=${r.mins_create_to_update} (${s(r.upname_kad)})`);
  }

  // ----- Q2: upname_kad distinct users -----
  console.log("\n=== Q2: upname_kad distinct users ===");
  const users = await pool.request().query(`
    SELECT LTRIM(RTRIM(upname_kad)) AS upname, COUNT(*) AS c, MAX(uptime_kad) AS last
    FROM kad_tab GROUP BY upname_kad ORDER BY c DESC
  `);
  for (const r of users.recordset as any[]) {
    console.log(`  ${r.upname.padEnd(15)} ${r.c.toString().padStart(8)}  last=${r.last?.toISOString?.().slice(0, 19)}`);
  }

  // ----- Q3: idnk31_kad values + what k31 row 203 is -----
  console.log("\n=== Q3: idnk31_kad distribution (customer FK) ===");
  const k31Dist = await pool.request().query(`
    SELECT idnk31_kad, COUNT(*) AS c FROM kad_tab GROUP BY idnk31_kad ORDER BY c DESC
  `);
  for (const r of k31Dist.recordset as any[]) {
    console.log(`  idnk31=${String(r.idnk31_kad).padStart(5)}  ${r.c} invoices`);
  }
  console.log("\nk31 details (customers referenced):");
  const k31Rows = await pool.request().query(`
    SELECT k31.* FROM k31_tab k31
    WHERE k31.idnk31_k31 IN (SELECT DISTINCT idnk31_kad FROM kad_tab)
    ORDER BY k31.idnk31_k31
  `);
  for (const r of k31Rows.recordset as any[]) {
    const cols = Object.entries(r).filter(([k, v]) => v !== null && v !== "" && !k.startsWith("uptime") && !k.startsWith("upname")).slice(0, 10);
    console.log(`  idnk31=${r.idnk31_k31}: ${cols.map(([k, v]) => `${k}=${typeof v === "string" ? v.trim().slice(0, 30) : v}`).join(" | ")}`);
  }

  // ----- Q4: idnk06_kad + what k06 row 1 is -----
  console.log("\n=== Q4: idnk06_kad distribution (org/company FK) ===");
  const k06Dist = await pool.request().query(`
    SELECT idnk06_kad, COUNT(*) AS c FROM kad_tab GROUP BY idnk06_kad ORDER BY c DESC
  `);
  for (const r of k06Dist.recordset as any[]) {
    console.log(`  idnk06=${String(r.idnk06_kad).padStart(5)}  ${r.c} invoices`);
  }
  console.log("\nk06 full table (it's small — only 11 rows):");
  const k06Rows = await pool.request().query(`SELECT * FROM k06_tab ORDER BY idnk06_k06`);
  const k06Cols = Object.keys(k06Rows.recordset[0] || {}).filter((k) => !k.startsWith("uptime") && !k.startsWith("upname"));
  for (const r of k06Rows.recordset as any[]) {
    const parts = k06Cols.map((k) => {
      const v = r[k];
      return v !== null && v !== "" ? `${k}=${typeof v === "string" ? v.trim().slice(0, 40) : v}` : null;
    }).filter(Boolean);
    console.log(`  ${parts.join(" | ")}`);
  }

  // ----- Q5: value-field semantics -----
  console.log("\n=== Q5: value fields — which matches which ===");
  // Pull 30 recent Posted rows, check equality patterns
  const vals = await pool.request().query(`
    SELECT TOP 30 idnkad_kad, pinval_kad, xinval_kad, mslval_kad, nmsval_kad, ppcval_kad, cshval_kad, crmval_kad, otcval_kad, ar_val_kad
    FROM kad_tab WHERE LTRIM(RTRIM(cinsta_kad)) = 'Posted' ORDER BY uptime_kad DESC
  `);
  let allMslEqualsAr = 0, allOthersZero = 0, pinNonzero = 0, xinNonzero = 0, nmsNonzero = 0, crmNonzero = 0;
  for (const r of vals.recordset as any[]) {
    const ms = Number(r.mslval_kad) || 0, ar = Number(r.ar_val_kad) || 0;
    if (Math.abs(ms - ar) < 0.01) allMslEqualsAr++;
    if (Number(r.pinval_kad) > 0) pinNonzero++;
    if (Number(r.xinval_kad) > 0) xinNonzero++;
    if (Number(r.nmsval_kad) > 0) nmsNonzero++;
    if (Number(r.crmval_kad) > 0) crmNonzero++;
    if (Math.abs(Number(r.pinval_kad)||0) < 0.01 && Math.abs(Number(r.xinval_kad)||0) < 0.01 && Math.abs(Number(r.cshval_kad)||0) < 0.01 && Math.abs(Number(r.otcval_kad)||0) < 0.01) allOthersZero++;
  }
  console.log(`  n=30 Posted invoices:`);
  console.log(`    mslval_kad == ar_val_kad: ${allMslEqualsAr}/30`);
  console.log(`    pin/xin/csh/otc all zero: ${allOthersZero}/30`);
  console.log(`    pinval_kad nonzero: ${pinNonzero}/30`);
  console.log(`    xinval_kad nonzero: ${xinNonzero}/30`);
  console.log(`    nmsval_kad nonzero: ${nmsNonzero}/30`);
  console.log(`    crmval_kad nonzero: ${crmNonzero}/30`);

  // Show one row in full as a reference
  console.log(`\n  Sample row (latest Posted):`);
  const one = await pool.request().query(`
    SELECT TOP 1 pinval_kad, xinval_kad, mslval_kad, nmsval_kad, ppcval_kad, cshval_kad, crmval_kad, otcval_kad, ar_val_kad
    FROM kad_tab WHERE LTRIM(RTRIM(cinsta_kad)) = 'Posted' ORDER BY uptime_kad DESC
  `);
  for (const [k, v] of Object.entries(one.recordset[0])) console.log(`    ${k} = ${v}`);

  // ----- Bonus: kdy_tab has rows for kad, kae, ka9? -----
  console.log("\n=== Bonus: kdy_tab entries for invoice chain tables ===");
  const kdy = await pool.request().query(`
    SELECT tabnam_kdy, idnval_kdy, uptime_kdy
    FROM kdy_tab
    WHERE tabnam_kdy IN ('kad_tab','kae_tab','ka9_tab','ka8_tab','kaj_tab')
    ORDER BY tabnam_kdy
  `);
  for (const r of kdy.recordset as any[]) {
    console.log(`  ${r.tabnam_kdy.padEnd(10)}  idnval=${r.idnval_kdy.toString().padStart(10)}  uptime=${r.uptime_kdy?.toISOString?.().slice(0,19)}`);
  }
  // Verify idnval matches MAX(pk) for each
  for (const t of ["kad_tab", "kae_tab", "ka9_tab", "ka8_tab", "kaj_tab"]) {
    const pk = `idn${t.slice(0, 3)}_${t.slice(0, 3)}`;
    const r = await pool.request().query(`
      SELECT (SELECT idnval_kdy FROM kdy_tab WHERE tabnam_kdy='${t}') AS idnval,
             (SELECT MAX(${pk}) FROM ${t}) AS max_pk
    `);
    const { idnval, max_pk } = r.recordset[0];
    console.log(`    ${t}: kdy.idnval=${idnval} vs MAX(${pk})=${max_pk} diff=${idnval - max_pk}`);
  }

  // ----- Bonus: trigger/proc check on invoice chain -----
  console.log("\n=== Bonus: triggers on invoice chain tables ===");
  const trg = await pool.request().query(`
    SELECT t.name AS trigger_name, OBJECT_NAME(t.parent_id) AS table_name, t.is_disabled
    FROM sys.triggers t
    WHERE OBJECT_NAME(t.parent_id) IN ('kad_tab','kae_tab','ka9_tab','ka8_tab','kaj_tab')
  `);
  if (trg.recordset.length === 0) console.log("  (no triggers — confirms LamLinks client does posting logic)");
  for (const r of trg.recordset as any[]) console.log(`  ${r.table_name} → ${r.trigger_name}`);

  await pool.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
