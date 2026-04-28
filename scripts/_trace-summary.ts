import "./env";
import sql from "mssql/msnodesqlv8";

(async () => {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;", requestTimeout: 120_000 });
  for (const prefix of ["dibs_ll_trace", "dibs_ll_trace_server"]) {
    console.log("\n===== " + prefix + " =====");
    const path = "D:\\MSSQL11.MSSQLSERVER\\MSSQL\\LOG\\" + prefix + "*.xel";
    try {
      const r = await pool.request().input("p", sql.VarChar, path).query("SELECT COUNT(*) AS c FROM sys.fn_xe_file_target_read_file(@p, NULL, NULL, NULL)");
      console.log("  total events: " + r.recordset[0].c);
    } catch (e: any) { console.log("  count err"); continue; }

    // Grab last 100 events (no ORDER BY — naturally chronological as files roll)
    // Count events created in the active window (after we restarted Sunday 22:29 UTC)
    try {
      const r0 = await pool.request().input("p", sql.VarChar, path).query(`
        SELECT COUNT(*) AS c
        FROM sys.fn_xe_file_target_read_file(@p, NULL, NULL, NULL)
        WHERE CAST(event_data AS XML).value('(/event/@timestamp)[1]', 'DATETIME2') >= '2026-04-26T22:30:00'
      `);
      console.log("  events since Sunday 22:30 UTC restart: " + r0.recordset[0].c);
    } catch (e: any) { console.log("  recent-count err: " + (e.message || "").slice(0, 100)); }

    try {
      const r2 = await pool.request().input("p", sql.VarChar, path).query(`
        SELECT TOP 200 CAST(event_data AS XML) AS xd
        FROM sys.fn_xe_file_target_read_file(@p, NULL, NULL, NULL)
      `);
      const hourCount = new Map<string, number>();
      let earliest = "9999"; let latest = "0";
      for (const row of r2.recordset) {
        const ts = (/<event[^>]*timestamp="([^"]*)"/.exec(row.xd as string) || [])[1];
        if (!ts) continue;
        if (ts < earliest) earliest = ts;
        if (ts > latest) latest = ts;
        const hour = ts.slice(0, 13);
        hourCount.set(hour, (hourCount.get(hour) || 0) + 1);
      }
      console.log("  sample window: " + earliest + " → " + latest);
      console.log("  events by UTC hour (in sample):");
      for (const [h, c] of [...hourCount.entries()].sort()) {
        console.log("    " + h + ":00Z  " + c);
      }
    } catch (e: any) { console.log("  sample err: " + (e.message || "").slice(0, 100)); }

    // Also: distinct hosts/apps in last 200 events
    try {
      const r3 = await pool.request().input("p", sql.VarChar, path).query(`
        SELECT TOP 200 CAST(event_data AS XML) AS xd
        FROM sys.fn_xe_file_target_read_file(@p, NULL, NULL, NULL)
      `);
      const apps = new Map<string, number>();
      const hosts = new Set<string>();
      const dbs = new Set<string>();
      for (const row of r3.recordset) {
        const xml = row.xd as string;
        const host = (/<action name="client_hostname"><type[^/]*\/><value>([^<]*)<\/value>/.exec(xml) || [])[1];
        const app = (/<action name="client_app_name"><type[^/]*\/><value>([^<]*)<\/value>/.exec(xml) || [])[1];
        const db = (/<action name="database_name"><type[^/]*\/><value>([^<]*)<\/value>/.exec(xml) || [])[1];
        if (host) hosts.add(host);
        if (app) apps.set(app, (apps.get(app) || 0) + 1);
        if (db) dbs.add(db);
      }
      console.log("  hosts in sample: " + [...hosts].join(", "));
      console.log("  databases in sample: " + [...dbs].join(", "));
      console.log("  apps in sample (top):");
      for (const [a, c] of [...apps.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5)) {
        console.log("    " + (a || "(none)").slice(0, 50).padEnd(52) + " " + c);
      }
    } catch (e: any) { console.log("  detail err: " + (e.message || "").slice(0, 100)); }
  }
  await pool.close();
})();
