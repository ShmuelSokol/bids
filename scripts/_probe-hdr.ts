import "./env";
async function getToken() {
  const params = new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.AX_CLIENT_ID!, client_secret: process.env.AX_CLIENT_SECRET!, scope: `${process.env.AX_D365_URL}/.default` });
  const r = await fetch(`https://login.microsoftonline.com/${process.env.AX_TENANT_ID}/oauth2/v2.0/token`, { method: "POST", body: params });
  const d: any = await r.json(); return d.access_token as string;
}
(async () => {
  const token = await getToken();
  const url = `${process.env.AX_D365_URL}/data/PurchaseOrderHeadersV2?cross-company=true&$top=1&$filter=PurchaseOrderNumber eq 'PO002796'`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await r.text();
  console.log(body.slice(0, 3500));
})();
