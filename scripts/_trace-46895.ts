import "./env";
import sql from "mssql/msnodesqlv8";

(async () => {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;" });

  for (const prefix of ["dibs_ll_trace", "dibs_ll_trace_server"]) {
    console.log("\n===== " + prefix + " =====");
    const path = "D:\\MSSQL11.MSSQLSERVER\\MSSQL\\LOG\\" + prefix + "*.xel";
    const req = pool.request();
    req.input("p", sql.VarChar, path);
    const r = await req.query("SELECT CAST(event_data AS XML) AS xd, file_offset FROM sys.fn_xe_file_target_read_file(@p, NULL, NULL, NULL)")
      .catch((e: any) => { console.log("  err: " + (e.message || "").slice(0, 150)); return null as any; });
    if (!r) continue;
    console.log("  total events: " + r.recordset.length);
    if (r.recordset.length === 0) continue;

    const start = "2026-04-24T15:24:00";
    const end   = "2026-04-24T15:25:00";
    const inRange: any[] = [];
    for (const row of r.recordset) {
      const xml0 = row.xd as string;
      const ts = (/<event[^>]*timestamp="([^"]*)"/.exec(xml0) || [])[1] || "";
      if (ts < start || ts > end) continue;
      const xml = row.xd as string;
      const stmt = (/<data name="(?:statement|batch_text)"><value>([^<]*)<\/value>/s.exec(xml) || [])[1] || "";
      const host = (/<action name="client_hostname"><type[^/]*\/><value>([^<]*)<\/value>/.exec(xml) || [])[1] || "";
      const user = (/<action name="username"><type[^/]*\/><value>([^<]*)<\/value>/.exec(xml) || [])[1] || "";
      const db   = (/<action name="database_name"><type[^/]*\/><value>([^<]*)<\/value>/.exec(xml) || [])[1] || "";
      const decoded = stmt.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
      inRange.push({ ts, host, user, db, decoded });
    }
    console.log("  events in 15:24:00-15:25:00 UTC: " + inRange.length);
    for (const e of inRange.slice(0, 40)) {
      console.log("  " + e.ts + "  " + (e.host || "?").padEnd(18) + "  " + (e.user || "?").padEnd(12) + "  " + e.db.padEnd(10) + "  |  " + e.decoded.slice(0, 200));
    }
  }
  await pool.close();
})();
