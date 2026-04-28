/**
 * Pull today's DD219 invoices from AX D365 — the "Invoice History → today
 * → DD219" set Abe currently downloads to Excel and retypes into LamLinks.
 *
 *   npx tsx scripts/pull-ax-dd219-invoices-today.ts
 *   npx tsx scripts/pull-ax-dd219-invoices-today.ts --date=2026-04-28
 *
 * Output: prints the invoices and writes a JSON dump to /tmp/dd219-invoices-<date>.json
 * for downstream LL writeback. Each entry includes the header + every line.
 *
 * AX entities used:
 *   - SalesInvoiceHeadersV2  — InvoiceNumber, InvoiceDate, SalesOrderNumber,
 *                              InvoiceCustomerAccountNumber (filter='DD219'),
 *                              CustomersOrderReference (contract+CLIN tag),
 *                              TotalInvoiceAmount
 *   - SalesInvoiceLines      — InvoiceNumber, ProductNumber, ProductDescription,
 *                              InvoicedQuantity, SalesPrice, SalesUnitSymbol,
 *                              LineAmount
 */
import "./env";

const TENANT_ID = process.env.AX_TENANT_ID!;
const CLIENT_ID = process.env.AX_CLIENT_ID!;
const CLIENT_SECRET = process.env.AX_CLIENT_SECRET!;
const D365 = process.env.AX_D365_URL!;

interface InvoiceHeader {
  invoiceNumber: string;
  invoiceDate: string;
  salesOrder: string | null;
  customer: string;
  customerOrderReference: string | null;
  totalAmount: number;
  dataAreaId: string;
}

interface InvoiceLine {
  invoiceNumber: string;
  productNumber: string;
  productDescription: string;
  invoicedQuantity: number;
  salesPrice: number;
  uom: string;
  lineAmount: number;
}

async function getToken(): Promise<string> {
  const p = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: `${D365}/.default`,
  });
  const r = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, { method: "POST", body: p });
  const d: any = await r.json();
  if (!d.access_token) throw new Error("auth failed: " + d.error_description);
  return d.access_token;
}

async function pullHeaders(token: string, date: string): Promise<InvoiceHeader[]> {
  // Filter: DD219 customer + invoice date == target date
  // Filter at OData level so we only get the rows we care about.
  const filter = `InvoiceCustomerAccountNumber eq 'DD219' and InvoiceDate eq ${date}T12:00:00Z`;
  const url = `${D365}/data/SalesInvoiceHeadersV2?cross-company=true&$top=1000&$filter=${encodeURIComponent(filter)}&$select=InvoiceNumber,InvoiceDate,SalesOrderNumber,InvoiceCustomerAccountNumber,CustomersOrderReference,TotalInvoiceAmount,dataAreaId`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`headers fetch failed: ${r.status} ${await r.text().then(t=>t.slice(0,200))}`);
  const d: any = await r.json();
  return (d.value || []).map((row: any) => ({
    invoiceNumber: row.InvoiceNumber,
    invoiceDate: row.InvoiceDate,
    salesOrder: row.SalesOrderNumber || null,
    customer: row.InvoiceCustomerAccountNumber,
    customerOrderReference: row.CustomersOrderReference || null,
    totalAmount: Number(row.TotalInvoiceAmount) || 0,
    dataAreaId: row.dataAreaId,
  }));
}

async function pullLinesForInvoices(token: string, invoiceNumbers: string[]): Promise<Map<string, InvoiceLine[]>> {
  const result = new Map<string, InvoiceLine[]>();
  // Per-invoice fetch (AX OData rejects `in (...)` here; eq works).
  // Acceptable concurrency: 5 in flight at a time so we don't hammer.
  const queue = [...invoiceNumbers];
  async function worker() {
    while (queue.length > 0) {
      const inv = queue.shift();
      if (!inv) return;
      const filter = `InvoiceNumber eq '${inv}'`;
      const url = `${D365}/data/SalesInvoiceLines?cross-company=true&$top=200&$filter=${encodeURIComponent(filter)}&$select=InvoiceNumber,ProductNumber,ProductDescription,InvoicedQuantity,SalesPrice,SalesUnitSymbol,LineAmount`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { console.error(`lines for ${inv}: ${r.status}`); continue; }
      const d: any = await r.json();
      const lines: InvoiceLine[] = (d.value || []).map((row: any) => ({
        invoiceNumber: inv,
        productNumber: row.ProductNumber,
        productDescription: row.ProductDescription,
        invoicedQuantity: Number(row.InvoicedQuantity) || 0,
        salesPrice: Number(row.SalesPrice) || 0,
        uom: row.SalesUnitSymbol || "EA",
        lineAmount: Number(row.LineAmount) || 0,
      }));
      result.set(inv, lines);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker(), worker()]);
  return result;
}

async function main() {
  const dateArg = process.argv.find((a) => a.startsWith("--date="));
  const date = dateArg ? dateArg.split("=")[1] : new Date().toISOString().slice(0, 10);

  const token = await getToken();
  console.log(`Pulling DD219 invoices for ${date} from AX...`);
  const headers = await pullHeaders(token, date);
  console.log(`  ${headers.length} headers`);

  if (headers.length === 0) {
    console.log("No DD219 invoices on that date. Done.");
    return;
  }

  const linesByInvoice = await pullLinesForInvoices(token, headers.map((h) => h.invoiceNumber));
  let totalLines = 0;
  for (const lines of linesByInvoice.values()) totalLines += lines.length;
  console.log(`  ${totalLines} lines across ${linesByInvoice.size} invoices`);

  const merged = headers.map((h) => ({ ...h, lines: linesByInvoice.get(h.invoiceNumber) || [] }));
  console.log(`\nFirst 5 invoices:`);
  for (const m of merged.slice(0, 5)) {
    console.log(`  ${m.invoiceNumber} (${m.salesOrder || "no SO"}) ref=${m.customerOrderReference || "?"} total=$${m.totalAmount} lines=${m.lines.length}`);
    for (const l of m.lines.slice(0, 3)) {
      console.log(`    ${l.productNumber} qty=${l.invoicedQuantity}${l.uom} @ $${l.salesPrice} = $${l.lineAmount}`);
    }
  }

  const outPath = `C:/tmp/dd219-invoices-${date}.json`;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("fs").writeFileSync(outPath, JSON.stringify(merged, null, 2));
  console.log(`\n✓ wrote ${merged.length} merged invoices → ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
