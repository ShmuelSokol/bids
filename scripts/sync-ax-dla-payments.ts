/**
 * Sync DLA payments from AX → Supabase ax_dla_payments. Used by the
 * WAWF ack tracker to definitively mark invoices as paid (vs inferring
 * from age).
 *
 * Source: CustomerPaymentJournalLines (filtered to DLA's customer
 * account 'DD219'). Each AX MarkedInvoice = "CIN" + LL.cinnum_kad,
 * so we strip the CIN prefix and store both forms for matching.
 *
 *   npx tsx scripts/sync-ax-dla-payments.ts [--days 90]
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
import { fetchAxByMonth } from "./ax-fetch";

const TENANT_ID = process.env.AX_TENANT_ID!;
const CLIENT_ID = process.env.AX_CLIENT_ID!;
const CLIENT_SECRET = process.env.AX_CLIENT_SECRET!;
const D365_URL = process.env.AX_D365_URL!;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: `${D365_URL}/.default`,
  });
  const resp = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, { method: "POST", body: params });
  const data: any = await resp.json();
  if (!data.access_token) throw new Error("Auth failed: " + data.error_description);
  return data.access_token;
}

function normalizeInvoice(marked: string | null | undefined): string {
  if (!marked) return "";
  // AX MarkedInvoice = "CIN0065068" or "CINV0065068"; LL cinnum_kad = "0065068"
  // Strip CIN/CINV prefix, then strip leading zeros for tolerant matching.
  const stripped = String(marked).trim().replace(/^CINV?/i, "");
  return stripped;
}

async function main() {
  const daysArg = process.argv.indexOf("--days");
  const days = daysArg >= 0 ? parseInt(process.argv[daysArg + 1] ?? "90", 10) : 90;

  const token = await getToken();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const all: any[] = [];
  // AX OData has a hidden 1000-row cap on filtered queries (no nextLink
  // emitted past it). Use fetchAxByMonth to chunk by date — each month
  // stays under the cap, auto-narrows to weekly if a month overflows.
  //
  // Voucher format: "CINV0016236" (customer invoice voucher)
  // Invoice  format: "CIN0016236"  (the invoice number proper)
  // LL.cinnum_kad: "0016236" (matches by stripping CIN prefix)
  const monthsBack = Math.ceil(days / 30);

  const r1 = await fetchAxByMonth(token, {
    D365_URL,
    entity: "CustTransactions",
    dateField: "TransDate",
    baseFilter: "OrderAccount eq 'DD219'",
    monthsBack,
    label: "DLA invoices by TransDate",
  });
  const r2 = await fetchAxByMonth(token, {
    D365_URL,
    entity: "CustTransactions",
    dateField: "LastSettleDate",
    baseFilter: "OrderAccount eq 'DD219'",
    monthsBack,
    label: "DLA settlements by LastSettleDate",
  });

  // Dedupe by SysRecId — TransDate and LastSettleDate queries both
  // include settled rows.
  const seen = new Set<number>();
  for (const row of [...r1.rows, ...r2.rows]) {
    const k = Number(row.SysRecId);
    if (!seen.has(k)) {
      seen.add(k);
      all.push(row);
    }
  }
  const totalPages = r1.pageCount + r2.pageCount;
  for (let _i = all.length - 1; _i >= 0; _i--) {
    if (false) break; // placeholder so the next line's structure stays valid
  }
  // ↑ no-op loop preserves indentation diff; real dedupe is above.
  for (let i = 0; i < 0; i++) {
    const k = Number(all[i].SysRecId);
    if (seen.has(k)) all.splice(i, 1);
    else seen.add(k);
  }
  const page = totalPages; // for legacy log line

  console.log(`Pulled ${all.length} DLA CustTransactions (last ${days}d, ${page} pages)`);
  if (all.length === 0) return;

  // CustTransactions has both invoice (CINV*) and payment (CPAY* etc)
  // rows. We want INVOICE rows that show settlement status — those are
  // our matchable invoices, with Settlement='Yes' meaning DLA has paid.
  const mapped = all
    // Keep only customer-invoice transactions (Voucher starts with CINV).
    // OData doesn't support startswith() on this entity in our tenant,
    // so filter in JS instead.
    .filter((r: any) => String(r.Voucher || "").startsWith("CINV"))
    .map((r: any) => {
    const isSettled =
      r.Settlement === "Yes" &&
      r.LastSettleDate &&
      !String(r.LastSettleDate).startsWith("1900");
    // Prefer Invoice field (CIN0016236), fall back to stripped Voucher
    const invFromInvoice = normalizeInvoice(r.Invoice);
    const invFromVoucher = normalizeInvoice(r.Voucher);
    const normalized = invFromInvoice || invFromVoucher;
    return {
      ax_voucher: r.Voucher || null,
      marked_invoice: r.Invoice || r.Voucher || "",
      marked_invoice_normalized: normalized,
      ax_company: r.dataAreaId || "szyh",
      customer_account: r.OrderAccount || "DD219",
      customer_name: null,
      payment_amount: isSettled
        ? Math.abs(Number(r.SettleAmountCur || r.AmountCur || 0))
        : null,
      payment_date: isSettled ? r.LastSettleDate : r.TransDate,
      payment_reference: r.LastSettleVoucher || null,
      payment_method: r.PaymMode || null,
      source_table: "CustTransactions",
      source_recid: r.SysRecId != null ? Number(r.SysRecId) : null,
    };
  })
    .filter((m) => m.marked_invoice_normalized);

  let written = 0;
  for (let i = 0; i < mapped.length; i += 500) {
    const batch = mapped.slice(i, i + 500);
    const { error, count } = await sb
      .from("ax_dla_payments")
      .upsert(batch, { onConflict: "source_table,source_recid", count: "exact" });
    if (error) {
      console.error(`batch ${i}: ${error.message}`);
      break;
    }
    written += count ?? batch.length;
  }
  console.log(`Upserted ${written} payments to ax_dla_payments`);

  const settled = mapped.filter((m) => m.payment_amount != null);
  const unsettled = mapped.filter((m) => m.payment_amount == null);
  const settledAmount = settled.reduce((s, m) => s + (m.payment_amount || 0), 0);
  console.log(`  ${settled.length} settled (DLA paid) totaling $${settledAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  console.log(`  ${unsettled.length} unsettled (still aging or not paid yet)`);
  const distinct = new Set(mapped.map((m) => m.marked_invoice_normalized)).size;
  console.log(`  ${distinct} distinct invoice numbers`);

  console.log(`\n  recent settled invoices (most recent first):`);
  const recentSettled = [...settled].sort((a, b) => String(b.payment_date).localeCompare(String(a.payment_date)));
  for (const m of recentSettled.slice(0, 10)) {
    console.log(`    ${String(m.payment_date).slice(0, 10)}  inv=${m.marked_invoice}  $${m.payment_amount}`);
  }

  await sb.from("sync_log").insert({
    action: "ax_dla_payments_sync",
    details: {
      rows_pulled: all.length,
      rows_written: written,
      settled_count: settled.length,
      settled_amount: settledAmount,
      unsettled_count: unsettled.length,
      distinct_invoices: distinct,
      days,
    },
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
