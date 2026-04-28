import "./env";
import sql from "mssql/msnodesqlv8";
(async () => {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;", requestTimeout: 60_000 });
  const sessions = [
    { name: "dibs_ll_trace", file: String.raw`D:\MSSQL11.MSSQLSERVER\MSSQL\LOG\dibs_ll_trace_0_134217305662970000.xel` },
    { name: "dibs_ll_trace_server", file: String.raw`D:\MSSQL11.MSSQLSERVER\MSSQL\LOG\dibs_ll_trace_server_0_134217491824270000.xel` },
  ];
  for (const s of sessions) {
    console.log("\n===== " + s.name + " =====");
    try {
      const r = await pool.request().query("SELECT COUNT(*) AS c FROM sys.fn_xe_file_target_read_file('" + s.file + "', NULL, NULL, NULL)");
      console.log("  events in current file: " + r.recordset[0].c);
      const r2 = await pool.request().query("SELECT TOP 100 CAST(event_data AS XML) AS xd FROM sys.fn_xe_file_target_read_file('" + s.file + "', NULL, NULL, NULL)");
      const tsList: string[] = [];
      const apps = new Map<string, number>();
      const stmts: string[] = [];
      for (const row of r2.recordset) {
        const xml = row.xd as string;
        const ts = (/<event[^>]*timestamp="([^"]*)"/.exec(xml) || [])[1];
        if (ts) tsList.push(ts);
        const app = (/<action name="client_app_name"><type[^/]*\/><value>([^<]*)<\/value>/.exec(xml) || [])[1];
        if (app) apps.set(app, (apps.get(app) || 0) + 1);
        const stmt = (/<data name="(?:statement|batch_text)"><value>([^<]*)<\/value>/s.exec(xml) || [])[1];
        if (stmt) stmts.push(stmt.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").slice(0, 200));
      }
      tsList.sort();
      console.log("  range: " + (tsList[0] || "?") + " -> " + (tsList[tsList.length - 1] || "?"));
      console.log("  apps (top):");
      for (const [a, c] of [...apps.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5)) {
        console.log("    " + (a || "(blank)").slice(0, 50).padEnd(52) + " " + c);
      }
      console.log("  sample SQL (first 5):");
      for (const st of stmts.slice(0, 5)) console.log("    > " + st.replace(/\s+/g, " ").slice(0, 180));
    } catch (e: any) {
      console.log("  err: " + (e.message || "").slice(0, 200));
    }
  }
  await pool.close();
})();
