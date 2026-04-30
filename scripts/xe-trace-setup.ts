/**
 * Set up a SQL Server Extended Events session on NYEVRVSQL001 to capture
 * LL UI's exact SQL pattern when allocating CIN_NOs (and related invoice
 * activity). Use this BEFORE Abe touches LL UI tomorrow morning.
 *
 *   npx tsx scripts/xe-trace-setup.ts        # create + start
 *   npx tsx scripts/xe-trace-dump.ts         # show captured events
 *   npx tsx scripts/xe-trace-stop.ts         # tear down
 *
 * The session captures every SQL statement that touches:
 *   k07_tab (CIN_NO, TRN_ID counters, session state, cursor cache)
 *   kad_tab (invoice header)
 *   kae_tab (invoice line)
 *   kbr_tab (WAWF transmission audit)
 *   ka9_tab (job-line state, ship status)
 *   kdy_tab (sequence counter table — for comparison with bid path)
 *
 * Filtered to llk_db1 only. Ring buffer (10 MB max). Light overhead.
 *
 * After Abe does ONE manual invoice post:
 *   1. Run xe-trace-dump.ts to see captured events
 *   2. Look for the SELECT/UPDATE pattern on k07.CIN_NO
 *   3. Compare to our worker's atomic-UPDATE pattern
 *   4. Decide whether they're compatible or we need coordination
 */
import "./env";
import sql from "mssql/msnodesqlv8";

(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Drop if exists (idempotent setup)
  console.log("Dropping any existing llk_invoice_trace session...");
  try {
    await pool.request().query(`
      IF EXISTS (SELECT 1 FROM sys.server_event_sessions WHERE name = 'llk_invoice_trace')
      BEGIN
        ALTER EVENT SESSION [llk_invoice_trace] ON SERVER STATE = STOP;
        DROP EVENT SESSION [llk_invoice_trace] ON SERVER;
      END
    `);
    console.log("  ✓ cleaned up old session");
  } catch (e: any) {
    console.log(`  (no existing session: ${e.message?.slice(0, 80)})`);
  }

  console.log("\nCreating new XE session llk_invoice_trace...");
  await pool.request().query(`
    CREATE EVENT SESSION [llk_invoice_trace] ON SERVER
    ADD EVENT sqlserver.sql_batch_completed (
      SET collect_batch_text = (1)
      ACTION (
        sqlserver.client_app_name,
        sqlserver.client_hostname,
        sqlserver.username,
        sqlserver.session_id,
        sqlserver.sql_text
      )
      WHERE (
        [sqlserver].[database_name] = N'llk_db1'
        AND (
          [batch_text] LIKE N'%k07_tab%'
          OR [batch_text] LIKE N'%CIN_NO%'
          OR [batch_text] LIKE N'%kad_tab%'
          OR [batch_text] LIKE N'%kae_tab%'
          OR [batch_text] LIKE N'%kbr_tab%'
          OR [batch_text] LIKE N'%ka9_tab%'
          OR [batch_text] LIKE N'%kdy_tab%'
          OR [batch_text] LIKE N'%cinnum%'
        )
      )
    ),
    ADD EVENT sqlserver.rpc_completed (
      SET collect_statement = (1)
      ACTION (
        sqlserver.client_app_name,
        sqlserver.client_hostname,
        sqlserver.username,
        sqlserver.session_id,
        sqlserver.sql_text
      )
      WHERE (
        [sqlserver].[database_name] = N'llk_db1'
        AND (
          [statement] LIKE N'%k07_tab%'
          OR [statement] LIKE N'%CIN_NO%'
          OR [statement] LIKE N'%kad_tab%'
          OR [statement] LIKE N'%kae_tab%'
          OR [statement] LIKE N'%kbr_tab%'
          OR [statement] LIKE N'%ka9_tab%'
          OR [statement] LIKE N'%kdy_tab%'
          OR [statement] LIKE N'%cinnum%'
        )
      )
    )
    ADD TARGET package0.ring_buffer (SET max_memory = (10240))
    WITH (MAX_DISPATCH_LATENCY = 5 SECONDS, STARTUP_STATE = OFF);
  `);
  console.log("  ✓ session created");

  console.log("\nStarting session...");
  await pool.request().query(`ALTER EVENT SESSION [llk_invoice_trace] ON SERVER STATE = START;`);
  console.log("  ✓ session is now CAPTURING");

  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("XE trace is live.");
  console.log("");
  console.log("Now have Abe do ONE manual invoice post in LL UI:");
  console.log("  1. Open invoice form (form-open allocation event)");
  console.log("  2. Type/select an invoice, click Save (form-submit allocation)");
  console.log("  3. Click 810 + 856 buttons (transmission events)");
  console.log("");
  console.log("Then run:  npx tsx scripts/xe-trace-dump.ts");
  console.log("Then run:  npx tsx scripts/xe-trace-stop.ts  (cleanup)");
  console.log("══════════════════════════════════════════════════════════════════");

  await pool.close();
})().catch(e => { console.error(e); process.exit(1); });
