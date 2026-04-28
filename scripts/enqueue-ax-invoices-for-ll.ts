/**
 * Pull today's DD219 invoices from AX and enqueue each into
 * lamlinks_invoice_queue (Supabase). The daemon worker then drains
 * the queue and writes kad+kae rows to LL.
 *
 *   npx tsx scripts/enqueue-ax-invoices-for-ll.ts
 *   npx tsx scripts/enqueue-ax-invoices-for-ll.ts --date=2026-04-28
 *
 * Idempotent: re-running on the same day skips invoices already in the
 * queue (UNIQUE on ax_invoice_number). Useful when Abe re-runs the
 * "Import" button mid-day.
 */
import "./env";
import { createClient } from "@supabase/supabase-js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sql = require("mssql/msnodesqlv8");

const TENANT_ID = process.env.AX_TENANT_ID!;
const CLIENT_ID = process.env.AX_CLIENT_ID!;
const CLIENT_SECRET = process.env.AX_CLIENT_SECRET!;
const D365 = process.env.AX_D365_URL!;

async function getToken(): Promise<string> {
  const p = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: `${D365}/.default`,
  });
  const r = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, { method: "POST", body: p });
  const d: any = await r.json();
  if (!d.access_token) throw new Error(d.error_description);
  return d.access_token;
}

async function pullHeaders(token: string, date: string) {
  const filter = `InvoiceCustomerAccountNumber eq 'DD219' and InvoiceDate eq ${date}T12:00:00Z`;
  const url = `${D365}/data/SalesInvoiceHeadersV2?cross-company=true&$top=1000&$filter=${encodeURIComponent(filter)}&$select=InvoiceNumber,InvoiceDate,SalesOrderNumber,InvoiceCustomerAccountNumber,CustomersOrderReference,TotalInvoiceAmount,dataAreaId`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`headers: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()) as any).value || [];
}

async function pullLines(token: string, invoiceNumber: string) {
  const filter = `InvoiceNumber eq '${invoiceNumber}'`;
  const url = `${D365}/data/SalesInvoiceLines?cross-company=true&$top=200&$filter=${encodeURIComponent(filter)}&$select=ProductNumber,ProductDescription,InvoicedQuantity,SalesPrice,SalesUnitSymbol,LineAmount`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return [];
  return ((await r.json()) as any).value || [];
}

async function main() {
  const dateArg = process.argv.find((a) => a.startsWith("--date="));
  const date = dateArg ? dateArg.split("=")[1] : new Date().toISOString().slice(0, 10);

  console.log(`Enqueueing DD219 invoices for ${date}...`);

  const token = await getToken();
  const headers = await pullHeaders(token, date);
  console.log(`AX returned ${headers.length} DD219 invoice headers for ${date}`);
  if (headers.length === 0) return;

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Pre-mark any AX invoices that Abe already posted manually in LL today —
  // we don't want to re-process them (would duplicate the bid to DLA). Match
  // is on cinnum_kad (LL) ↔ AX InvoiceNumber digits ("CIN" prefix stripped).
  try {
    const pool = await sql.connect({
      connectionString: "Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;",
    });
    const llDone = await pool.request().query(`
      SELECT idnkad_kad, cin_no_kad, cinnum_kad, mslval_kad
      FROM kad_tab
      WHERE idnk31_kad = 203
        AND CAST(cisdte_kad AS DATE) = '${date}'
        AND LTRIM(RTRIM(cinsta_kad)) = 'Posted'
    `);
    let preMarked = 0;
    for (const k of llDone.recordset) {
      const axInvoice = `CIN${String(k.cinnum_kad).trim()}`;
      const { data: existing } = await sb
        .from("lamlinks_invoice_queue")
        .select("id, state")
        .eq("ax_invoice_number", axInvoice)
        .maybeSingle();
      if (existing && existing.state === "posted") continue;
      const updates: any = {
        state: "posted",
        ll_idnkad: k.idnkad_kad,
        ll_cin_no: String(k.cin_no_kad).trim(),
        posted_at: new Date().toISOString(),
        error_message: null,
      };
      if (existing) {
        await sb.from("lamlinks_invoice_queue").update(updates).eq("id", existing.id);
      } else {
        await sb.from("lamlinks_invoice_queue").insert({
          ax_invoice_number: axInvoice,
          ax_customer: "DD219",
          ax_invoice_date: date,
          ax_total_amount: Number(k.mslval_kad) || 0,
          ax_lines: [],
          enqueued_by: "premark-already-invoiced",
          ...updates,
        });
      }
      preMarked++;
    }
    if (preMarked > 0) console.log(`  pre-marked ${preMarked} already-done LL invoices as state=posted (won't be re-processed)`);
    await pool.close();
  } catch (e: any) {
    console.warn(`  warn: pre-mark step failed (${e.message?.slice(0,100)}) — proceeding without dedup`);
  }

  // Skip ones already in the queue
  const invoiceNumbers = headers.map((h: any) => h.InvoiceNumber);
  const { data: existing } = await sb
    .from("lamlinks_invoice_queue")
    .select("ax_invoice_number")
    .in("ax_invoice_number", invoiceNumbers);
  const existingSet = new Set((existing || []).map((r: any) => r.ax_invoice_number));
  const toEnqueue = headers.filter((h: any) => !existingSet.has(h.InvoiceNumber));
  console.log(`  ${existingSet.size} already in queue, ${toEnqueue.length} new to enqueue`);

  let inserted = 0;
  for (const h of toEnqueue) {
    const lines = await pullLines(token, h.InvoiceNumber);
    const lineRows = lines.map((l: any) => ({
      productNumber: l.ProductNumber,
      productDescription: l.ProductDescription,
      invoicedQuantity: Number(l.InvoicedQuantity) || 0,
      salesPrice: Number(l.SalesPrice) || 0,
      uom: l.SalesUnitSymbol || "EA",
      lineAmount: Number(l.LineAmount) || 0,
    }));
    const { error } = await sb.from("lamlinks_invoice_queue").insert({
      ax_invoice_number: h.InvoiceNumber,
      ax_sales_order: h.SalesOrderNumber || null,
      ax_customer: h.InvoiceCustomerAccountNumber,
      ax_customer_order_reference: h.CustomersOrderReference || null,
      ax_invoice_date: String(h.InvoiceDate).slice(0, 10),
      ax_total_amount: Number(h.TotalInvoiceAmount) || 0,
      ax_lines: lineRows,
      enqueued_by: "enqueue-ax-invoices-for-ll",
    });
    if (error) { console.error(`  ${h.InvoiceNumber}: ${error.message}`); continue; }
    inserted++;
    console.log(`  ✓ ${h.InvoiceNumber} (${lineRows.length} lines, $${h.TotalInvoiceAmount})`);
  }
  console.log(`\nEnqueued ${inserted} invoices`);
}

main().catch((e) => { console.error(e); process.exit(1); });
