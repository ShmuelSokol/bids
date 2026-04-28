// Mine the live trace for things we DIDN'T already know.
// - Tables seen in the trace beyond our known set
// - Stored procedure calls (sp_*)
// - Any error events
// - Full sequence of one identified bid Post (consecutive ops on a single spid)
import "./env";
import sql from "mssql/msnodesqlv8";

const KNOWN_TABLES = new Set([
  "k07","k08","k09","k10","k11","k12","k14","k21","k22","k32","k33","k34","k35",
  "k37","k39","k40","k42","k43","k45","k55","k56","k57","k58","k71","k81",
  "k89","kaj","kah","kau","kbr","kc4","kdy","ll_edi_transmissions",
]);

(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;",
    requestTimeout: 120_000,
  });
  const sessions = [
    { name: "dibs_ll_trace", file: String.raw`D:\MSSQL11.MSSQLSERVER\MSSQL\LOG\dibs_ll_trace_0_134217305662970000.xel` },
    { name: "dibs_ll_trace_server", file: String.raw`D:\MSSQL11.MSSQLSERVER\MSSQL\LOG\dibs_ll_trace_server_0_134217491824270000.xel` },
  ];

  for (const s of sessions) {
    console.log("\n===== " + s.name + " =====");
    try {
      const r = await pool.request().query(
        "SELECT TOP 3000 CAST(event_data AS XML) AS xd, file_offset FROM sys.fn_xe_file_target_read_file('" +
        s.file + "', NULL, NULL, NULL) ORDER BY file_offset DESC"
      );
      console.log("  pulled " + r.recordset.length + " events");

      // Track all table names + sp calls we see
      const tableHits = new Map<string, number>();
      const spCalls = new Map<string, number>();
      const eventNames = new Map<string, number>();
      const byUserHourClock = new Map<string, number>();
      const k07Sequences: { ts: string; ssVal: string }[] = [];

      for (const row of r.recordset) {
        const xml = row.xd as string;
        const evName = (/<event[^>]*name="([^"]*)"/.exec(xml) || [])[1] || "?";
        eventNames.set(evName, (eventNames.get(evName) || 0) + 1);

        const ts = (/<event[^>]*timestamp="([^"]*)"/.exec(xml) || [])[1];
        if (ts) {
          const minBucket = ts.slice(0, 16);
          byUserHourClock.set(minBucket, (byUserHourClock.get(minBucket) || 0) + 1);
        }

        const stmt = (/<data name="(?:statement|batch_text)"><value>([^<]*)<\/value>/s.exec(xml) || [])[1] || "";
        const decoded = stmt.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

        // Find table refs
        const tabRe = /\b(k[0-9a-z]{2}|kah|kau|kbr|kaj|ll_[a-z_]+|sys[a-z_]+)_tab\b/gi;
        let m;
        while ((m = tabRe.exec(decoded)) !== null) {
          const t = m[1].toLowerCase();
          if (!KNOWN_TABLES.has(t)) {
            tableHits.set(t, (tableHits.get(t) || 0) + 1);
          }
        }

        // Find sp_ calls
        const spRe = /\b(sp_[a-z_0-9]+)\b/gi;
        let m2;
        while ((m2 = spRe.exec(decoded)) !== null) {
          spCalls.set(m2[1], (spCalls.get(m2[1]) || 0) + 1);
        }

        // Capture k07 ss_val_k07 values to see what's stored there
        const k07m = /UPDATE\s+k07_tab[^']+'(\d{4}-\d{2}-\d{2}[^']+)','([^']*)','([^']*)'/i.exec(decoded);
        if (k07m && ts) {
          k07Sequences.push({ ts, ssVal: (k07m[3] || "").slice(0, 100) });
        }
      }

      console.log("\n  event types:");
      for (const [k, v] of [...eventNames.entries()].sort((a, b) => b[1] - a[1])) {
        console.log("    " + k.padEnd(30) + " " + v);
      }

      console.log("\n  NOVEL tables (not in our known set):");
      const novel = [...tableHits.entries()].sort((a, b) => b[1] - a[1]);
      if (novel.length === 0) console.log("    (none — every table reference is in the known set)");
      for (const [t, c] of novel.slice(0, 30)) console.log("    " + t.padEnd(20) + " " + c);

      console.log("\n  stored procs called:");
      const sps = [...spCalls.entries()].sort((a, b) => b[1] - a[1]);
      for (const [p, c] of sps.slice(0, 15)) console.log("    " + p.padEnd(30) + " " + c);

      console.log("\n  k07 ss_val_k07 sample values (last 5):");
      for (const k of k07Sequences.slice(0, 5)) console.log("    " + k.ts + "  '" + k.ssVal + "'");

      // Time distribution (how spread are events?)
      const times = [...byUserHourClock.entries()].sort();
      if (times.length > 0) {
        console.log("\n  busy minutes (top 10 by event count):");
        for (const [minute, count] of [...times].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
          console.log("    " + minute + "  " + count);
        }
      }
    } catch (e: any) {
      console.log("  err: " + (e.message || "").slice(0, 200));
    }
  }
  await pool.close();
})();
