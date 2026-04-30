/**
 * Dump captured events from the llk_invoice_trace XE session and
 * pretty-print them (sorted chronologically) so we can read LL UI's
 * exact SQL pattern for CIN_NO allocation.
 *
 * Run AFTER the user has done ONE manual invoice post in LL UI.
 */
import "./env";
import sql from "mssql/msnodesqlv8";

(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Pull the ring-buffer XML from the running session
  const r = await pool.request().query(`
    SELECT CAST(xet.target_data AS XML) AS xml_data
    FROM sys.dm_xe_sessions xs
    JOIN sys.dm_xe_session_targets xet ON xs.address = xet.event_session_address
    WHERE xs.name = 'llk_invoice_trace' AND xet.target_name = 'ring_buffer'
  `);
  if (r.recordset.length === 0) {
    console.error("Session llk_invoice_trace not running. Run xe-trace-setup.ts first.");
    process.exit(1);
  }
  const xml = r.recordset[0].xml_data;

  // Parse events out of the XML
  const events = await pool.request().input("xml", sql.Xml, xml).query(`
    SELECT
      n.value('(@timestamp)[1]', 'datetime2') AS ts,
      n.value('(@name)[1]', 'nvarchar(100)') AS event_name,
      n.value('(data[@name="batch_text"]/value)[1]', 'nvarchar(max)') AS batch_text,
      n.value('(data[@name="statement"]/value)[1]', 'nvarchar(max)') AS statement_text,
      n.value('(action[@name="client_app_name"]/value)[1]', 'nvarchar(255)') AS client_app,
      n.value('(action[@name="client_hostname"]/value)[1]', 'nvarchar(255)') AS client_host,
      n.value('(action[@name="username"]/value)[1]', 'nvarchar(255)') AS username,
      n.value('(action[@name="session_id"]/value)[1]', 'int') AS session_id,
      n.value('(action[@name="sql_text"]/value)[1]', 'nvarchar(max)') AS sql_text
    FROM @xml.nodes('//RingBufferTarget/event') AS T(n)
    ORDER BY ts;
  `);

  console.log(`Captured ${events.recordset.length} matching SQL events:\n`);
  if (events.recordset.length === 0) {
    console.log("  (No events yet. Make sure Abe has done at least one invoice action in LL UI.)");
    await pool.close();
    return;
  }

  for (let i = 0; i < events.recordset.length; i++) {
    const e = events.recordset[i];
    const stmt = e.batch_text || e.statement_text || e.sql_text || "(no text)";
    const stmtSnip = stmt.replace(/\s+/g, " ").trim().slice(0, 300);
    const time = e.ts ? new Date(e.ts).toISOString().slice(11, 23) : "?";
    console.log(`[${i + 1}] ${time}  sid=${e.session_id} app=${String(e.client_app || "").slice(0, 30)} host=${e.client_host} user=${e.username}`);
    console.log(`    ${stmtSnip}${stmt.length > 300 ? "..." : ""}`);
    console.log("");
  }

  // Highlight any CIN_NO-specific events
  console.log("\n══════ CIN_NO-specific events ══════");
  const cinEvents = events.recordset.filter((e: any) => {
    const t = e.batch_text || e.statement_text || e.sql_text || "";
    return /CIN_NO/i.test(t);
  });
  console.log(`${cinEvents.length} events touching CIN_NO\n`);
  for (let i = 0; i < cinEvents.length; i++) {
    const e = cinEvents[i];
    const stmt = (e.batch_text || e.statement_text || e.sql_text || "").replace(/\s+/g, " ").trim();
    const time = e.ts ? new Date(e.ts).toISOString().slice(11, 23) : "?";
    console.log(`[${i + 1}] ${time}  sid=${e.session_id}  ${stmt.slice(0, 400)}`);
    console.log("");
  }

  await pool.close();
})().catch(e => { console.error(e); process.exit(1); });
