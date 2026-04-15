/**
 * Reverse-engineer the LamLinks invoice posting chain by analyzing the
 * 50 most recent posted invoices. Output per column:
 *
 *   - null rate
 *   - distinct-value count
 *   - auto-populated vs user-entered classification
 *   - constant value / small-set values / samples
 *
 * Same pattern as scripts/reverse-engineer-bid-schema.ts. Chain:
 *
 *   ka8_tab  = Job (order header)           — idnka8_ka8 PK
 *   ka9_tab  = Job line (order line)        — idnka9_ka9 PK, FKs to ka8 + k81 + kaj
 *   kaj_tab  = Shipment                     — idnkaj_kaj PK
 *   kad_tab  = Invoice header               — idnkad_kad PK
 *   kae_tab  = Invoice line                 — idnkae_kae PK, FK to kad
 *
 * Use the output to build a safe INSERT generator, and to ask Yosef
 * targeted questions about the fields we can't explain.
 *
 *   npx tsx scripts/reverse-engineer-invoice-schema.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const SAMPLE_SIZE = 50;

function classify(values: any[], colname: string): string {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  const nullRate = 1 - nonNull.length / values.length;
  const distinct = new Set(nonNull.map((v) => JSON.stringify(v)));
  const firstVal = nonNull[0];

  const pkMatch = colname.match(/^idn([a-z0-9]+)_([a-z0-9]+)$/i);
  const looksLikeOwnPk = pkMatch && pkMatch[1].toLowerCase() === pkMatch[2].toLowerCase();
  const looksLikeFk = pkMatch && pkMatch[1].toLowerCase() !== pkMatch[2].toLowerCase();
  const looksLikeTime =
    /time|date|dte$|tme$|dt_$|^add|^upd|^rec/.test(colname.toLowerCase()) ||
    firstVal instanceof Date;
  const looksLikeUser = /upname|addnme|user_|creatd|updby|addby/.test(colname.toLowerCase());

  if (nullRate === 1) return "🚫 always null — skip on INSERT";
  if (looksLikeOwnPk && distinct.size === values.length)
    return `🔑 auto PK (unique, ${distinct.size} distinct) — SKIP on insert`;
  if (looksLikeFk) {
    if (distinct.size === values.length) return `🧷 FK (unique per row, ${distinct.size} distinct) — REQUIRED input`;
    return `🧷 FK (${distinct.size} distinct, rows share parent) — REQUIRED input`;
  }
  if (looksLikeTime) return `⏰ auto timestamp (let DB default)`;
  if (looksLikeUser) return `👤 auto user (${distinct.size} distinct: ${[...distinct].slice(0, 3).join(", ")})`;
  if (distinct.size === 1) return `📌 constant: ${[...distinct][0]}`;
  if (distinct.size <= 5) return `🔢 small set (${distinct.size}): ${[...distinct].slice(0, 5).join(" | ")}`;
  if (nullRate > 0.8)
    return `⚪ usually null (${Math.round(nullRate * 100)}% null, ${distinct.size} distinct when set)`;
  if (nullRate > 0.3) return `~ sometimes null (${Math.round(nullRate * 100)}% null)`;
  return `✏️ varies (${distinct.size} distinct of ${values.length})`;
}

function sampleValues(values: any[], max = 3): string {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  const distinct = [...new Set(nonNull.map((v) => JSON.stringify(v)))].slice(0, max);
  return distinct.join(" | ");
}

async function analyzeTable(pool: sql.ConnectionPool, query: string, label: string) {
  console.log(`\n${"=".repeat(80)}\n${label}\n${"=".repeat(80)}`);
  const res = await pool.request().query(query);
  const rows = res.recordset;
  console.log(`Retrieved ${rows.length} rows.`);
  if (rows.length === 0) {
    console.log("(no rows)");
    return;
  }
  const cols = Object.keys(rows[0]);
  console.log(`${cols.length} columns:\n`);
  const pad = Math.max(...cols.map((c) => c.length)) + 2;
  for (const c of cols) {
    const values = rows.map((r) => r[c]);
    const cls = classify(values, c);
    const sample = sampleValues(values, 3);
    console.log(`  ${c.padEnd(pad)} ${cls}`);
    if (!cls.includes("constant:") && !cls.includes("small set") && sample) {
      const short = sample.length > 90 ? sample.slice(0, 90) + "..." : sample;
      console.log(`  ${"".padEnd(pad)}   e.g. ${short}`);
    }
  }
}

async function main() {
  const pool = await sql.connect(config);

  // Pick the 50 most recent 'Posted' invoices. These are the canonical
  // successful path — the shape Yosef (or his team) lands at after all
  // the LamLinks app logic runs.
  const recentInvoiceIds = await pool.request().query(`
    SELECT TOP ${SAMPLE_SIZE} idnkad_kad
    FROM kad_tab
    WHERE RTRIM(LTRIM(cinsta_kad)) = 'Posted'
    ORDER BY idnkad_kad DESC
  `);
  const invoiceIds = recentInvoiceIds.recordset.map((r: any) => r.idnkad_kad);
  console.log(`Sampling ${invoiceIds.length} most recent Posted invoices: idnkad_kad ${invoiceIds.slice(0, 3).join(", ")}…\n`);
  if (invoiceIds.length === 0) {
    console.log("No Posted invoices found. Bailing.");
    await pool.close();
    return;
  }
  const idsCsv = invoiceIds.join(",");

  // kad_tab — invoice headers
  await analyzeTable(
    pool,
    `SELECT * FROM kad_tab WHERE idnkad_kad IN (${idsCsv})`,
    "kad_tab — Invoice header"
  );

  // kae_tab — invoice lines attached to those headers
  await analyzeTable(
    pool,
    `SELECT * FROM kae_tab WHERE idnkad_kae IN (${idsCsv})`,
    "kae_tab — Invoice lines"
  );

  // Walk up the chain: kad → ka9 → ka8 via ka9.idnkae_ka9 → kae.idnkad_kae.
  // Actually: ka9.idnkae_ka9 links a line to its invoice line. Let's pull
  // ka9 rows whose invoice line belongs to our sampled invoices.
  await analyzeTable(
    pool,
    `
      SELECT ka9.*
      FROM ka9_tab ka9
      WHERE ka9.idnkae_ka9 IN (
        SELECT idnkae_kae FROM kae_tab WHERE idnkad_kae IN (${idsCsv})
      )
    `,
    "ka9_tab — Order lines that those invoices billed"
  );

  // ka8 headers for those order lines
  await analyzeTable(
    pool,
    `
      SELECT DISTINCT ka8.*
      FROM ka8_tab ka8
      WHERE ka8.idnka8_ka8 IN (
        SELECT DISTINCT ka9.idnka8_ka9
        FROM ka9_tab ka9
        WHERE ka9.idnkae_ka9 IN (
          SELECT idnkae_kae FROM kae_tab WHERE idnkad_kae IN (${idsCsv})
        )
      )
    `,
    "ka8_tab — Order headers (jobs) upstream of those invoices"
  );

  // kaj (shipments) attached to those ka9 lines
  await analyzeTable(
    pool,
    `
      SELECT DISTINCT kaj.*
      FROM kaj_tab kaj
      WHERE kaj.idnkaj_kaj IN (
        SELECT DISTINCT ka9.idnkaj_ka9
        FROM ka9_tab ka9
        WHERE ka9.idnkae_ka9 IN (
          SELECT idnkae_kae FROM kae_tab WHERE idnkad_kae IN (${idsCsv})
        )
      )
    `,
    "kaj_tab — Shipments tied to those order lines"
  );

  // One complete chain, most recent invoice, all non-empty fields
  console.log(`\n${"=".repeat(80)}\nONE COMPLETE CHAIN — most recent Posted invoice\n${"=".repeat(80)}`);
  const chain = await pool.request().query(`
    SELECT TOP 1
      kad.idnkad_kad AS invoice_id,
      kad.*,
      kae.*,
      ka9.*,
      ka8.*
    FROM kad_tab kad
    JOIN kae_tab kae ON kae.idnkad_kae = kad.idnkad_kad
    JOIN ka9_tab ka9 ON ka9.idnkae_ka9 = kae.idnkae_kae
    JOIN ka8_tab ka8 ON ka8.idnka8_ka8 = ka9.idnka8_ka9
    WHERE RTRIM(LTRIM(kad.cinsta_kad)) = 'Posted'
    ORDER BY kad.idnkad_kad DESC
  `);
  if (chain.recordset.length > 0) {
    const row = chain.recordset[0];
    for (const [k, v] of Object.entries(row)) {
      if (v !== null && v !== undefined && v !== "" && v !== 0) {
        const shown = v instanceof Date ? v.toISOString() : JSON.stringify(v);
        console.log(`  ${k.padEnd(24)} = ${String(shown).slice(0, 100)}`);
      }
    }
  }

  // State-field probe. What values of cinsta_kad exist? If there's a
  // pre-posted state, we can insert at that state and let Yosef click
  // 'Post' (mirroring how the bid chain works).
  console.log(`\n${"=".repeat(80)}\nSTATE FIELD PROBE — kad.cinsta_kad values\n${"=".repeat(80)}`);
  const states = await pool.request().query(`
    SELECT RTRIM(LTRIM(cinsta_kad)) AS state, COUNT(*) AS n, MIN(uptime_kad) AS earliest, MAX(uptime_kad) AS latest
    FROM kad_tab
    GROUP BY RTRIM(LTRIM(cinsta_kad))
    ORDER BY n DESC
  `);
  for (const r of states.recordset) {
    console.log(`  '${r.state}' — ${r.n} rows, earliest ${r.earliest?.toISOString?.().slice(0, 10)}, latest ${r.latest?.toISOString?.().slice(0, 10)}`);
  }

  // Same for ka8 job status
  console.log(`\nka8.jobsta_ka8 values:`);
  const jobStates = await pool.request().query(`
    SELECT RTRIM(LTRIM(jobsta_ka8)) AS state, COUNT(*) AS n
    FROM ka8_tab
    GROUP BY RTRIM(LTRIM(jobsta_ka8))
    ORDER BY n DESC
  `);
  for (const r of jobStates.recordset) console.log(`  '${r.state}' — ${r.n}`);

  console.log(`\n${"=".repeat(80)}\nQUESTIONS FOR YOSEF\n${"=".repeat(80)}`);
  console.log("  1. cinsta_kad — what values exist besides 'Posted'? What does the");
  console.log("     pre-post state look like (so DIBS can insert a draft)?");
  console.log("  2. upname_kad — does LamLinks look at this for anything, or is it");
  console.log("     just an audit field? (Bid chain uses 'dibs-auto'.)");
  console.log("  3. idnk31_kad FK → k31_tab — what is k31 (customer? bill-to?)");
  console.log("  4. idnk06_kad FK → k06_tab — what is k06?");
  console.log("  5. pinval_kad / xinval_kad / mslval_kad / ar_val_kad — what's each");
  console.log("     used for? (pre-tax, tax, ?, AR value?)");
  console.log("  6. Does AX sync read directly from kad/kae, or via a separate path?");
  console.log("  7. Is there a stored procedure LamLinks' client calls to 'post' an");
  console.log("     invoice, or is it just an UPDATE cinsta_kad = 'Posted'?");

  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
