/**
 * Sync the most recent Procurement Item Description + Contract Packaging
 * Requirements per NSN from LL's kah_tab (attached to k81 awarded-contract
 * lines) into Supabase ll_item_pids.
 *
 * Why this is useful: when Abe is bidding on a new solicitation for an
 * NSN ERG has previously been awarded, the last PID we received from DLA
 * contains the full spec + packaging rules for that item. Abe currently
 * opens LL and digs through k81 detail to read it. This surfaces it
 * directly in DIBS.
 *
 *   npx tsx scripts/sync-ll-item-pids.ts [--years 3]
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

const config = {
  connectionString:
    "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
};

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const yearsArg = process.argv.indexOf("--years");
  const years = yearsArg >= 0 ? parseInt(process.argv[yearsArg + 1] ?? "3", 10) : 3;

  const pool = await sql.connect(config);

  // Row-number approach: for each (fsc, niin) pick the most recent k81.
  // Then left-join to PID + Packaging + Packaging Notes notes in kah_tab.
  const q = `
    WITH ranked AS (
      SELECT
        RTRIM(k08.fsc_k08) AS fsc,
        RTRIM(k08.niin_k08) AS niin,
        k81.idnk81_k81 AS idnk81,
        k81.addtme_k81 AS addtme_k81,
        ROW_NUMBER() OVER (
          PARTITION BY RTRIM(k08.fsc_k08), RTRIM(k08.niin_k08)
          ORDER BY k81.addtme_k81 DESC, k81.idnk81_k81 DESC
        ) AS rn
      FROM k81_tab k81
      JOIN k71_tab k71 ON k71.idnk71_k71 = k81.idnk71_k81
      JOIN k08_tab k08 ON k08.idnk08_k08 = k71.idnk08_k71
      WHERE k81.addtme_k81 >= DATEADD(year, -${years}, GETDATE())
        AND k08.fsc_k08 IS NOT NULL AND k08.niin_k08 IS NOT NULL
    )
    SELECT
      r.fsc, r.niin, r.idnk81, r.addtme_k81,
      CAST(pid.a_note_kah AS nvarchar(max))  AS pid_text,
      CAST(pack.a_note_kah AS nvarchar(max)) AS packaging_text,
      CAST(pnotes.a_note_kah AS nvarchar(max)) AS packaging_notes
    FROM ranked r
    LEFT JOIN kah_tab pid
      ON pid.anutbl_kah = 'k81' AND pid.idnanu_kah = r.idnk81
         AND pid.anutyp_kah = 'Procurement Item Description'
    LEFT JOIN kah_tab pack
      ON pack.anutbl_kah = 'k81' AND pack.idnanu_kah = r.idnk81
         AND pack.anutyp_kah = 'Contract Packaging Requirements'
    LEFT JOIN kah_tab pnotes
      ON pnotes.anutbl_kah = 'k81' AND pnotes.idnanu_kah = r.idnk81
         AND pnotes.anutyp_kah = 'Packaging Notes'
    WHERE r.rn = 1
      AND (pid.a_note_kah IS NOT NULL OR pack.a_note_kah IS NOT NULL OR pnotes.a_note_kah IS NOT NULL);
  `;

  console.log(`Querying LL k81 + kah (last ${years} years, most-recent per NSN)...`);
  const t0 = Date.now();
  const result = await pool.request().query(q);
  const rows = result.recordset;
  console.log(`Found ${rows.length} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await pool.close();

  if (rows.length === 0) return;

  const mapped = rows
    .filter((r: any) => r.fsc && r.niin)
    .map((r: any) => {
      const pidText: string | null = r.pid_text ? String(r.pid_text) : null;
      return {
        fsc: String(r.fsc).trim(),
        niin: String(r.niin).trim(),
        pid_text: pidText,
        packaging_text: r.packaging_text ? String(r.packaging_text) : null,
        packaging_notes: r.packaging_notes ? String(r.packaging_notes) : null,
        source_idnk81: Number(r.idnk81),
        last_award_date: r.addtme_k81,
        pid_bytes: pidText ? Buffer.byteLength(pidText, "utf-8") : 0,
      };
    });

  let written = 0;
  for (let i = 0; i < mapped.length; i += 500) {
    const batch = mapped.slice(i, i + 500);
    const { error, count } = await sb
      .from("ll_item_pids")
      .upsert(batch, { onConflict: "fsc,niin", count: "exact" });
    if (error) {
      console.error(`batch ${i}: ${error.message}`);
      break;
    }
    written += count ?? batch.length;
  }

  console.log(`Upserted ${written} rows to ll_item_pids`);
  const withPid = mapped.filter((m) => m.pid_text).length;
  const withPack = mapped.filter((m) => m.packaging_text).length;
  console.log(`  ${withPid} NSNs have PID text, ${withPack} have packaging reqs`);

  await sb.from("sync_log").insert({
    action: "ll_item_pids_sync",
    details: { rows_written: written, with_pid: withPid, with_packaging: withPack, years },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
