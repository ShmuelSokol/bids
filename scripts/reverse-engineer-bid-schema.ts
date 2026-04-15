/**
 * Reverse-engineer the LamLinks bid write schema by analyzing 50 of
 * Abe's recent successful bid submissions.
 *
 * Output shows, per column:
 *   - How often it's populated vs null
 *   - How many distinct values
 *   - The most common value (or sample of distinct values)
 *   - Whether it looks auto-populated (e.g. timestamps, sequence IDs)
 *     vs user-entered (price, qty, lead)
 *
 * That output becomes the template for constructing a safe INSERT:
 *   - Always-constant columns → hardcode
 *   - Always-present-but-varies columns → require as input
 *   - Sometimes-null columns → leave null unless the sample shows
 *     a pattern we need to preserve
 *   - Auto-populated columns → DON'T set on insert, let defaults/
 *     triggers/sequences do their thing
 *
 * Run locally (Windows Auth to NYEVRVSQL001):
 *   npx tsx scripts/reverse-engineer-bid-schema.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

// How many recent records to analyze per table
const SAMPLE_SIZE = 50;

function classify(values: any[], colname: string): string {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
  const nullRate = 1 - nonNull.length / values.length;
  const distinct = new Set(nonNull.map((v) => JSON.stringify(v)));
  const firstVal = nonNull[0];
  const typeHint = typeof firstVal;

  // A column is the table's OWN PK if its name is `idn<table>_<table>`
  // like idnk34_k34. Other idnXX_<thistable> columns are FKs to
  // another table — those are required INPUT on insert, not auto.
  const pkMatch = colname.match(/^idn([a-z0-9]+)_([a-z0-9]+)$/i);
  const looksLikeOwnPk = pkMatch && pkMatch[1].toLowerCase() === pkMatch[2].toLowerCase();
  const looksLikeFk = pkMatch && pkMatch[1].toLowerCase() !== pkMatch[2].toLowerCase();
  const looksLikeTime =
    /time|date|dte$|tme$|dt_$|^add|^upd|^rec/.test(colname.toLowerCase()) ||
    firstVal instanceof Date;
  const looksLikeUser = /upname|addnme|user_|creatd|updby|addby/.test(colname.toLowerCase());

  if (nullRate === 1) return "🚫 always null — skip on INSERT";
  if (looksLikeOwnPk && distinct.size === values.length) return `🔑 auto PK (unique, ${distinct.size} distinct) — SKIP on insert`;
  if (looksLikeFk) {
    if (distinct.size === values.length) return `🧷 FK (unique per row, ${distinct.size} distinct) — REQUIRED input`;
    if (distinct.size < values.length) return `🧷 FK (${distinct.size} distinct, rows share parent) — REQUIRED input`;
  }
  if (looksLikeTime) return `⏰ auto timestamp (let DB default)`;
  if (looksLikeUser) return `👤 auto user (${distinct.size} distinct: ${[...distinct].slice(0, 3).join(", ")})`;
  if (distinct.size === 1) return `📌 constant: ${[...distinct][0]}`;
  if (distinct.size <= 5) return `🔢 small set (${distinct.size}): ${[...distinct].slice(0, 5).join(" | ")}`;
  if (nullRate > 0.8) return `⚪ usually null (${Math.round(nullRate * 100)}% null, ${distinct.size} distinct when set)`;
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
  console.log(`Retrieved ${rows.length} rows for analysis.`);
  if (rows.length === 0) {
    console.log("No rows to analyze.");
    return;
  }
  const cols = Object.keys(rows[0]);
  console.log(`${cols.length} columns. Column-by-column analysis:\n`);

  const padCol = Math.max(...cols.map((c) => c.length)) + 2;
  for (const c of cols) {
    const values = rows.map((r) => r[c]);
    const cls = classify(values, c);
    const sample = sampleValues(values, 3);
    console.log(`  ${c.padEnd(padCol)} ${cls}`);
    if (!cls.includes("constant:") && !cls.includes("small set") && sample) {
      const shortSample = sample.length > 90 ? sample.slice(0, 90) + "..." : sample;
      console.log(`  ${"".padEnd(padCol)}   e.g. ${shortSample}`);
    }
  }
}

async function main() {
  const pool = await sql.connect(config);

  // Look at the most recent 50 k34 records where Abe (ajoseph) bid as CAGE 0AG09
  // and status == 'S' (submitted). These are the canonical successful inserts.
  await analyzeTable(
    pool,
    `
      SELECT TOP ${SAMPLE_SIZE} *
      FROM k34_tab
      WHERE scage_k34 = '0AG09'
        AND upname_k34 LIKE '%ajoseph%'
      ORDER BY idnk34_k34 DESC
    `,
    "k34_tab — Abe's recent bid lines (76 columns)"
  );

  // The batch headers k34 belongs to — one per submission batch
  await analyzeTable(
    pool,
    `
      SELECT TOP ${SAMPLE_SIZE} k33.*
      FROM k33_tab k33
      WHERE k33.idnk33_k33 IN (
        SELECT TOP ${SAMPLE_SIZE} idnk33_k34
        FROM k34_tab
        WHERE scage_k34 = '0AG09' AND upname_k34 LIKE '%ajoseph%'
        GROUP BY idnk33_k34
        ORDER BY MAX(idnk34_k34) DESC
      )
    `,
    "k33_tab — the batch headers those bids were attached to"
  );

  // The pricing rows associated with recent submitted bids
  await analyzeTable(
    pool,
    `
      SELECT TOP ${SAMPLE_SIZE} k35.*
      FROM k35_tab k35
      JOIN k34_tab k34 ON k34.idnk34_k34 = k35.idnk34_k35
      WHERE k34.scage_k34 = '0AG09' AND k34.upname_k34 LIKE '%ajoseph%'
      ORDER BY k34.idnk34_k34 DESC
    `,
    "k35_tab — the pricing rows on those k34 bids"
  );

  // Bonus: look at one complete chain — pick Abe's most recent bid and
  // fetch the full row from k33+k34+k35 side by side so we can see the
  // complete shape of ONE successful submission.
  const chain = await pool.request().query(`
    SELECT TOP 1
      k33.idnk33_k33 AS batch_id,
      k34.idnk34_k34 AS line_id,
      k35.idnk35_k35 AS pricing_id,
      k33.*,
      k34.*,
      k35.*
    FROM k34_tab k34
    LEFT JOIN k33_tab k33 ON k33.idnk33_k33 = k34.idnk33_k34
    LEFT JOIN k35_tab k35 ON k35.idnk34_k35 = k34.idnk34_k34
    WHERE k34.scage_k34 = '0AG09'
      AND k34.upname_k34 LIKE '%ajoseph%'
    ORDER BY k34.idnk34_k34 DESC
  `);
  console.log(`\n${"=".repeat(80)}\nONE COMPLETE CHAIN — most recent Abe bid (k33 ← k34 → k35)\n${"=".repeat(80)}`);
  if (chain.recordset.length > 0) {
    const row = chain.recordset[0];
    for (const [k, v] of Object.entries(row)) {
      if (v !== null && v !== undefined && v !== "" && v !== 0) {
        console.log(`  ${k.padEnd(24)} = ${JSON.stringify(v)}`);
      }
    }
  }

  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
