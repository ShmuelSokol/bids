/**
 * Show every process/connection that's talked to llk_db1 recently. If
 * there's a server-side LL Windows service, its connections should show
 * up here with a distinctive program_name or host_name.
 *
 *   npx tsx scripts/who-talks-to-llk.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;",
};

async function main() {
  const pool = await sql.connect(config);

  console.log(`\n=== Active sessions currently connected to llk_db1 ===\n`);
  const active = await pool.request().query(`
    SELECT
      s.session_id, s.login_name, s.host_name, s.program_name,
      s.login_time, s.last_request_start_time,
      DB_NAME(s.database_id) AS current_db
    FROM sys.dm_exec_sessions s
    WHERE s.is_user_process = 1 AND s.database_id = DB_ID('llk_db1')
    ORDER BY s.last_request_start_time DESC
  `);
  if (active.recordset.length === 0) console.log(`  (no active sessions in llk_db1 right now)`);
  for (const r of active.recordset) {
    console.log(`  spid=${r.session_id}  login=${r.login_name}  host=${r.host_name}  prog="${r.program_name || ""}"`);
    console.log(`    logged in ${r.login_time?.toISOString?.() || r.login_time}, last req ${r.last_request_start_time?.toISOString?.() || r.last_request_start_time}`);
  }

  console.log(`\n=== All distinct program_names that have connected (aggregated live sessions) ===`);
  const progs = await pool.request().query(`
    SELECT program_name, host_name, COUNT(*) AS sessions, MAX(login_time) AS most_recent_login
    FROM sys.dm_exec_sessions
    WHERE is_user_process = 1
    GROUP BY program_name, host_name
    ORDER BY most_recent_login DESC
  `);
  for (const r of progs.recordset) {
    console.log(`  host=${String(r.host_name || "").padEnd(20)} prog="${(r.program_name || "").slice(0, 50).padEnd(50)}" sessions=${r.sessions} most_recent_login=${r.most_recent_login?.toISOString?.() || r.most_recent_login}`);
  }

  console.log(`\n=== Read the ringbuffer for login events (past connections we missed) ===`);
  try {
    const logins = await pool.request().query(`
      SELECT TOP 30
        xe.event_data.value('(@timestamp)[1]', 'DATETIME2') AS ts,
        xe.event_data.value('(action[@name="client_hostname"]/value)[1]', 'NVARCHAR(100)') AS host,
        xe.event_data.value('(action[@name="client_app_name"]/value)[1]', 'NVARCHAR(200)') AS app,
        xe.event_data.value('(data[@name="database_name"]/value)[1]', 'NVARCHAR(100)') AS db,
        xe.event_data.value('(action[@name="username"]/value)[1]', 'NVARCHAR(200)') AS login_name
      FROM (
        SELECT CAST(xet.target_data AS XML) AS target_xml
        FROM sys.dm_xe_session_targets xet
        JOIN sys.dm_xe_sessions xes ON xes.address = xet.event_session_address
        WHERE xes.name = 'system_health' AND xet.target_name = 'ring_buffer'
      ) AS x
      CROSS APPLY x.target_xml.nodes('//RingBufferTarget/event') AS xe(event_data)
      WHERE xe.event_data.value('(@name)[1]', 'NVARCHAR(100)') IN ('login', 'logout')
      ORDER BY ts DESC
    `);
    if (logins.recordset.length === 0) console.log(`  (no login events in system_health ring buffer)`);
    for (const r of logins.recordset) console.log(`  ${r.ts?.toISOString?.() || r.ts} ${String(r.host || "?").padEnd(15)} ${String(r.app || "?").slice(0, 40).padEnd(40)} db=${r.db || "?"} user=${r.login_name || "?"}`);
  } catch (e: any) {
    console.log(`  (system_health ring buffer read failed: ${e.message?.slice(0, 80)})`);
  }

  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
