/**
 * Live-trace LL desktop client SQL traffic via SQL Server Extended Events.
 * Targets a specific workstation (default: COOKIE — Abe's hostname) and
 * captures every SQL statement, cursor operation, and RPC it fires.
 *
 * Workflow:
 *   1. start  — create the XE session + begin recording
 *   2. (have Abe do the action you want to trace — click Post, Stage, etc.)
 *   3. read   — print events captured so far (safe to call repeatedly)
 *   4. stop   — end the session + drop it (cleanup)
 *
 * Usage:
 *   npx tsx scripts/trace-ll-client.ts start [host]     # default host=COOKIE
 *   npx tsx scripts/trace-ll-client.ts read [max]       # default max=200 events
 *   npx tsx scripts/trace-ll-client.ts stop
 *   npx tsx scripts/trace-ll-client.ts one-shot [host] [secs]  # start, wait, read, stop
 *
 * Permissions required: ALTER ANY EVENT SESSION + VIEW SERVER STATE.
 * If you hit 'permission denied', ask Yosef to grant them to your login
 * on NYEVRVSQL001 (safe — read-only observability).
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;",
};

const SESSION_NAME = "dibs_ll_trace";
const DEFAULT_HOST = "COOKIE";

async function startSession(host: string, fileMode: boolean) {
  const pool = await sql.connect(config);
  // Drop any previous session with this name (ignore errors)
  try {
    await pool.request().query(`IF EXISTS (SELECT * FROM sys.server_event_sessions WHERE name = '${SESSION_NAME}')
      DROP EVENT SESSION [${SESSION_NAME}] ON SERVER`);
  } catch {}
  // Target: ring buffer for short interactive traces, event_file for long
  // (multi-hour) captures where we don't want events evicted. File lives
  // on SQL Server's LOG directory and rolls at 200 MB.
  const target = fileMode
    ? `ADD TARGET package0.event_file(SET filename = N'D:\\MSSQL11.MSSQLSERVER\\MSSQL\\LOG\\${SESSION_NAME}.xel',
        max_file_size = 200, max_rollover_files = 10)`
    : `ADD TARGET package0.ring_buffer(SET max_memory = 16384, max_events_limit = 20000)`;
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
    ${target}
    WITH (MAX_MEMORY = 16384 KB, EVENT_RETENTION_MODE = ALLOW_SINGLE_EVENT_LOSS,
          MAX_DISPATCH_LATENCY = 3 SECONDS, TRACK_CAUSALITY = ON)
  `);
  await pool.request().query(`ALTER EVENT SESSION [${SESSION_NAME}] ON SERVER STATE = START`);
  await pool.close();
  console.log(`✅ XE session started — filtering by client_hostname='${host}'`);
  console.log(`   Target: ${fileMode ? "event_file (persistent, unlimited)" : "ring_buffer (20K events, in-memory)"}`);
  console.log(`   Have Abe perform the action you want to trace, then:`);
  console.log(`     npx tsx scripts/trace-ll-client.ts read`);
  console.log(`   When done:`);
  console.log(`     npx tsx scripts/trace-ll-client.ts stop`);
}

async function readEvents(max: number) {
  const pool = await sql.connect(config);
  // Detect which target this session is using and read from the right place.
  const r = await pool.request().query(`
    SELECT t.target_name, CAST(t.target_data AS XML) AS xml_data
    FROM sys.dm_xe_sessions s
    JOIN sys.dm_xe_session_targets t ON t.event_session_address = s.address
    WHERE s.name = '${SESSION_NAME}'
  `);
  if (r.recordset.length === 0) {
    console.log(`Session '${SESSION_NAME}' not found. Start it first.`);
    await pool.close();
    return;
  }
  let xml: string;
  if (r.recordset[0].target_name === "event_file") {
    // File-based session — shred the .xel file(s)
    const f = await pool.request().query(`
      SELECT TOP ${Math.max(1, max)} CAST(event_data AS XML) AS xd
      FROM sys.fn_xe_file_target_read_file(
        'D:\\MSSQL11.MSSQLSERVER\\MSSQL\\LOG\\${SESSION_NAME}*.xel', NULL, NULL, NULL
      )
      ORDER BY timestamp_utc DESC
    `);
    xml = "<events>" + f.recordset.map((row: any) => row.xd).join("") + "</events>";
  } else {
    xml = r.recordset[0].xml_data as string;
  }
  // Parse events inline via a second query (uses SQL Server's XML shredding).
  const events = await pool.request()
    .input("xml", sql.NVarChar, xml)
    .query(`
      DECLARE @x XML = @xml;
      SELECT TOP ${Math.max(1, max)}
        e.value('@timestamp', 'DATETIME2')     AS ts,
        e.value('@name', 'VARCHAR(100)')       AS event_name,
        e.value('(data[@name="statement"]/value)[1]',  'NVARCHAR(MAX)') AS statement_text,
        e.value('(data[@name="batch_text"]/value)[1]', 'NVARCHAR(MAX)') AS batch_text,
        e.value('(data[@name="duration"]/value)[1]',   'BIGINT')        AS duration_us,
        e.value('(action[@name="client_hostname"]/value)[1]',  'VARCHAR(100)') AS host,
        e.value('(action[@name="client_app_name"]/value)[1]',  'VARCHAR(200)') AS app,
        e.value('(action[@name="session_id"]/value)[1]',       'INT')           AS spid,
        e.value('(action[@name="username"]/value)[1]',         'VARCHAR(200)') AS login,
        e.value('(action[@name="database_name"]/value)[1]',    'VARCHAR(100)') AS db
      FROM @x.nodes('//event') AS T(e)
      ORDER BY ts DESC
    `);
  await pool.close();
  console.log(`=== ${events.recordset.length} events captured ===\n`);
  for (const row of events.recordset.reverse()) {
    const sqlText = (row.statement_text || row.batch_text || "").trim();
    const durMs = row.duration_us != null ? (Number(row.duration_us) / 1000).toFixed(1) : "?";
    console.log(
      `[${new Date(row.ts).toISOString().slice(11, 23)}] ` +
      `${String(row.event_name).padEnd(26)} ` +
      `db=${String(row.db || "?").padEnd(10)} ` +
      `spid=${String(row.spid || "?").padEnd(4)} ` +
      `app=${String(row.app || "?").slice(0, 30).padEnd(30)} ` +
      `dur=${durMs}ms`
    );
    if (sqlText) {
      const preview = sqlText.slice(0, 280).replace(/\s+/g, " ");
      console.log(`  > ${preview}${sqlText.length > 280 ? "..." : ""}`);
    }
  }
}

async function stopSession() {
  const pool = await sql.connect(config);
  try {
    await pool.request().query(`ALTER EVENT SESSION [${SESSION_NAME}] ON SERVER STATE = STOP`);
    await pool.request().query(`DROP EVENT SESSION [${SESSION_NAME}] ON SERVER`);
    console.log(`✅ XE session stopped + dropped.`);
  } catch (e: any) {
    console.log(`(Session may already be stopped: ${e.message?.slice(0, 80)})`);
  }
  await pool.close();
}

async function oneShot(host: string, seconds: number) {
  await startSession(host);
  console.log(`\n⏳ Capturing for ${seconds} seconds — perform the LL action NOW on ${host}.\n`);
  await new Promise((r) => setTimeout(r, seconds * 1000));
  await readEvents(500);
  await stopSession();
}

async function main() {
  const cmd = process.argv[2];
  try {
    const fileMode = process.argv.includes("--file");
    if (cmd === "start") {
      // First positional arg (skipping --file) is the host
      const host = process.argv.slice(3).find((a) => !a.startsWith("--")) || DEFAULT_HOST;
      await startSession(host, fileMode);
    } else if (cmd === "read") {
      await readEvents(Number(process.argv.slice(3).find((a) => !a.startsWith("--"))) || 200);
    } else if (cmd === "stop") {
      await stopSession();
    } else if (cmd === "one-shot") {
      const pos = process.argv.slice(3).filter((a) => !a.startsWith("--"));
      await oneShot(pos[0] || DEFAULT_HOST, Number(pos[1]) || 60);
    } else {
      console.error(`Usage: trace-ll-client.ts {start|read|stop|one-shot} [args] [--file]`);
      console.error(`  start [host] [--file]       # begin capture (ring buffer default; --file for multi-hour persistent)`);
      console.error(`  read [max]                  # default 200 most recent events`);
      console.error(`  stop                        # cleanup`);
      console.error(`  one-shot [host] [secs]      # start, wait, read+stop`);
      console.error(``);
      console.error(`Examples:`);
      console.error(`  # short ad-hoc capture`);
      console.error(`  npx tsx scripts/trace-ll-client.ts start COOKIE`);
      console.error(`  # have Abe do stuff`);
      console.error(`  npx tsx scripts/trace-ll-client.ts read`);
      console.error(`  npx tsx scripts/trace-ll-client.ts stop`);
      console.error(``);
      console.error(`  # full-day capture to disk`);
      console.error(`  npx tsx scripts/trace-ll-client.ts start COOKIE --file`);
      console.error(`  # ... next morning:`);
      console.error(`  npx tsx scripts/trace-ll-client.ts read 5000`);
      console.error(`  npx tsx scripts/trace-ll-client.ts stop`);
      process.exit(1);
    }
  } catch (e: any) {
    if (/permission|privilege/i.test(e.message || "")) {
      console.error(`❌ ${e.message}`);
      console.error(`\nTo fix, have Yosef run on NYEVRVSQL001:`);
      console.error(`  USE master;`);
      console.error(`  GRANT ALTER ANY EVENT SESSION TO [ERG\\YourLogin];`);
      console.error(`  GRANT VIEW SERVER STATE TO [ERG\\YourLogin];`);
      process.exit(1);
    }
    throw e;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
