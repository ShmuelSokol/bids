// Bring kdy_tab.idnval_kdy back into sync with MAX(<pk>) for the given table.
// Use this if any tool or past DIBS insert bypassed the kdy protocol and left
// an orphan above idnval. Running this allows Abe's next save to allocate a
// fresh id past any orphans without collision.
//
// Usage:
//   npx tsx scripts/resync-kdy.ts            (dry-run, shows drift)
//   npx tsx scripts/resync-kdy.ts --execute  (applies the fix)

import "./env";
import sql from "mssql/msnodesqlv8";

const TABLES = [
  { tabnam: "k33_tab", pk: "idnk33_k33" },
  { tabnam: "k34_tab", pk: "idnk34_k34" },
  { tabnam: "k35_tab", pk: "idnk35_k35" },
  { tabnam: "k11_tab", pk: "idnk11_k11" },
  { tabnam: "k10_tab", pk: "idnk10_k10" },
];

async function main() {
  const execute = process.argv.includes("--execute");
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  console.log("Checking kdy drift (kdy.idnval vs table MAX):\n");
  const drift: { tabnam: string; idnval: number; max: number }[] = [];
  for (const t of TABLES) {
    const r = await pool.request().query(`
      SELECT
        (SELECT idnval_kdy FROM kdy_tab WHERE tabnam_kdy = '${t.tabnam}') AS idnval,
        (SELECT MAX(${t.pk}) FROM ${t.tabnam}) AS max_id
    `);
    const { idnval, max_id } = r.recordset[0];
    const d = max_id - idnval;
    console.log(`  ${t.tabnam.padEnd(10)}  kdy.idnval=${idnval}  MAX=${max_id}  drift=${d > 0 ? "+" : ""}${d}`);
    if (max_id > idnval) drift.push({ tabnam: t.tabnam, idnval, max: max_id });
  }
  if (drift.length === 0) { console.log("\nNo drift — kdy_tab is in sync."); await pool.close(); return; }

  console.log(`\n${drift.length} table(s) have idnval < MAX. These will be bumped up to MAX:`);
  for (const d of drift) console.log(`  ${d.tabnam}: ${d.idnval} → ${d.max}`);

  if (!execute) { console.log("\nDRY RUN. Re-run with --execute."); await pool.close(); return; }

  for (const d of drift) {
    await pool.request().query(`
      UPDATE kdy_tab SET idnval_kdy = ${d.max}, uptime_kdy = GETDATE()
      WHERE tabnam_kdy = '${d.tabnam}' AND idnval_kdy < ${d.max}
    `);
    console.log(`  ✓ ${d.tabnam}: kdy.idnval bumped to ${d.max}`);
  }

  await pool.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
