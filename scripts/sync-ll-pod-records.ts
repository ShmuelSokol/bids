/**
 * Sync LamLinks k89_tab (received POs + POD acks) → Supabase ll_pod_records.
 *
 * k89_tab stores the customer purchase orders LL has received, plus the
 * POD ack state (podsta_k89 = 'Sent' / 'Acknowledged' / 'Pending Review' /
 * 'Approved' / 'Hold' / 'Not Sent') and the receipt state
 * (rcvsta_k89 = 'Pending' / 'Back Order' / 'Completed' / 'Cancelled').
 *
 *   npx tsx scripts/sync-ll-pod-records.ts [--days 60]
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
  const daysArg = process.argv.indexOf("--days");
  const days = daysArg >= 0 ? parseInt(process.argv[daysArg + 1] ?? "60", 10) : 60;

  const pool = await sql.connect(config);

  const result = await pool.request().query(`
    SELECT
      idnk89_k89, uptime_k89,
      por_no_k89, po_dte_k89, po_val_k89,
      podsta_k89, poddte_k89,
      rcvsta_k89, rcedte_k89,
      cnt_no_k89, cntpri_k89,
      fobtyp_k89, fobzip_k89,
      shipin_k89
    FROM k89_tab
    WHERE uptime_k89 >= DATEADD(day, -${days}, GETDATE())
    ORDER BY idnk89_k89 DESC
  `);
  const rows = result.recordset;
  await pool.close();

  console.log(`Pulled ${rows.length} k89 rows from last ${days} days`);
  if (rows.length === 0) return;

  const mapped = rows.map((r: any) => ({
    idnk89: Number(r.idnk89_k89),
    po_number: String(r.por_no_k89 ?? "").trim() || null,
    po_date: r.po_dte_k89,
    po_value: r.po_val_k89 != null ? Number(r.po_val_k89) : null,
    pod_status: String(r.podsta_k89 ?? "").trim() || null,
    pod_date: r.poddte_k89,
    receipt_status: String(r.rcvsta_k89 ?? "").trim() || null,
    receipt_date: r.rcedte_k89,
    contract_number: String(r.cnt_no_k89 ?? "").trim() || null,
    contract_price: String(r.cntpri_k89 ?? "").trim() || null,
    fob_type: String(r.fobtyp_k89 ?? "").trim() || null,
    fob_zip: String(r.fobzip_k89 ?? "").trim() || null,
    shipping_info: String(r.shipin_k89 ?? "").trim() || null,
    updated_at_ll: r.uptime_k89,
  }));

  let written = 0;
  for (let i = 0; i < mapped.length; i += 500) {
    const batch = mapped.slice(i, i + 500);
    const { error, count } = await sb
      .from("ll_pod_records")
      .upsert(batch, { onConflict: "idnk89", count: "exact" });
    if (error) {
      console.error(`upsert batch ${i}: ${error.message}`);
      break;
    }
    written += count ?? batch.length;
  }

  console.log(`Wrote ${written} rows to ll_pod_records`);

  const byStatus: Record<string, number> = {};
  for (const m of mapped) {
    const k = m.pod_status || "(null)";
    byStatus[k] = (byStatus[k] ?? 0) + 1;
  }
  console.log(`\nPOD status distribution (last ${days}d):`);
  for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} ${v}`);
  }

  const open = mapped.filter(
    (m) => m.pod_status === "Sent" && !m.pod_date
  );
  if (open.length > 0) {
    console.log(`\n📬 ${open.length} POD(s) sent but not yet acknowledged:`);
    for (const o of open.slice(0, 15)) {
      console.log(`  po=${o.po_number} cnt=${o.contract_number} sent_at=${o.po_date} val=$${o.po_value}`);
    }
  }

  await sb.from("sync_log").insert({
    action: "ll_pod_records_sync",
    details: { rows_pulled: rows.length, rows_written: written, days },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
