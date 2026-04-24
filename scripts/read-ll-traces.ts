/**
 * Read both XE traces (client + server) directly from the .xel files.
 * More robust than the existing read — doesn't depend on a specific
 * SQL Server column name (timestamp_utc vs. timestamp vs. event_sequence).
 *
 *   npx tsx scripts/read-ll-traces.ts [max=200] [tables=kad,kae,kbr,...]
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;",
};

async function readSession(sessionPrefix: string, label: string, max: number, tableFilter: string[]) {
  const pool = await sql.connect(config);
  // Discover the right columns for this server's fn_xe_file_target_read_file
  const cols = await pool.request().query(
    `SELECT TOP 1 * FROM sys.fn_xe_file_target_read_file(
       'D:\\MSSQL11.MSSQLSERVER\\MSSQL\\LOG\\${sessionPrefix}*.xel', NULL, NULL, NULL)`
  );
  const availableCols = cols.recordset.length > 0 ? Object.keys(cols.recordset[0]) : [];
  const hasTimestampUtc = availableCols.includes("timestamp_utc");
  const orderCol = hasTimestampUtc ? "timestamp_utc" : "file_offset";

  const r = await pool.request().query(`
    SELECT TOP ${max} CAST(event_data AS XML) AS xd
    FROM sys.fn_xe_file_target_read_file(
      'D:\\MSSQL11.MSSQLSERVER\\MSSQL\\LOG\\${sessionPrefix}*.xel', NULL, NULL, NULL
    )
    ORDER BY ${orderCol} DESC
  `);

  console.log(`\n===== ${label} (${r.recordset.length} most recent events) =====`);

  let matched = 0;
  let total = 0;
  const tableCounts: Record<string, number> = {};
  const userCounts: Record<string, number> = {};
  const sample: any[] = [];

  for (const row of r.recordset) {
    total++;
    const xml = row.xd as string;
    // Extract SQL text + attributes
    const stmt =
      /<data name="(?:statement|batch_text)"><value>([^<]*)<\/value>/s.exec(xml)?.[1] ??
      /<data name="statement"><type[^/]*\/><value>([^<]*)<\/value>/s.exec(xml)?.[1] ??
      "";
    const decodedStmt = stmt
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    const host = /<action name="client_hostname"><type[^/]*\/><value>([^<]*)<\/value>/.exec(xml)?.[1] ?? "";
    const user = /<action name="username"><type[^/]*\/><value>([^<]*)<\/value>/.exec(xml)?.[1] ?? "";
    const db = /<action name="database_name"><type[^/]*\/><value>([^<]*)<\/value>/.exec(xml)?.[1] ?? "";
    const ts = /<event[^>]*timestamp="([^"]*)"/.exec(xml)?.[1] ?? "";

    if (user) userCounts[user] = (userCounts[user] || 0) + 1;

    // Count tables touched in SQL text
    for (const m of decodedStmt.matchAll(/\b([a-z][a-z0-9_]*_tab|k\d{2}_[a-z_]+|kd[a-z]_tab|kae_tab)\b/gi)) {
      const t = m[1].toLowerCase();
      tableCounts[t] = (tableCounts[t] || 0) + 1;
    }

    // Filter by tables of interest
    if (tableFilter.length === 0 || tableFilter.some((t) => decodedStmt.toLowerCase().includes(t.toLowerCase()))) {
      matched++;
      if (sample.length < 10 && decodedStmt.length > 10) {
        sample.push({
          ts: ts.slice(0, 19),
          host,
          user,
          db,
          stmt: decodedStmt.slice(0, 300).replace(/\s+/g, " "),
        });
      }
    }
  }

  console.log(`Total events read: ${total}`);
  console.log(`Matched table filter [${tableFilter.join(", ") || "any"}]: ${matched}`);
  console.log(`\nUsers hitting this host:`);
  for (const [u, n] of Object.entries(userCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${u.padEnd(30)} ${n}`);
  }
  console.log(`\nTop tables touched (in SQL text):`);
  const sortedTables = Object.entries(tableCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [t, n] of sortedTables) console.log(`  ${t.padEnd(25)} ${n}`);

  if (sample.length > 0) {
    console.log(`\nSample matching statements (most recent first):`);
    for (const s of sample) {
      console.log(`  [${s.ts}] ${s.user}@${s.host} db=${s.db}`);
      console.log(`    ${s.stmt}`);
    }
  }

  await pool.close();
}

async function main() {
  const max = Number(process.argv[2]) || 200;
  const tableFilterArg = process.argv[3];
  const tableFilter = tableFilterArg ? tableFilterArg.split(",") : [];

  await readSession("dibs_ll_trace", "CLIENT-SIDE (COOKIE)", max, tableFilter);
  await readSession("dibs_ll_trace_server", "SERVER-SIDE (NYEVRVTC001)", max, tableFilter);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
