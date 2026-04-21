import "./env";
import sql from "mssql/msnodesqlv8";

async function main() {
  const pool = await sql.connect({ connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;" });

  // Inspect all kd*_tab tables for status/pricing columns and row counts
  const kdTables = ["kd0_tab","kd1_tab","kd2_tab","kd3_tab","kd4_tab","kd5_tab","kd6_tab","kd7_tab","kd8_tab","kd9_tab","kda_tab","kdb_tab","kdc_tab","kdd_tab","kde_tab","kdf_tab","kdg_tab","kdh_tab","kdj_tab","kdk_tab","kdm_tab","kdn_tab","kdp_tab","kdw_tab","kdx_tab","kdy_tab","kdz_tab"];

  console.log("kd*_tab tables — rows + columns:\n");
  for (const name of kdTables) {
    try {
      const cnt = await pool.request().query(`SELECT COUNT(*) AS c FROM ${name}`);
      const cols = await pool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${name}' ORDER BY ORDINAL_POSITION
      `);
      const colList = cols.recordset.map((c: any) => c.COLUMN_NAME).join(", ");
      console.log(`${name.padEnd(10)} ${String(cnt.recordset[0].c).padStart(8)} rows — ${colList}`);
    } catch (e: any) {
      console.log(`${name} error: ${e.message.slice(0, 60)}`);
    }
  }

  // Inspect views definitions  that use 'qry' or 'qte' — find their base tables
  console.log("\n\nView aq_quote_transmission_1_view definition:");
  const v1 = await pool.request().query(`
    SELECT TOP 1 VIEW_DEFINITION FROM INFORMATION_SCHEMA.VIEWS
    WHERE TABLE_NAME = 'aq_quote_transmission_1_view'
  `);
  console.log(v1.recordset[0]?.VIEW_DEFINITION?.slice(0, 2000));

  console.log("\n\nView our_quote_line_7_view definition:");
  const v2 = await pool.request().query(`
    SELECT TOP 1 VIEW_DEFINITION FROM INFORMATION_SCHEMA.VIEWS
    WHERE TABLE_NAME = 'our_quote_line_7_view'
  `);
  console.log(v2.recordset[0]?.VIEW_DEFINITION?.slice(0, 2000));

  console.log("\n\nView our_quote_line_6_view definition:");
  const v3 = await pool.request().query(`
    SELECT TOP 1 VIEW_DEFINITION FROM INFORMATION_SCHEMA.VIEWS
    WHERE TABLE_NAME = 'our_quote_line_6_view'
  `);
  console.log(v3.recordset[0]?.VIEW_DEFINITION?.slice(0, 2000));

  await pool.close();
}
main().catch(console.error);
