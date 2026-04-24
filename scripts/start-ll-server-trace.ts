/**
 * Start a SECOND XEvents capture filtered to the LL server box (NYEVRVTC001
 * by default — the host running the LamLinks server-side daemon). Runs
 * in parallel with the existing dibs_ll_trace session that captures
 * Abe's COOKIE workstation. Together they cover both ends of the
 * client-and-server picture: every SQL fired by the desktop AND every
 * SQL fired by the daemon.
 *
 * Why a separate session: the main trace-ll-client.ts uses a hardcoded
 * session name. Running it twice would clobber the first. This script
 * uses a distinct session name so both can coexist.
 *
 *   npx tsx scripts/start-ll-server-trace.ts                     # default host=NYEVRVTC001
 *   npx tsx scripts/start-ll-server-trace.ts NYEVRVTC001
 *
 * Stop later with:
 *   npx tsx scripts/stop-ll-server-trace.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const SESSION_NAME = "dibs_ll_trace_server";
const DEFAULT_HOST = "NYEVRVTC001";

async function main() {
  const host = process.argv[2] || DEFAULT_HOST;
  const pool = await sql.connect({
    connectionString:
      "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;",
  });
  // Drop existing session with this name (ignore errors)
  try {
    await pool.request().query(`IF EXISTS (SELECT * FROM sys.server_event_sessions WHERE name = '${SESSION_NAME}')
      DROP EVENT SESSION [${SESSION_NAME}] ON SERVER`);
  } catch {}
  await pool.request().query(`
    CREATE EVENT SESSION [${SESSION_NAME}] ON SERVER
    ADD EVENT sqlserver.sql_batch_completed(
      ACTION (sqlserver.client_hostname, sqlserver.client_app_name, sqlserver.session_id, sqlserver.username, sqlserver.database_name)
      WHERE sqlserver.client_hostname = N'${host}'
    ),
    ADD EVENT sqlserver.sql_statement_completed(
      ACTION (sqlserver.client_hostname, sqlserver.client_app_name, sqlserver.session_id, sqlserver.username, sqlserver.database_name)
      WHERE sqlserver.client_hostname = N'${host}'
    ),
    ADD EVENT sqlserver.rpc_completed(
      ACTION (sqlserver.client_hostname, sqlserver.client_app_name, sqlserver.session_id, sqlserver.username, sqlserver.database_name)
      WHERE sqlserver.client_hostname = N'${host}'
    )
    ADD TARGET package0.event_file(SET filename = N'D:\\MSSQL11.MSSQLSERVER\\MSSQL\\LOG\\${SESSION_NAME}.xel',
      max_file_size = 200, max_rollover_files = 10)
    WITH (MAX_MEMORY = 16384 KB, EVENT_RETENTION_MODE = ALLOW_SINGLE_EVENT_LOSS,
          MAX_DISPATCH_LATENCY = 3 SECONDS, TRACK_CAUSALITY = ON)
  `);
  await pool.request().query(`ALTER EVENT SESSION [${SESSION_NAME}] ON SERVER STATE = START`);
  await pool.close();
  console.log(`✅ Server-side XE session started — filtering by client_hostname='${host}'`);
  console.log(`   Session name: ${SESSION_NAME}`);
  console.log(`   Output file: D:\\MSSQL11.MSSQLSERVER\\MSSQL\\LOG\\${SESSION_NAME}.xel`);
  console.log(`\n   Both traces (client + server) now running in parallel.`);
  console.log(`   Stop server-side trace later: npx tsx scripts/stop-ll-server-trace.ts`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
