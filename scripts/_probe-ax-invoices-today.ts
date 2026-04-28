import "./env";
const TENANT_ID = process.env.AX_TENANT_ID!;
const CLIENT_ID = process.env.AX_CLIENT_ID!;
const CLIENT_SECRET = process.env.AX_CLIENT_SECRET!;
const D365 = process.env.AX_D365_URL!;
async function getToken(): Promise<string> {
  const p = new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, client_secret: CLIENT_SECRET, scope: `${D365}/.default` });
  const r = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, { method: "POST", body: p });
  const d: any = await r.json(); if (!d.access_token) throw new Error(d.error_description); return d.access_token;
}
(async () => {
  const token = await getToken();
  // Use cross-company=true (per other DIBS code) and try common AX V3 invoice entity names
  const candidates = [
    `CustomerInvoiceJournalHeaders?cross-company=true&$top=2&$count=true`,
    `CustomerInvoiceJournalLinesV2?cross-company=true&$top=2&$count=true`,
    `InvoicedSalesOrderLines?cross-company=true&$top=2&$count=true`,
    `SalesInvoiceHeadersV2?cross-company=true&$top=2&$count=true`,
    `SalesInvoiceLinesV2?cross-company=true&$top=2&$count=true`,
    `CustInvoiceJourLinesV2?cross-company=true&$top=2&$count=true`,
    `CustInvoiceJour?cross-company=true&$top=2&$count=true`,
    `InvoiceJournalHeaders?cross-company=true&$top=2&$count=true`,
    `BillingDetails?cross-company=true&$top=2&$count=true`,
    `OpenSalesInvoiceHeaders?cross-company=true&$top=2&$count=true`,
    `PostedInvoiceHeaders?cross-company=true&$top=2&$count=true`,
  ];
  for (const c of candidates) {
    try {
      const r = await fetch(`${D365}/data/${c}`, { headers: { Authorization: `Bearer ${token}` } });
      const status = r.status === 200 ? "✅" : r.status === 404 ? "❌" : "⚠️";
      let info = "";
      if (r.ok) {
        const d: any = await r.json();
        const cols = d.value?.[0] ? Object.keys(d.value[0]).slice(0, 8).join(",") : "(empty)";
        info = ` count=${d["@odata.count"] ?? "?"} cols=${cols}`;
      }
      console.log(`${status} ${r.status}  ${c.split("?")[0]}${info}`);
    } catch (e: any) { console.log(`💥 ${c.split("?")[0]}: ${e.message?.slice(0,80)}`); }
  }
})();
