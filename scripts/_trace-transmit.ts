// Look for the SQL pattern that records a transmit. Specifically:
// - UPDATE k33_tab SET t_stat='sent'
// - Anything written when an envelope's transmission completes
// Also surface ALL distinct UPDATE/INSERT statements (deduped by table)
import "./env";
import sql from "mssql/msnodesqlv8";

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
        "SELECT TOP 5000 CAST(event_data AS XML) AS xd, file_offset FROM sys.fn_xe_file_target_read_file('" +
        s.file + "', NULL, NULL, NULL) ORDER BY file_offset DESC"
      );

      // Find anything that transitions t_stat to 'sent'
      const transmitHits: string[] = [];
      // Collect distinct UPDATE/INSERT signatures (table + first 80 chars)
      const writeSignatures = new Map<string, { sample: string; count: number }>();
      // Collect long-running queries (duration_ms > 100)
      const slowQueries: { ts: string; dur_ms: number; sql: string }[] = [];

      for (const row of r.recordset) {
        const xml = row.xd as string;
        const stmt = (/<data name="(?:statement|batch_text)"><value>([^<]*)<\/value>/s.exec(xml) || [])[1] || "";
        const decoded = stmt.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
        const ts = (/<event[^>]*timestamp="([^"]*)"/.exec(xml) || [])[1] || "";
        const dur = Number((/<data name="duration"><(?:value|type[^/]*\/><value)>([0-9]+)<\/value>/.exec(xml) || [])[1] || 0);

        if (/t_stat_k33\s*=\s*'sent'/i.test(decoded) || /t_stat_k33\s*=\s*N?'sent/i.test(decoded)) {
          transmitHits.push(ts + " | " + decoded.replace(/\s+/g, " ").slice(0, 250));
        }

        // Collect UPDATE/INSERT signatures
        const opMatch = /\b(INSERT\s+(?:INTO\s+)?|UPDATE\s+|DELETE\s+FROM\s+)(?:dbo\.)?(\w+)/i.exec(decoded);
        if (opMatch) {
          const sig = opMatch[1].trim().toUpperCase().split(/\s/)[0] + " " + opMatch[2];
          const prev = writeSignatures.get(sig);
          if (prev) prev.count++;
          else writeSignatures.set(sig, { sample: decoded.replace(/\s+/g, " ").slice(0, 200), count: 1 });
        }

        // Slow queries
        if (dur > 100_000) {
          slowQueries.push({ ts, dur_ms: dur / 1000, sql: decoded.replace(/\s+/g, " ").slice(0, 200) });
        }
      }

      console.log("\n  T_STAT='sent' transitions: " + transmitHits.length);
      for (const h of transmitHits.slice(0, 5)) console.log("    " + h);

      console.log("\n  All distinct WRITE operations (table-level, deduped):");
      const sorted = [...writeSignatures.entries()].sort((a, b) => b[1].count - a[1].count);
      for (const [sig, info] of sorted.slice(0, 30)) {
        console.log("    " + sig.padEnd(28) + " count=" + info.count);
      }

      console.log("\n  SLOW queries (>100ms):");
      slowQueries.sort((a, b) => b.dur_ms - a.dur_ms);
      for (const q of slowQueries.slice(0, 5)) {
        console.log("    " + q.ts + "  " + q.dur_ms.toFixed(0) + "ms  " + q.sql.slice(0, 150));
      }
    } catch (e: any) {
      console.log("  err: " + (e.message || "").slice(0, 200));
    }
  }
  await pool.close();
})();
