import "../scripts/env";
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
  // Look for line-level entities for SalesInvoice
  const cands = [
    "SalesInvoiceLineV2","SalesInvoiceLinesV3","SalesInvoiceLineHeadersV2","SalesInvoiceLines",
    "InvoicedSalesOrderLinesV2","BillingDocumentLines","CustomerInvoiceLines"
  ];
  for (const c of cands) {
    const r = await fetch(`${D365}/data/${c}?cross-company=true&$top=1`, { headers: { Authorization: `Bearer ${t}` } });
    console.log(r.status === 200 ? "✅" : "❌", r.status, c);
  }
  // Also fetch the metadata for SalesInvoiceHeadersV2 to see all columns
  const r2 = await fetch(`${D365}/data/SalesInvoiceHeadersV2?cross-company=true&$top=1`, { headers: { Authorization: `Bearer ${t}` } });
  const d2: any = await r2.json();
  console.log("\nSalesInvoiceHeadersV2 sample row keys:", Object.keys(d2.value?.[0] || {}).join(", "));
})();
