/**
 * Pre-mark AX invoices that Abe already manually posted in LL today as
 * state='posted' in the queue, so the next Import doesn't re-enqueue them
 * and the worker doesn't try to re-write them.
 *
 * Match: AX InvoiceNumber "CIN0066169" ↔ LL kad.cinnum_kad "0066169".
 *
 *   npx tsx scripts/_premark-already-invoiced.ts
 *   npx tsx scripts/_premark-already-invoiced.ts --date=2026-04-28
 */
import "./env";
import sql from "mssql/msnodesqlv8";
import { createClient } from "@supabase/supabase-js";

(async () => {
  const dateArg = process.argv.find((a) => a.startsWith("--date="));
  const date = dateArg ? dateArg.split("=")[1] : new Date().toISOString().slice(0, 10);

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const pool = await sql.connect({
    connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
  });

  // Today's DD219 invoices already posted in LL
  const llDone = await pool.request().query(`
    SELECT idnkad_kad, cin_no_kad, cinnum_kad, mslval_kad
    FROM kad_tab
    WHERE idnk31_kad = 203
      AND CAST(cisdte_kad AS DATE) = '${date}'
      AND LTRIM(RTRIM(cinsta_kad)) = 'Posted'
  `);
  console.log(`LL has ${llDone.recordset.length} posted DD219 invoices for ${date}`);
  if (llDone.recordset.length === 0) { await pool.close(); return; }

  // For each, mark/insert as 'posted' in our queue
  let inserted = 0, updated = 0;
  for (const k of llDone.recordset) {
    const cinnum = String(k.cinnum_kad).trim();
    const axInvoice = `CIN${cinnum}`;
    // Try to find matching queue row first
    const { data: existing } = await sb
      .from("lamlinks_invoice_queue")
      .select("id, state")
      .eq("ax_invoice_number", axInvoice)
      .maybeSingle();

    if (existing) {
      if (existing.state !== "posted") {
        await sb.from("lamlinks_invoice_queue").update({
          state: "posted",
          ll_idnkad: k.idnkad_kad,
          ll_cin_no: String(k.cin_no_kad).trim(),
          posted_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", existing.id);
        updated++;
        console.log(`  ↻ ${axInvoice} → marked posted (was ${existing.state}, idnkad=${k.idnkad_kad})`);
      }
    } else {
      // Insert a placeholder row so future Import sees it as already-done
      await sb.from("lamlinks_invoice_queue").insert({
        ax_invoice_number: axInvoice,
        ax_customer: "DD219",
        ax_invoice_date: date,
        ax_total_amount: Number(k.mslval_kad) || 0,
        ax_lines: [],
        state: "posted",
        ll_idnkad: k.idnkad_kad,
        ll_cin_no: String(k.cin_no_kad).trim(),
        posted_at: new Date().toISOString(),
        enqueued_by: "premark-already-invoiced",
      });
      inserted++;
      console.log(`  + ${axInvoice} → inserted as posted (idnkad=${k.idnkad_kad}, $${k.mslval_kad})`);
    }
  }
  console.log(`\nDone. ${inserted} inserted, ${updated} updated.`);
  await pool.close();
})();
