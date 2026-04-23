/**
 * Quick sanity check on the schema dump: count every sys.objects type
 * in llk_db1, so we can confirm zero triggers/procs/functions is real
 * and not a VIEW DEFINITION permission issue.
 *
 *   npx tsx scripts/ll-object-type-counts.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({
    connectionString:
      "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  const r = await pool.request().query(`
    SELECT type_desc, COUNT(*) AS c
    FROM sys.objects
    WHERE is_ms_shipped = 0
    GROUP BY type_desc
    ORDER BY c DESC
  `);
  console.log(`\ntype_desc                     count`);
  console.log(`${"─".repeat(40)}`);
  for (const x of r.recordset) {
    console.log(`${x.type_desc.padEnd(30)}${x.c}`);
  }
  console.log(
    `\nIf SQL_TRIGGER / SQL_STORED_PROCEDURE / SQL_SCALAR_FUNCTION counts are > 0, we have a permission issue (can see rows but not read definitions). If those rows are absent entirely, LL truly has no server-side logic and everything lives in the desktop client.`
  );
  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
