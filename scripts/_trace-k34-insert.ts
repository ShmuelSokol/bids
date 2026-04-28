// Extract the full k34_INSERT statement LL's native client uses, to compare
// against what our worker generates. This tells us if we're missing fields
// or producing a malformed insert.
import "./env";
import sql from "mssql/msnodesqlv8";

(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=master;Trusted_Connection=yes;",
    requestTimeout: 120_000,
  });
  const file = String.raw`D:\MSSQL11.MSSQLSERVER\MSSQL\LOG\dibs_ll_trace_0_134217305662970000.xel`;
  const r = await pool.request().query(
    "SELECT TOP 5000 CAST(event_data AS XML) AS xd FROM sys.fn_xe_file_target_read_file('" + file + "', NULL, NULL, NULL) ORDER BY file_offset DESC"
  );

  const k34Inserts: string[] = [];
  const k33Inserts: string[] = [];
  const k35Inserts: string[] = [];

  for (const row of r.recordset) {
    const xml = row.xd as string;
    const stmt = (/<data name="(?:statement|batch_text)"><value>([^<]*)<\/value>/s.exec(xml) || [])[1] || "";
    const decoded = stmt.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    if (/INSERT\s+(?:INTO\s+)?(?:dbo\.)?k34_tab/i.test(decoded)) k34Inserts.push(decoded);
    else if (/INSERT\s+(?:INTO\s+)?(?:dbo\.)?k33_tab/i.test(decoded)) k33Inserts.push(decoded);
    else if (/INSERT\s+(?:INTO\s+)?(?:dbo\.)?k35_tab/i.test(decoded)) k35Inserts.push(decoded);
  }

  console.log("k33 inserts: " + k33Inserts.length);
  if (k33Inserts.length > 0) {
    console.log("\n==== Native LL k33 INSERT ====\n" + k33Inserts[0]);
  }
  console.log("\nk34 inserts: " + k34Inserts.length);
  if (k34Inserts.length > 0) {
    console.log("\n==== Native LL k34 INSERT (longest sample) ====");
    const longest = k34Inserts.sort((a, b) => b.length - a.length)[0];
    console.log(longest);
  }
  console.log("\nk35 inserts: " + k35Inserts.length);
  if (k35Inserts.length > 0) {
    console.log("\n==== Native LL k35 INSERT ====\n" + k35Inserts[0]);
  }

  await pool.close();
})();
