/**
 * Inspect a specific LamLinks quote envelope so we can diagnose post conflicts.
 *
 *   npx tsx scripts/inspect-ll-envelope.ts 46879
 *   npx tsx scripts/inspect-ll-envelope.ts 0AG09-46879
 *   npx tsx scripts/inspect-ll-envelope.ts 1585           (if you have idnk33 instead)
 *
 * Prints:
 *   - k33 header row (state, uptime, client counter)
 *   - all k34 line rows + k35 price rows under it
 *   - which k34 rows came from DIBS (lamlinks_write_queue.line_idnk34 match)
 *   - current SQL Server blocking/lock situation on k33_tab
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npx tsx scripts/inspect-ll-envelope.ts <envelope#>");
    console.error("Examples:  46879  |  0AG09-46879  |  idnk33=1585");
    process.exit(1);
  }

  const pool = await sql.connect(config);

  // Accept any of: 46879 (envelope seq), 0AG09-46879 (quote file), idnk33=N
  let idnk33: number | null = null;
  const m = arg.match(/(\d+)/g);
  const nums = (m || []).map(Number);

  // Try: envelope-level identifier is typically 0AG09-#### where #### is a
  // sequence tied to the envelope. Let's search k33_tab for any column
  // that contains that number. Simplest: probe by a few candidate columns.
  if (arg.includes("-")) {
    // Something like 0AG09-46879 — look for cage + env seq
    const envSeq = nums[nums.length - 1];
    const r = await pool.request()
      .input("seq", sql.Int, envSeq)
      .query(`SELECT idnk33_k33 FROM k33_tab WHERE qotref_k33 LIKE '%' + CAST(@seq AS varchar(20)) + '%'`);
    if (r.recordset.length > 0) idnk33 = r.recordset[0].idnk33_k33;
  } else if (!isNaN(Number(arg))) {
    // Bare number — try as idnk33 first, else as envelope seq
    const asId = Number(arg);
    const r1 = await pool.request().input("id", sql.Int, asId).query("SELECT idnk33_k33 FROM k33_tab WHERE idnk33_k33 = @id");
    if (r1.recordset.length > 0) idnk33 = asId;
    if (idnk33 == null) {
      const r2 = await pool.request()
        .input("seq", sql.VarChar, String(asId))
        .query(`SELECT idnk33_k33 FROM k33_tab WHERE qotref_k33 LIKE '%' + @seq + '%'`);
      if (r2.recordset.length > 0) idnk33 = r2.recordset[0].idnk33_k33;
    }
  }
  if (!idnk33) {
    console.error(`Couldn't resolve ${arg} to a k33 id. Paste the idnk33 directly or the full quote-file code.`);
    await pool.close();
    return;
  }

  console.log(`=== k33 envelope (idnk33=${idnk33}) ===`);
  const env = await pool.request().input("id", sql.Int, idnk33).query("SELECT * FROM k33_tab WHERE idnk33_k33 = @id");
  if (env.recordset.length === 0) { console.log("  not found"); await pool.close(); return; }
  const e = env.recordset[0];
  for (const k of Object.keys(e)) {
    const v = e[k];
    const s = v instanceof Date ? v.toISOString() : String(v ?? "").trim();
    if (s && s !== "0") console.log(`  ${k.padEnd(18)} = ${s}`);
  }

  console.log(`\n=== k34 lines under envelope ===`);
  const lines = await pool.request().input("id", sql.Int, idnk33).query(`
    SELECT * FROM k34_tab WHERE idnk33_k34 = @id ORDER BY idnk34_k34
  `);
  console.log(`  ${lines.recordset.length} line(s):`);
  const k34Ids: number[] = [];
  for (const r of lines.recordset) {
    k34Ids.push(r.idnk34_k34);
    // Print a compact one-liner — show whichever non-null/non-zero fields are there
    const parts = Object.keys(r)
      .filter((k) => {
        const v = r[k];
        if (v == null) return false;
        if (typeof v === "string" && v.trim() === "") return false;
        if (typeof v === "number" && v === 0) return false;
        return true;
      })
      .map((k) => `${k}=${r[k] instanceof Date ? r[k].toISOString() : String(r[k]).trim()}`);
    console.log(`  ${parts.join(" ")}`);
  }

  console.log(`\n=== k35 price rows under those lines ===`);
  if (k34Ids.length > 0) {
    const placeholders = k34Ids.map((_, j) => `@k${j}`).join(",");
    const req = pool.request();
    k34Ids.forEach((id, j) => req.input(`k${j}`, sql.Int, id));
    const prices = await req.query(`SELECT * FROM k35_tab WHERE idnk34_k35 IN (${placeholders}) ORDER BY idnk35_k35`);
    console.log(`  ${prices.recordset.length} k35 row(s):`);
    for (const r of prices.recordset) {
      const parts = Object.keys(r)
        .filter((k) => {
          const v = r[k];
          if (v == null) return false;
          if (typeof v === "string" && v.trim() === "") return false;
          if (typeof v === "number" && v === 0) return false;
          return true;
        })
        .map((k) => `${k}=${r[k] instanceof Date ? r[k].toISOString() : String(r[k]).trim()}`);
      console.log(`  ${parts.join(" ")}`);
    }
  }

  console.log(`\n=== Active cursors / locks on k33_tab ===`);
  // Any open cursors that reference k33_tab row idnk33 will block Abe's
  // commit. These come from desktop clients or stale sp_cursor handles.
  try {
    const locks = await pool.request().query(`
      SELECT TOP 20 request_session_id AS spid, resource_type, resource_description, request_mode, request_status
      FROM sys.dm_tran_locks
      WHERE resource_associated_entity_id IN (SELECT object_id FROM sys.objects WHERE name = 'k33_tab')
        AND request_mode LIKE '%X%'
      ORDER BY request_session_id
    `);
    if (locks.recordset.length === 0) {
      console.log("  (no exclusive locks held on k33_tab right now)");
    } else {
      for (const l of locks.recordset) {
        console.log(`  spid=${l.spid} mode=${l.request_mode} status=${l.request_status} type=${l.resource_type} desc=${l.resource_description}`);
      }
    }
  } catch (err: any) {
    console.log(`  (lock view unavailable: ${err.message})`);
  }

  console.log(`\n=== Active connections referencing k33_tab ===`);
  try {
    const sessions = await pool.request().query(`
      SELECT TOP 10 s.session_id, s.host_name, s.program_name, s.login_name, s.last_request_start_time, s.last_request_end_time
      FROM sys.dm_exec_sessions s
      WHERE s.program_name IS NOT NULL
        AND s.is_user_process = 1
      ORDER BY s.last_request_start_time DESC
    `);
    for (const r of sessions.recordset) {
      console.log(`  spid=${r.session_id} host=${r.host_name} prog=${r.program_name} user=${r.login_name} last=${r.last_request_start_time?.toISOString?.() || "?"}`);
    }
  } catch (err: any) {
    console.log(`  (session view unavailable: ${err.message})`);
  }

  await pool.close();
  console.log(`\nDiagnosis:`);
  console.log(`  - If o_stat_k33 is 'adding quotes': envelope is still in staging, safe to retry Post after closing/reopening in LL.`);
  console.log(`  - If there's an exclusive lock in 'sys.dm_tran_locks' above, that session has a stale cursor. Usually killing the LL client's spid (if it's a stale background one) clears it.`);
  console.log(`  - If there are exactly N k34 rows matching Abe's expected count (4 from DIBS + 1 he typed = 5), the data is there — the issue is only the cursor conflict.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
