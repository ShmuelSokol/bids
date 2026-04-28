import "./env";
const TENANT_ID = process.env.AX_TENANT_ID!;
const CLIENT_ID = process.env.AX_CLIENT_ID!;
const CLIENT_SECRET = process.env.AX_CLIENT_SECRET!;
const D365 = process.env.AX_D365_URL!;
async function getToken(): Promise<string> {
  const p = new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, client_secret: CLIENT_SECRET, scope: `${D365}/.default` });
  const r = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, { method: "POST", body: p });
  const d: any = await r.json(); return d.access_token;
}
(async () => {
  const t = await getToken();
  // Get most recent invoice headers
  const today = new Date();
  const y = today.getFullYear(), m = String(today.getMonth()+1).padStart(2,"0"), d = String(today.getDate()).padStart(2,"0");
  const todayStr = `${y}-${m}-${d}T00:00:00Z`;
  const yesStr = new Date(Date.now() - 24*3600*1000).toISOString().slice(0,19) + "Z";
  // Show full sample rows
  const r1 = await fetch(`${D365}/data/SalesInvoiceHeadersV2?cross-company=true&$top=3&$orderby=InvoiceDate desc`, { headers: { Authorization: `Bearer ${t}` } });
  const d1: any = await r1.json();
  console.log("=== SalesInvoiceHeadersV2 — 3 most recent ===");
  for (const r of d1.value || []) {
    console.log(JSON.stringify({
      Invoice: r.InvoiceNumber, Date: r.InvoiceDate, SO: r.SalesOrderNumber,
      Cust: r.InvoiceCustomerAccountNumber, CustRef: r.CustomersOrderReference,
      Total: r.TotalInvoiceAmount, dataArea: r.dataAreaId,
    }));
  }
  // Lines too
  const r2 = await fetch(`${D365}/data/SalesInvoiceLines?cross-company=true&$top=3`, { headers: { Authorization: `Bearer ${t}` } });
  const d2: any = await r2.json();
  console.log("\n=== SalesInvoiceLines — 3 sample rows ===");
  if (d2.value?.[0]) {
    const cols = Object.keys(d2.value[0]);
    const interesting = cols.filter(k => /invoice|product|item|qty|quantity|price|amount|nsn|requis|contract|order|delivery|piid|uom/i.test(k));
    console.log("interesting cols:", interesting.join(", "));
    console.log("sample line:", JSON.stringify(d2.value[0], null, 2).slice(0, 1500));
  } else console.log("no rows");
  // Try filter by recent date — see if we can find today's invoices
  const filter = `InvoiceDate ge ${yesStr}`;
  const r3 = await fetch(`${D365}/data/SalesInvoiceHeadersV2?cross-company=true&$top=20&$filter=${encodeURIComponent(filter)}&$count=true`, { headers: { Authorization: `Bearer ${t}` } });
  const d3: any = await r3.json();
  console.log(`\n=== Recent invoices since ${yesStr} ===`);
  console.log(`count=${d3["@odata.count"] ?? "?"}, sample rows:`, d3.value?.length);
  for (const r of (d3.value || []).slice(0, 5)) {
    console.log(`  ${r.InvoiceNumber} ${String(r.InvoiceDate).slice(0,10)} SO=${r.SalesOrderNumber} cust=${r.InvoiceCustomerAccountNumber} ref=${r.CustomersOrderReference} $${r.TotalInvoiceAmount}`);
  }
})();
