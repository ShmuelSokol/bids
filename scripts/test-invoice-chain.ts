/**
 * Test 5: Invoice/quote posting chain reconnaissance.
 *
 * Yosef owns this test — he wants to verify that quotes and invoices
 * posted from DIBS end up in the right places in LamLinks without
 * corrupting the D365/AX sync.
 *
 * This script just maps the schema so we know what we're dealing with.
 * It does NOT write anything.
 *
 * Chain (per docs/data-sources.md):
 *   ka8_tab → ka9_tab → kaj_tab → kad_tab → kae_tab
 *   = Job → line → shipment → invoice → invoice line
 *
 *   npx tsx scripts/test-invoice-chain.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const CHAIN = ["ka8_tab", "ka9_tab", "kaj_tab", "kad_tab", "kae_tab"];
const LABELS: Record<string, string> = {
  ka8_tab: "Job (order header)",
  ka9_tab: "Job line (order line)",
  kaj_tab: "Shipment",
  kad_tab: "Invoice (header)",
  kae_tab: "Invoice line",
};

async function main() {
  console.log("=== INVOICE CHAIN RECONNAISSANCE ===\n");
  const pool = await sql.connect(config);

  for (const table of CHAIN) {
    console.log(`\n${"=".repeat(70)}\n${table}  —  ${LABELS[table]}\n${"=".repeat(70)}`);

    // Row count
    const countRes = await pool.request().query(`SELECT COUNT(*) AS n FROM ${table}`);
    console.log(`  rows: ${countRes.recordset[0].n}`);

    // Columns + nullability
    const colsRes = await pool.request().query(`
      SELECT c.name, c.is_nullable,
             t.name AS type_name,
             c.max_length
      FROM sys.columns c
      JOIN sys.types t ON t.user_type_id = c.user_type_id
      WHERE c.object_id = OBJECT_ID('${table}')
      ORDER BY c.column_id
    `);
    console.log(`  columns (${colsRes.recordset.length}):`);
    const notNullCols: string[] = [];
    for (const c of colsRes.recordset) {
      const nullTag = c.is_nullable ? "  " : "!!";
      if (!c.is_nullable) notNullCols.push(c.name);
      const lenTag = c.max_length > 0 && c.max_length < 100 ? `(${c.max_length})` : "";
      console.log(`    ${nullTag}  ${c.name.padEnd(18)} ${c.type_name}${lenTag}`);
    }
    console.log(`  NOT NULL columns (${notNullCols.length}): ${notNullCols.join(", ")}`);

    // Stored procs that reference this table
    const procsRes = await pool.request().query(`
      SELECT p.name
      FROM sys.procedures p
      JOIN sys.sql_expression_dependencies d ON d.referencing_id = p.object_id
      WHERE d.referenced_entity_name = '${table}'
    `);
    if (procsRes.recordset.length) {
      console.log(`  stored procs referencing it: ${procsRes.recordset.map((r: any) => r.name).join(", ")}`);
    } else {
      console.log(`  stored procs referencing it: NONE`);
    }

    // Triggers on it
    const trigsRes = await pool.request().query(`
      SELECT name, type_desc, is_disabled
      FROM sys.triggers
      WHERE parent_id = OBJECT_ID('${table}')
    `);
    if (trigsRes.recordset.length) {
      console.log(`  triggers: ${trigsRes.recordset.map((r: any) => `${r.name} (${r.type_desc}${r.is_disabled ? " DISABLED" : ""})`).join(", ")}`);
    } else {
      console.log(`  triggers: NONE`);
    }

    // Show 1 sample row (most recent)
    try {
      const sampleRes = await pool.request().query(`
        SELECT TOP 1 * FROM ${table} ORDER BY 1 DESC
      `);
      if (sampleRes.recordset.length) {
        console.log(`  sample row (most recent):`);
        const row = sampleRes.recordset[0];
        const populated = Object.entries(row).filter(
          ([_, v]) => v !== null && v !== "" && v !== 0 && !(v instanceof Date && isNaN(v.getTime()))
        );
        for (const [k, v] of populated.slice(0, 20)) {
          const shown = v instanceof Date ? v.toISOString().slice(0, 19) : String(v).slice(0, 60);
          console.log(`    ${k.padEnd(18)} = ${shown}`);
        }
      }
    } catch (e: any) {
      console.log(`  sample row: ERROR ${e.message}`);
    }
  }

  // FK chain discovery — which columns link these tables?
  console.log(`\n${"=".repeat(70)}\nFOREIGN KEY CHAIN\n${"=".repeat(70)}`);
  const fkRes = await pool.request().query(`
    SELECT
      OBJECT_NAME(fk.parent_object_id) AS from_table,
      c1.name AS from_col,
      OBJECT_NAME(fk.referenced_object_id) AS to_table,
      c2.name AS to_col
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    JOIN sys.columns c1 ON c1.object_id = fkc.parent_object_id AND c1.column_id = fkc.parent_column_id
    JOIN sys.columns c2 ON c2.object_id = fkc.referenced_object_id AND c2.column_id = fkc.referenced_column_id
    WHERE OBJECT_NAME(fk.parent_object_id) IN ('ka8_tab','ka9_tab','kaj_tab','kad_tab','kae_tab')
       OR OBJECT_NAME(fk.referenced_object_id) IN ('ka8_tab','ka9_tab','kaj_tab','kad_tab','kae_tab')
  `);
  if (fkRes.recordset.length === 0) {
    console.log("  NO declared FKs. Relations are by naming convention (idnkaN_kaM).");
  } else {
    for (const fk of fkRes.recordset) {
      console.log(`  ${fk.from_table}.${fk.from_col} → ${fk.to_table}.${fk.to_col}`);
    }
  }

  await pool.close();

  console.log("\n=== READY FOR YOSEF ===");
  console.log("Send him this output and ask which of the following he wants DIBS to drive:");
  console.log("  a) Posting a QUOTE (write to... kad_tab? ka8_tab pending state?)");
  console.log("  b) Posting an INVOICE (kad_tab + kae_tab lines)");
  console.log("  c) Both");
  console.log("\nQuestions for Yosef:");
  console.log("  1. What's the 'state field' on ka8/kad that marks something as a draft vs posted?");
  console.log("  2. Does AX sync read from kad/kae directly, or is there a separate integration layer?");
  console.log("  3. What breaks if we INSERT kad + kae with no ka8/ka9 parent (for a loose-quote test)?");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
