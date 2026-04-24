/**
 * Pull one row from each accessible AX customer-payment entity to see
 * the column shape — particularly which fields hold the invoice number
 * and customer (so we can match WAWF 810s to actual payments).
 */
import "./env";

const TENANT_ID = process.env.AX_TENANT_ID!;
const CLIENT_ID = process.env.AX_CLIENT_ID!;
const CLIENT_SECRET = process.env.AX_CLIENT_SECRET!;
const D365_URL = process.env.AX_D365_URL!;

async function getToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: `${D365_URL}/.default`,
  });
  const resp = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, { method: "POST", body: params });
  const data: any = await resp.json();
  return data.access_token;
}

async function main() {
  const token = await getToken();
  for (const entity of ["CustomerPaymentJournalLines", "CustTransactions", "SalesOrderHeadersV2"]) {
    const url = `${D365_URL}/data/${entity}?$top=1`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data: any = await r.json();
    console.log(`\n=== ${entity} (sample row) ===`);
    if (data.value?.[0]) {
      const sample = data.value[0];
      const interesting = Object.keys(sample).filter((k) =>
        /invoice|payment|customer|cust|amount|date|reference|sales|order|contract|description|trans|account|posted|settled|due|aging|paid/i.test(k)
      );
      for (const k of interesting) {
        const v = sample[k];
        const printable = typeof v === "object" ? JSON.stringify(v).slice(0, 50) : String(v).slice(0, 50);
        console.log(`  ${k.padEnd(38)}  ${printable}`);
      }
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
