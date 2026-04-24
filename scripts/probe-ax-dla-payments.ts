/**
 * Pull recent customer payments where the customer is DLA (OrderAccount=DD219)
 * to see what MarkedInvoice numbers look like — and whether they match
 * LL's kad_tab.cinnum_kad format.
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
  return (await resp.json()).access_token;
}

async function main() {
  const token = await getToken();

  // Try filtering CustTransactions for DLA's customer account directly.
  // OrderAccount='DD219' per memory.
  console.log("=== Recent DLA settlements (CustTransactions where OrderAccount='DD219') ===\n");
  const ctUrl = `${D365_URL}/data/CustTransactions?$top=10&$filter=OrderAccount eq 'DD219'&$orderby=TransDate desc&$select=OrderAccount,TransDate,Voucher,SettleAmountCur,LastSettleDate,LastSettleAccountNum,Invoice,DocumentNumber,InvoiceDate,Receipt`;
  const ctR = await fetch(ctUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (ctR.ok) {
    const data: any = await ctR.json();
    console.log(`got ${data.value?.length} rows`);
    for (const r of data.value || []) {
      console.log(JSON.stringify(r, null, 2).slice(0, 500));
      console.log("---");
    }
  } else {
    console.log(`HTTP ${ctR.status}: ${(await ctR.text()).slice(0, 200)}`);
    // Try with all fields if select fails
    const ctR2 = await fetch(`${D365_URL}/data/CustTransactions?$top=2&$filter=OrderAccount eq 'DD219'&$orderby=TransDate desc`, { headers: { Authorization: `Bearer ${token}` } });
    if (ctR2.ok) {
      const data: any = await ctR2.json();
      for (const r of data.value || []) {
        console.log(JSON.stringify(r, null, 2).slice(0, 800));
        console.log("---");
      }
    }
  }

  console.log("\n=== Recent payments (CustomerPaymentJournalLines where CustomerName looks like DLA) ===\n");
  const pjUrl = `${D365_URL}/data/CustomerPaymentJournalLines?$top=10&$orderby=TransactionDate desc&$select=AccountDisplayValue,CustomerName,TransactionDate,CreditAmount,MarkedInvoice,MarkedInvoiceCompany,PaymentReference,TransactionText`;
  const pjR = await fetch(pjUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (pjR.ok) {
    const data: any = await pjR.json();
    for (const r of data.value || []) {
      console.log(`  ${r.TransactionDate?.slice(0, 10)}  ${String(r.AccountDisplayValue).padEnd(8)}  ${String(r.CustomerName || "").padEnd(40)}  inv=${r.MarkedInvoice || "—"}  $${r.CreditAmount}  ref=${r.PaymentReference || "—"}`);
    }
  } else {
    console.log(`HTTP ${pjR.status}: ${(await pjR.text()).slice(0, 200)}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
