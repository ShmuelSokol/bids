import "./env";
import sql from "mssql/msnodesqlv8";

// Look for specific patterns we care about:
//  - k33/k34/k35 ops (bid posts)
//  - k07_tab UPDATE (the cursor-fix hypothesis)
//  - kah_tab reads (Sally credential lookup)
//  - kdy_tab UPDATE (sequence allocation)
//  - Any login/auth setup queries

(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;",
    requestTimeout: 90_000,
  });
  const sessions = [
    { name: "dibs_ll_trace", file: String.raw`D:\MSSQL11.MSSQLSERVER\MSSQL\LOG\dibs_ll_trace_0_134217305662970000.xel` },
    { name: "dibs_ll_trace_server", file: String.raw`D:\MSSQL11.MSSQLSERVER\MSSQL\LOG\dibs_ll_trace_server_0_134217491824270000.xel` },
  ];

  for (const s of sessions) {
    console.log("\n===== " + s.name + " =====");
    try {
      // Get last 1000 events (file_offset DESC = newest first)
      const r = await pool.request().query(
        "SELECT TOP 1000 CAST(event_data AS XML) AS xd, file_offset FROM sys.fn_xe_file_target_read_file('" +
        s.file + "', NULL, NULL, NULL) ORDER BY file_offset DESC"
      );
      console.log("  pulled last " + r.recordset.length + " events");

      const counts: Record<string, number> = {};
      const samples: Record<string, string[]> = {};
      let earliest = "9999"; let latest = "0";

      const patterns = [
        { key: "k07_UPDATE", re: /UPDATE\s+k07_tab/i },
        { key: "kah_SELECT", re: /\bkah_tab\b/i },
        { key: "kdy_UPDATE", re: /UPDATE\s+kdy_tab/i },
        { key: "k33_INSERT", re: /INSERT\s+(?:INTO\s+)?(?:dbo\.)?k33_tab/i },
        { key: "k33_UPDATE", re: /UPDATE\s+(?:dbo\.)?k33_tab/i },
        { key: "k34_INSERT", re: /INSERT\s+(?:INTO\s+)?(?:dbo\.)?k34_tab/i },
        { key: "k35_INSERT", re: /INSERT\s+(?:INTO\s+)?(?:dbo\.)?k35_tab/i },
        { key: "k81_INSERT", re: /INSERT\s+(?:INTO\s+)?(?:dbo\.)?k81_tab/i },
        { key: "kc4_INSERT", re: /INSERT\s+(?:INTO\s+)?(?:dbo\.)?kc4_tab/i },
        { key: "implicit_tx", re: /set\s+implicit_transactions/i },
        { key: "sally_login", re: /Sally Credentials|api_key|api_secret/i },
      ];

      for (const row of r.recordset) {
        const xml = row.xd as string;
        const ts = (/<event[^>]*timestamp="([^"]*)"/.exec(xml) || [])[1] || "";
        if (ts) {
          if (ts < earliest) earliest = ts;
          if (ts > latest) latest = ts;
        }
        const stmt =
          (/<data name="(?:statement|batch_text)"><value>([^<]*)<\/value>/s.exec(xml) || [])[1] || "";
        const decoded = stmt.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
        for (const p of patterns) {
          if (p.re.test(decoded)) {
            counts[p.key] = (counts[p.key] || 0) + 1;
            (samples[p.key] = samples[p.key] || []).push(decoded.replace(/\s+/g, " ").slice(0, 280));
          }
        }
      }

      console.log("  time range in last 1000: " + earliest + " -> " + latest);
      console.log("  pattern hits in last 1000 events:");
      for (const p of patterns) {
        const c = counts[p.key] || 0;
        console.log("    " + p.key.padEnd(20) + " " + c);
      }
      console.log("\n  samples (first hit per pattern):");
      for (const p of patterns) {
        const s2 = samples[p.key];
        if (s2 && s2.length > 0) {
          console.log("\n    [" + p.key + "]: " + s2[0]);
        }
      }
    } catch (e: any) {
      console.log("  err: " + (e.message || "").slice(0, 200));
    }
  }
  await pool.close();
})();
