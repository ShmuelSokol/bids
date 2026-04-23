/**
 * List the most recent LamLinks quote envelopes with their idnk33 so you
 * can find the one Abe (or anyone else) just created.
 *
 *   npx tsx scripts/ll-list-my-envelopes.ts             (top 20 recent)
 *   npx tsx scripts/ll-list-my-envelopes.ts ajoseph     (filter by upname)
 *   npx tsx scripts/ll-list-my-envelopes.ts --staging   (only "adding quotes")
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const args = process.argv.slice(2);
  const stagingOnly = args.includes("--staging");
  const user = args.find((a) => !a.startsWith("--"));

  const pool = await sql.connect(config);
  const req = pool.request();
  let where = "WHERE 1=1";
  if (stagingOnly) where += ` AND RTRIM(o_stat_k33) = 'adding quotes'`;
  if (user) {
    req.input("u", sql.VarChar, user);
    where += ` AND RTRIM(upname_k33) = @u`;
  }
  const q = await req.query(`
    SELECT TOP 30 idnk33_k33, qotref_k33, o_stat_k33, itmcnt_k33, upname_k33, uptime_k33
    FROM k33_tab
    ${where}
    ORDER BY uptime_k33 DESC
  `);

  console.log(`=== Recent k33 envelopes${user ? ` (upname=${user})` : ""}${stagingOnly ? " (staging only)" : ""} ===\n`);
  console.log("idnk33".padEnd(8) + " " + "ref".padEnd(20) + " " + "status".padEnd(18) + " " + "items".padEnd(6) + " " + "updated".padEnd(22) + " " + "by");
  console.log("-".repeat(100));
  for (const r of q.recordset) {
    console.log(
      String(r.idnk33_k33).padEnd(8) + " " +
      String(r.qotref_k33 || "").trim().padEnd(20) + " " +
      String(r.o_stat_k33 || "").trim().padEnd(18) + " " +
      String(r.itmcnt_k33 ?? "").padEnd(6) + " " +
      (r.uptime_k33 ? new Date(r.uptime_k33).toISOString().replace("T", " ").slice(0, 19) : "").padEnd(22) + " " +
      String(r.upname_k33 || "").trim()
    );
  }

  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
