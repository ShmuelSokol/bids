/**
 * Stop + drop the llk_invoice_trace XE session. Run when done analyzing.
 */
import "./env";
import sql from "mssql/msnodesqlv8";

(async () => {
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });
  try {
    await pool.request().query(`
      IF EXISTS (SELECT 1 FROM sys.server_event_sessions WHERE name = 'llk_invoice_trace')
      BEGIN
        ALTER EVENT SESSION [llk_invoice_trace] ON SERVER STATE = STOP;
        DROP EVENT SESSION [llk_invoice_trace] ON SERVER;
      END
    `);
    console.log("✓ XE session llk_invoice_trace stopped + dropped");
  } catch (e: any) {
    console.error(`Failed: ${e.message}`);
    process.exit(1);
  }
  await pool.close();
})();
