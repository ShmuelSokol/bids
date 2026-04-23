/**
 * Check whether ERG has LamLinks API ("Sally") credentials stored in llk_db1.
 *
 * Discovered via reverse-engineering (see docs/lamlinks-reverse-engineering.md).
 * LL stores Sally API credentials per-user in kah_tab joined to k14_tab:
 *
 *   SELECT ... FROM kah_tab
 *    JOIN k14_tab ON k14_tab.idnk14_k14 = kah_tab.idnanu_kah
 *    WHERE kah_tab.anutbl_kah = 'k14'
 *      AND kah_tab.anutyp_kah = 'Sally Credentials'
 *
 * XML payload in kah_tab memo field contains:
 *   <private_key>...</private_key>   (api_key, 27 chars, prefix indicates type)
 *   <public_key>...</public_key>     (api_secret)
 *
 * This script reports counts + per-user status WITHOUT printing the actual
 * secrets. If rows exist, we have an integration path via api.lamlinks.com.
 *
 *   npx tsx scripts/ll-find-sally-credentials.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const pool = await sql.connect(config);

  console.log(`\n=== kah_tab column probe ===`);
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'kah_tab'
    ORDER BY ORDINAL_POSITION
  `);
  for (const c of cols.recordset) {
    console.log(`  ${c.COLUMN_NAME.padEnd(22)} ${c.DATA_TYPE.padEnd(10)} ${c.CHARACTER_MAXIMUM_LENGTH ?? ""}`);
  }

  console.log(`\n=== All anutyp_kah values and their counts ===`);
  const kinds = await pool.request().query(`
    SELECT anutyp_kah, COUNT(*) AS n
    FROM kah_tab
    GROUP BY anutyp_kah
    ORDER BY n DESC
  `);
  for (const r of kinds.recordset) console.log(`  ${String(r.anutyp_kah).padEnd(40)} ${r.n}`);

  console.log(`\n=== Sally Credentials rows (per-user, secrets redacted) ===`);
  // Try both likely memo column names (anunte_kah is the conventional "any note" field)
  const memoColCandidates = ["a_note_kah", "anunte_kah", "genxml_kah", "note_kah", "xml_kah"];
  const available = new Set(cols.recordset.map((c: any) => c.COLUMN_NAME.toLowerCase()));
  const memoCol = memoColCandidates.find((c) => available.has(c));
  if (!memoCol) {
    console.log(`  (couldn't identify memo column — expected one of: ${memoColCandidates.join(", ")})`);
    console.log(`  available columns: ${[...available].join(", ")}`);
  } else {
    console.log(`  (using memo column: ${memoCol})`);
    const creds = await pool
      .request()
      .input("memoCol", sql.VarChar, memoCol)
      .query(`
        SELECT
          k14.u_name_k14 AS sally_login,
          k14.idnk14_k14,
          kah.uptime_kah,
          CAST(DATALENGTH(kah.${memoCol}) AS int) AS memo_bytes,
          CASE WHEN CAST(kah.${memoCol} AS nvarchar(max)) LIKE '%<private_key>%' THEN 'Y' ELSE 'N' END AS has_private_key,
          CASE WHEN CAST(kah.${memoCol} AS nvarchar(max)) LIKE '%<public_key>%'  THEN 'Y' ELSE 'N' END AS has_public_key,
          -- Don't leak the secret — show only the 3-char prefix if present
          LEFT(
            SUBSTRING(
              CAST(kah.${memoCol} AS nvarchar(max)),
              CHARINDEX('<private_key>', CAST(kah.${memoCol} AS nvarchar(max))) + 13,
              3
            ), 3
          ) AS api_key_prefix
        FROM kah_tab kah
        JOIN k14_tab k14 ON k14.idnk14_k14 = kah.idnanu_kah
        WHERE kah.anutbl_kah = 'k14'
          AND kah.anutyp_kah = 'Sally Credentials'
        ORDER BY kah.uptime_kah DESC
      `);
    if (creds.recordset.length === 0) {
      console.log(`  (no rows — ERG does NOT have Sally API credentials set up)`);
      console.log(`  Next step: ask Yosef to contact LL vendor (the son) for API access.`);
    } else {
      console.log(`  Found ${creds.recordset.length} Sally Credential row(s).`);
      console.log(`  login                idnk14  uptime                       memo  priv  pub  prefix`);
      for (const r of creds.recordset) {
        console.log(
          `  ${String(r.sally_login).padEnd(20)} ${String(r.idnk14_k14).padEnd(6)} ` +
            `${r.uptime_kah?.toISOString?.() ?? r.uptime_kah}  ` +
            `${String(r.memo_bytes).padStart(4)}   ${r.has_private_key}     ${r.has_public_key}    "${r.api_key_prefix}"`
        );
      }

      console.log(`\n=== Tag structure probe (values redacted) ===`);
      const probe = await pool
        .request()
        .input("user", sql.VarChar, "ajoseph")
        .query(`
          SELECT
            k14.u_name_k14 AS login,
            CAST(SUBSTRING(CAST(kah.${memoCol} AS nvarchar(max)), 1, 200) AS varchar(200)) AS first_200_bytes,
            DATALENGTH(kah.${memoCol}) AS total_bytes,
            LEN(LTRIM(RTRIM(CAST(kah.${memoCol} AS nvarchar(max))))) AS trimmed_len
          FROM kah_tab kah
          JOIN k14_tab k14 ON k14.idnk14_k14 = kah.idnanu_kah
          WHERE kah.anutbl_kah = 'k14'
            AND kah.anutyp_kah = 'Sally Credentials'
            AND k14.u_name_k14 = @user
        `);
      for (const r of probe.recordset) {
        // Redact anything that looks like an API-key-ish (27-char alphanumeric) or long base64-ish string
        const redacted = String(r.first_200_bytes ?? "")
          .replace(/[A-Za-z0-9+/=_-]{20,}/g, "<REDACTED_KEY>")
          .replace(/>[^<]{8,}</g, ">…<"); // shrink long tag contents
        console.log(`  ${r.login}: ${r.total_bytes} bytes total, ${r.trimmed_len} after trim`);
        console.log(`    structure: ${redacted || "(empty)"}`);
        // Also show unique XML tag names present
        const tags = [...String(r.first_200_bytes ?? "").matchAll(/<(\/?)([A-Za-z_][A-Za-z0-9_]*)\b/g)]
          .map((m) => m[2])
          .filter((v, i, a) => a.indexOf(v) === i);
        console.log(`    tags found: ${tags.length === 0 ? "(none — not XML)" : tags.join(", ")}`);
      }
      console.log(`\n  Prefix legend (from llprun.exe #DEFINE sally_api_key_prefix_*):`);
      console.log(`    K9p = LamLinks Corp    t0H = Theo    Tg4 = temp/bootstrap    7Lx = LamLinks Client`);
      console.log(`\n  SECURITY: api_secret is stored in plaintext XML in the memo field above.`);
      console.log(`  Anyone with SELECT access to kah_tab can read every user's key pair. Flag to Yosef.`);
    }
  }

  console.log(`\n=== k14 users with any credential type (broader view) ===`);
  const users = await pool.request().query(`
    SELECT u_name_k14, idnk14_k14
    FROM k14_tab
    ORDER BY u_name_k14
  `);
  console.log(`  Total LL user accounts: ${users.recordset.length}`);
  for (const r of users.recordset.slice(0, 20)) {
    console.log(`    ${r.u_name_k14.trim()}  (idnk14=${r.idnk14_k14})`);
  }
  if (users.recordset.length > 20) console.log(`    ... and ${users.recordset.length - 20} more`);

  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
