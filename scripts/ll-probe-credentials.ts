/**
 * Follow-up probe: compare k14_tab.u_pass_k14 (the LL desktop login password)
 * to the sally_password stored in kah_tab. If they match, the Sally
 * credentials are just the user's LL login — low-security but functional.
 *
 * Also dig for ERG's corp e_code (needed for the REST API envelope).
 *
 *   npx tsx scripts/ll-probe-credentials.ts
 */
import "./env";
import sql from "mssql/msnodesqlv8";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

async function main() {
  const pool = await sql.connect(config);

  console.log(`\n=== Does k14.u_pass_k14 == kah sally_password for each user? ===`);
  const cmp = await pool.request().query(`
    SELECT
      k14.u_name_k14 AS login,
      CAST(LEN(RTRIM(k14.u_pass_k14)) AS int) AS u_pass_len,
      DATALENGTH(kah.a_note_kah) AS kah_bytes,
      -- extract value between <sally_password> tags
      SUBSTRING(
        CAST(kah.a_note_kah AS nvarchar(max)),
        CHARINDEX('<sally_password>', CAST(kah.a_note_kah AS nvarchar(max))) + 16,
        10
      ) AS sally_pw_raw,
      -- same but for login
      SUBSTRING(
        CAST(kah.a_note_kah AS nvarchar(max)),
        CHARINDEX('<sally_login>', CAST(kah.a_note_kah AS nvarchar(max))) + 13,
        40
      ) AS sally_login_raw
    FROM k14_tab k14
    LEFT JOIN kah_tab kah ON kah.idnanu_kah = k14.idnk14_k14
                          AND kah.anutbl_kah = 'k14'
                          AND kah.anutyp_kah = 'Sally Credentials'
    ORDER BY k14.u_name_k14
  `);
  console.log(`  login            u_pass_len  sally_pw (closed tag stripped)  sally_login (tag stripped)`);
  for (const r of cmp.recordset) {
    const sallyPw = String(r.sally_pw_raw ?? "").split("</")[0];
    const sallyLogin = String(r.sally_login_raw ?? "").split("</")[0];
    const pwMatch = sallyPw.length > 0 && String(r.u_pass_len).padStart(2) === String(sallyPw.length).padStart(2) ? "✓len" : "?";
    console.log(`  ${String(r.login).padEnd(16)} ${String(r.u_pass_len).padStart(10)}  ${sallyPw.padEnd(30)} ${sallyLogin} (${pwMatch})`);
  }

  console.log(`\n=== ERG's corp info ===`);
  // PUB_CORP_CAGE is ERG's own CAGE (0AG09). Find ERG entity row.
  const me = await pool.request().query(`
    SELECT TOP 20 idnk12_k12, e_code_k12, e_name_k12, e_emal_k12
    FROM k12_tab
    WHERE e_name_k12 LIKE '%Ever Ready%'
       OR e_name_k12 LIKE '%ERG%'
       OR e_code_k12 LIKE '%0AG09%'
    ORDER BY e_code_k12
  `);
  if (me.recordset.length === 0) console.log(`  (no ERG entity found — trying cage table)`);
  for (const r of me.recordset) {
    console.log(`  e_code="${String(r.e_code_k12).trim()}"  name="${String(r.e_name_k12).trim()}"  idnk12=${r.idnk12_k12}`);
  }

  console.log(`\n=== k13_tab CAGE join for 0AG09 ===`);
  const cage = await pool.request().query(`
    SELECT k13.cage_k13, k13.c_name_k13, k12.e_code_k12, k12.e_name_k12
    FROM k13_tab k13
    JOIN k12_tab k12 ON k12.idnk12_k12 = k13.idnk12_k13
    WHERE k13.cage_k13 = '0AG09'
  `);
  for (const r of cage.recordset) {
    console.log(`  CAGE=${r.cage_k13.trim()}  e_code="${String(r.e_code_k12).trim()}"  name="${String(r.e_name_k12).trim()}"`);
  }

  console.log(`\n=== ajoseph's row (for the test call) ===`);
  const abe = await pool.request().query(`
    SELECT TOP 1
      k14.idnk14_k14,
      k14.u_name_k14,
      LEN(RTRIM(k14.u_pass_k14)) AS u_pass_len,
      k12.e_code_k12,
      k12.e_name_k12,
      k14.u_menu_k14
    FROM k14_tab k14
    LEFT JOIN k12_tab k12 ON k12.idnk12_k12 = k14.idnk12_k14
    WHERE k14.u_name_k14 = 'ajoseph'
  `);
  for (const r of abe.recordset) {
    console.log(`  idnk14=${r.idnk14_k14} login="${String(r.u_name_k14).trim()}" pw_len=${r.u_pass_len} e_code="${String(r.e_code_k12 ?? "").trim()}" entity="${String(r.e_name_k12 ?? "").trim()}" menu="${String(r.u_menu_k14 ?? "").trim()}"`);
  }

  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
