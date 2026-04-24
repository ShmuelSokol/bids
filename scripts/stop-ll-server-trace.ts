/**
 * Stop the server-side XEvents trace (started by start-ll-server-trace.ts).
 * Reads any pending events first, then drops the session.
 *
 *   npx tsx scripts/stop-ll-server-trace.ts            # read+stop
 *   npx tsx scripts/stop-ll-server-trace.ts --keep     # read only, leave running
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const SESSION_NAME = "dibs_ll_trace_server";
const KEEP = process.argv.includes("--keep");

async function main() {
  const pool = await sql.connect({
    connectionString:
      "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;",
  });

  // Verify session exists
  const r = await pool.request().query(`
    SELECT s.name, s.create_time
    FROM sys.dm_xe_sessions s
    WHERE s.name = '${SESSION_NAME}'
  `);
  if (r.recordset.length === 0) {
    console.log(`Session '${SESSION_NAME}' not found.`);
    await pool.close();
    return;
  }
  console.log(`Session '${SESSION_NAME}' found, started ${r.recordset[0].create_time}`);

  if (!KEEP) {
    await pool.request().query(`ALTER EVENT SESSION [${SESSION_NAME}] ON SERVER STATE = STOP`);
    await pool.request().query(`DROP EVENT SESSION [${SESSION_NAME}] ON SERVER`);
    console.log(`✅ Stopped + dropped. The .xel file(s) remain on disk for analysis.`);
    console.log(`   Read with: scripts/read-ll-trace-files.ts`);
  } else {
    console.log(`(Session left running per --keep)`);
  }
  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
