/**
 * Probe whether the existing AX OAuth client has access to customer-side
 * financial entities. If yes, we can build Phase 2 of the ack tracker
 * (mark transmissions "paid" when payment lands). If no, Yosef needs to
 * expand the AX app registration's permissions before we can proceed.
 *
 *   npx tsx scripts/probe-ax-customer-payments.ts
 *
 * Tests several likely entity names; each request returns 200 (entity
 * exists, permission OK), 401 (not authorized), 404 (no such entity), or
 * 403 (entity exists but blocked).
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
  const resp = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    body: params,
  });
  const data: any = await resp.json();
  if (!data.access_token) throw new Error("Auth failed: " + data.error_description);
  return data.access_token;
}

const ENTITIES_TO_PROBE = [
  // Customer payment journals
  "CustomerPaymentJournalHeaders",
  "CustomerPaymentJournalLines",
  "CustomerPaymentEntries",
  // Customer transactions / settlements
  "CustomerTransactions",
  "CustTransactions",
  "CustomerSettlements",
  "CustSettlements",
  // Sales invoices (sent to DLA, complementary view)
  "CustomerInvoiceJournalHeaders",
  "CustomerInvoiceJournalLines",
  "CustomerInvoiceJournalLinesV2",
  "CustomerInvoiceHeader",
  "InvoicedSalesOrderHeaders",
  "InvoicedSalesOrderLines",
  // Sales orders
  "SalesOrderHeadersV2",
  "SalesOrderLinesV2",
  // Customer master
  "CustomersV3",
  "CustomerGroups",
  // Generic finance
  "GeneralJournalAccountEntries",
  "LedgerJournalHeaders",
  "LedgerJournalTrans",
];

async function main() {
  const token = await getToken();
  console.log(`Token acquired. Probing ${ENTITIES_TO_PROBE.length} customer/finance entities at ${D365_URL}\n`);
  console.log(`status  count       entity`);
  console.log(`──────  ──────────  ────────────────────────────────────────`);

  for (const entity of ENTITIES_TO_PROBE) {
    const url = `${D365_URL}/data/${entity}?$top=1&$count=true`;
    try {
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      let count = "—";
      if (resp.status === 200) {
        const data: any = await resp.json();
        count = String(data["@odata.count"] ?? data.value?.length ?? "?");
      }
      const symbol = resp.status === 200 ? "✅" : resp.status === 404 ? "❌" : resp.status === 401 || resp.status === 403 ? "🔒" : "⚠️";
      console.log(`${symbol} ${String(resp.status).padEnd(4)}  ${count.padEnd(10)}  ${entity}`);
    } catch (e: any) {
      console.log(`💥 err  —           ${entity}: ${e.message?.slice(0, 60)}`);
    }
  }

  console.log(`\nLegend: ✅ accessible · ❌ entity doesn't exist · 🔒 blocked by AX permissions · ⚠️ unexpected`);
  console.log(`\nNext step: anything ✅ that holds customer payment data → use it in Phase 2 sync.`);
  console.log(`           anything 🔒 → Yosef needs to add the entity to the AX integration app permissions.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
