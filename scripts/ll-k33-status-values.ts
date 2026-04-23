/**
 * Show distinct k33 status values + sample envelopes for each.
 * Used to decide what to set o_stat_k33 to when retiring a poisoned
 * envelope (we want LL to stop piggybacking on it without marking it
 * "posted" — the latter would lie to downstream status sync).
 *
 *   npx tsx scripts/ll-k33-status-values.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const pool = await sql.connect(config);

  for (const col of ["o_stat_k33", "t_stat_k33", "a_stat_k33", "s_stat_k33"]) {
    const q = await pool.request().query(`
      SELECT RTRIM(${col}) AS v, COUNT(*) AS c
      FROM k33_tab
      WHERE ${col} IS NOT NULL
      GROUP BY RTRIM(${col})
      ORDER BY COUNT(*) DESC
    `);
    console.log(`\n=== ${col} — ${q.recordset.length} distinct values ===`);
    for (const r of q.recordset) console.log(`  ${String(r.v).padEnd(24)} ${String(r.c).padStart(8)} envelopes`);

    // Show one sample envelope per status value (most recent)
    const samples = await pool.request().query(`
      WITH ranked AS (
        SELECT idnk33_k33, qotref_k33, ${col} AS v, uptime_k33,
               ROW_NUMBER() OVER (PARTITION BY RTRIM(${col}) ORDER BY uptime_k33 DESC) AS rn
        FROM k33_tab WHERE ${col} IS NOT NULL
      )
      SELECT idnk33_k33, qotref_k33, v, uptime_k33 FROM ranked WHERE rn = 1
      ORDER BY v
    `);
    console.log(`  Sample envelope per value:`);
    for (const r of samples.recordset) {
      const d = r.uptime_k33 ? new Date(r.uptime_k33).toISOString().slice(0, 16) : "?";
      console.log(`    ${String(r.v || "").trim().padEnd(24)} k33=${r.idnk33_k33}  ref=${String(r.qotref_k33 || "").trim()}  last=${d}`);
    }
  }

  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
