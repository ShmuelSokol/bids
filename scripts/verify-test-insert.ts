import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // 1. Envelope state
  const env = await pool.request().query(`
    SELECT idnk33_k33, upname_k33, o_stat_k33, t_stat_k33, a_stat_k33, s_stat_k33, itmcnt_k33,
           (SELECT COUNT(*) FROM k34_tab WHERE idnk33_k34 = 46852) AS actual_lines
    FROM k33_tab WHERE idnk33_k33 = 46852
  `);
  const e = env.recordset[0];
  console.log(`Envelope 46852:`);
  console.log(`  o_stat = "${e.o_stat_k33?.trim()}"   t_stat = "${e.t_stat_k33?.trim()}"   itmcnt = ${e.itmcnt_k33}   actual_lines = ${e.actual_lines}`);
  console.log(`  (still in staging? ${e.o_stat_k33?.trim() === "adding quotes" ? "YES ✓" : "NO ✗"})`);

  // 2. All 10 lines under envelope — ordered by idnk34 to see our row at the bottom
  const lines = await pool.request().query(`
    SELECT k34.idnk34_k34, k34.idnk11_k34, k10.sol_no_k10, k08.niin_k08, k34.pn_k34, k34.mcage_k34,
           k34.solqty_k34, k34.qty_ui_k34, k35.qty_k35, k35.up_k35, k35.daro_k35
    FROM k34_tab k34
    INNER JOIN k11_tab k11 ON k34.idnk11_k34 = k11.idnk11_k11
    INNER JOIN k10_tab k10 ON k11.idnk10_k11 = k10.idnk10_k10
    INNER JOIN k08_tab k08 ON k11.idnk08_k11 = k08.idnk08_k08
    LEFT JOIN k35_tab k35 ON k35.idnk34_k35 = k34.idnk34_k34
    WHERE k34.idnk33_k34 = 46852
    ORDER BY k34.idnk34_k34
  `);
  console.log(`\nAll ${lines.recordset.length} lines under envelope 46852:`);
  for (const L of lines.recordset as any[]) {
    const marker = L.idnk34_k34 === 495731 ? " ← OUR TEST LINE" : "";
    console.log(`  k34=${L.idnk34_k34}  ${L.sol_no_k10?.trim().padEnd(20)}  NIIN ${L.niin_k08}  pn="${L.pn_k34?.trim()}"  mcage=${L.mcage_k34}  ${L.solqty_k34}${L.qty_ui_k34?.trim()}  →  $${L.up_k35} × ${L.qty_k35}, ${L.daro_k35}d${marker}`);
  }

  // 3. Field-by-field diff: our row vs template 495722
  console.log(`\nDiff of k34 495731 (ours) vs 495722 (template) — only showing differences:`);
  const cols = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='k34_tab' ORDER BY ORDINAL_POSITION`);
  const colNames = cols.recordset.map((c: any) => c.COLUMN_NAME);
  const ours = (await pool.request().query(`SELECT * FROM k34_tab WHERE idnk34_k34 = 495731`)).recordset[0];
  const tmpl = (await pool.request().query(`SELECT * FROM k34_tab WHERE idnk34_k34 = 495722`)).recordset[0];
  let diffCount = 0;
  for (const c of colNames) {
    const a = ours[c], b = tmpl[c];
    const aS = a instanceof Date ? a.toISOString() : String(a).trim();
    const bS = b instanceof Date ? b.toISOString() : String(b).trim();
    if (aS !== bS) {
      console.log(`  ${c.padEnd(15)}  ours="${aS.slice(0,40)}"  tmpl="${bS.slice(0,40)}"`);
      diffCount++;
    }
  }
  console.log(`  Total fields differing: ${diffCount} (expected ~8)`);

  // 4. The k35 price row
  const k35 = (await pool.request().query(`SELECT * FROM k35_tab WHERE idnk35_k35 = 503368`)).recordset[0];
  console.log(`\nk35 503368:`, JSON.stringify(k35));

  // 5. Nothing else wrote to k33/k34/k35 since our insert?
  const recent = await pool.request().query(`
    SELECT TOP 5 idnk34_k34, uptime_k34, upname_k34, idnk33_k34 FROM k34_tab ORDER BY idnk34_k34 DESC
  `);
  console.log(`\nMost recent 5 k34 rows (any envelope):`);
  for (const r of recent.recordset as any[]) console.log(`  k34=${r.idnk34_k34}  upname=${r.upname_k34?.trim()}  envelope=${r.idnk33_k34}  ${r.uptime_k34?.toISOString?.()}`);

  await pool.close();
}
main().catch(console.error);
