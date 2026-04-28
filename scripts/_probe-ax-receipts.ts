import "./env";
async function getToken() {
  const params = new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.AX_CLIENT_ID!, client_secret: process.env.AX_CLIENT_SECRET!, scope: `${process.env.AX_D365_URL}/.default` });
  const r = await fetch(`https://login.microsoftonline.com/${process.env.AX_TENANT_ID}/oauth2/v2.0/token`, { method: "POST", body: params });
  const d: any = await r.json(); return d.access_token as string;
}
(async () => {
  const item = "INTNL8505077";
  const token = await getToken();
  const url = `${process.env.AX_D365_URL}/data/PurchaseOrderLinesV2?cross-company=true&$top=50&$filter=ItemNumber eq '${item}'&$select=PurchaseOrderNumber,ItemNumber,OrderedPurchaseQuantity,PurchasePrice,LineNumber,PurchaseOrderLineStatus`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const j: any = await r.json();
  console.log("rows:", j.value?.length);
  for (const l of j.value || []) console.log(`  PO=${l.PurchaseOrderNumber} line=${l.LineNumber} status=${l.PurchaseOrderLineStatus} qty=${l.OrderedPurchaseQuantity} price=${l.PurchasePrice}`);

  const pos = [...new Set((j.value || []).map((l: any) => l.PurchaseOrderNumber))];
  console.log(`\nDistinct POs: ${pos.length}`);
  const hdrFilter = pos.slice(0, 20).map(p => `PurchaseOrderNumber eq '${p}'`).join(" or ");
  const hdrUrl = `${process.env.AX_D365_URL}/data/PurchaseOrderHeadersV2?cross-company=true&$filter=${encodeURIComponent(hdrFilter)}&$select=PurchaseOrderNumber,OrderVendorAccountNumber,OrderVendorName,CreatedDateTime,PurchaseOrderStatus,DocumentApprovalStatus`;
  const r2 = await fetch(hdrUrl, { headers: { Authorization: `Bearer ${token}` } });
  const j2: any = await r2.json();
  console.log("\nheaders:", j2.value?.length);
  for (const h of j2.value || []) console.log(`  ${h.PurchaseOrderNumber}  ${h.OrderVendorAccountNumber}  ${h.OrderVendorName}  status=${h.PurchaseOrderStatus}  ${h.CreatedDateTime}`);
})();
