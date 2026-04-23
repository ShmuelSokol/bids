/**
 * Sync LamLinks kbr_tab (EDI transmissions) → Supabase ll_edi_transmissions.
 *
 * Each row in kbr_tab records one EDI transmission event (WAWF 810 invoice,
 * WAWF 856 ASN, WAWF 857 ship notice, DPMS, SAMMS legacy). Each shipment
 * (kaj_tab row) typically has 1–2 kbr rows — one for the 856 (ASN-first),
 * one for the 810 (invoice-later).
 *
 * Status string alphabet (xtcsta_kbr, from reverse-engineering):
 *   WAWF 810 not sent / WAWF 810 sent / WAWF 810 problem acknowledged / WAWF 810 acknowledged
 *   WAWF 856 not sent / WAWF 856 sent / WAWF 856 problem acknowledged / WAWF 856 acknowledged
 *   WAWF 857 sent
 *   DLA Legacy 810/856 ... (SAMMS)
 *   DPMS not contacted / DPMS closeout pending / DPMS shipdest completed
 *
 *   npx tsx scripts/sync-ll-edi-transmissions.ts [--days 30]
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

function parseStatus(status: string): { edi_type: string; lifecycle: string } {
  const s = status.trim().toLowerCase();
  let edi_type = "OTHER";
  if (s.includes("810")) edi_type = "810";
  else if (s.includes("856")) edi_type = "856";
  else if (s.includes("857")) edi_type = "857";
  else if (s.includes("dpms")) edi_type = "DPMS";
  else if (s.includes("samms")) edi_type = "SAMMS";

  let lifecycle = "other";
  if (s.includes("problem")) lifecycle = "problem";
  else if (s.includes("acknowledged") || s.includes("ack_ok")) lifecycle = "acknowledged";
  else if (s.includes(" sent") || s.endsWith("sent")) lifecycle = "sent";
  else if (s.includes("not sent") || s.includes("pending") || s.includes("not contacted")) lifecycle = "not_sent";

  return { edi_type, lifecycle };
}

async function main() {
  const daysArg = process.argv.indexOf("--days");
  const days = daysArg >= 0 ? parseInt(process.argv[daysArg + 1] ?? "30", 10) : 30;

  const pool = await sql.connect(config);

  const result = await pool.request().query(`
    SELECT
      idnkbr_kbr, addtme_kbr, addnme_kbr,
      itttbl_kbr, idnitt_kbr, idnkap_kbr,
      xtcscn_kbr, xtcsta_kbr, xtctme_kbr
    FROM kbr_tab
    WHERE addtme_kbr >= DATEADD(day, -${days}, GETDATE())
    ORDER BY idnkbr_kbr DESC
  `);
  const rows = result.recordset;
  await pool.close();

  console.log(`Pulled ${rows.length} kbr rows from last ${days} days`);

  if (rows.length === 0) return;

  const mapped = rows.map((r: any) => {
    const status = String(r.xtcsta_kbr ?? "").trim();
    const { edi_type, lifecycle } = parseStatus(status);
    return {
      idnkbr: Number(r.idnkbr_kbr),
      parent_table: String(r.itttbl_kbr ?? "").trim(),
      parent_id: Number(r.idnitt_kbr),
      idnkap: r.idnkap_kbr != null ? Number(r.idnkap_kbr) : null,
      scenario: String(r.xtcscn_kbr ?? "").trim() || null,
      status,
      transmitted_at: r.xtctme_kbr,
      added_by: String(r.addnme_kbr ?? "").trim() || null,
      added_at: r.addtme_kbr,
      edi_type,
      lifecycle,
    };
  });

  // Upsert in batches keyed on unique idnkbr
  let written = 0;
  for (let i = 0; i < mapped.length; i += 500) {
    const batch = mapped.slice(i, i + 500);
    const { error, count } = await sb
      .from("ll_edi_transmissions")
      .upsert(batch, { onConflict: "idnkbr", count: "exact" });
    if (error) {
      console.error(`upsert batch ${i}: ${error.message}`);
      break;
    }
    written += count ?? batch.length;
  }

  console.log(`Wrote ${written} rows to ll_edi_transmissions`);

  // Breakdown by lifecycle — useful for operator visibility
  const breakdown: Record<string, number> = {};
  for (const m of mapped) {
    const key = `${m.edi_type}:${m.lifecycle}`;
    breakdown[key] = (breakdown[key] ?? 0) + 1;
  }
  console.log(`\nTransmission breakdown (last ${days}d):`);
  for (const [k, v] of Object.entries(breakdown).sort()) {
    console.log(`  ${k.padEnd(26)} ${v}`);
  }

  // Flag any problems
  const problems = mapped.filter((m) => m.lifecycle === "problem");
  if (problems.length > 0) {
    console.log(`\n⚠️  ${problems.length} EDI transmission(s) in 'problem' state — investigate:`);
    for (const p of problems.slice(0, 20)) {
      console.log(`  idnkbr=${p.idnkbr} parent=${p.parent_table}:${p.parent_id} status="${p.status}" at ${p.transmitted_at}`);
    }
  }

  await sb.from("sync_log").insert({
    action: "ll_edi_transmissions_sync",
    details: { rows_pulled: rows.length, rows_written: written, days, problem_count: problems.length },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
