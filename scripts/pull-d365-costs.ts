/**
 * Pull purchase order data from D365 to get actual product costs.
 * The InventItemPricesV3 entity is mostly empty, but PO lines have real prices.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

import "dotenv/config";

const TENANT_ID = process.env.AX_TENANT_ID!;
const CLIENT_ID = process.env.AX_CLIENT_ID!;
const CLIENT_SECRET = process.env.AX_CLIENT_SECRET!;
const D365_URL = process.env.AX_D365_URL!;
const OUTPUT_DIR = join(__dirname, "..", "data", "d365");

async function getToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: `${D365_URL}/.default`,
  });
  const resp = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    { method: "POST", body: params }
  );
  const data = await resp.json();
  if (!data.access_token) throw new Error("Auth failed: " + data.error_description);
  return data.access_token;
}

async function fetchAllPages(token: string, url: string): Promise<any[]> {
  const all: any[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    console.log(`  Fetching... (${all.length.toLocaleString()} so far)`);
    const resp = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error(`  Error ${resp.status}: ${text.substring(0, 200)}`);
      break;
    }
    const data = await resp.json();
    all.push(...(data.value || []));
    nextUrl = data["@odata.nextLink"] || null;
    await new Promise((r) => setTimeout(r, 100));
  }
  return all;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("Authenticating...");
  const token = await getToken();

  // Pull recent PO lines (last 12 months) with costs
  console.log("\nPulling PurchaseOrderLinesV2 (purchase costs)...");
  const poLines = await fetchAllPages(
    token,
    `${D365_URL}/data/PurchaseOrderLinesV2?cross-company=true&$select=ItemNumber,PurchasePrice,PurchaseUnitSymbol,OrderedPurchaseQuantity,LineAmount,LineDescription,Barcode,BarCodeSetupId,ExternalItemNumber,PurchaseOrderNumber,RequestedDeliveryDate,PurchaseOrderLineStatus&$orderby=RequestedDeliveryDate desc`
  );
  writeFileSync(join(OUTPUT_DIR, "po-lines.json"), JSON.stringify(poLines, null, 2));
  console.log(`  ${poLines.length.toLocaleString()} PO lines saved`);

  // Also try PurchasePriceAgreements for standing vendor prices
  console.log("\nPulling PurchasePriceAgreements (vendor price lists)...");
  const priceAgreements = await fetchAllPages(
    token,
    `${D365_URL}/data/PurchasePriceAgreements?cross-company=true&$select=ItemNumber,Price,PriceCurrencyCode,VendorAccountNumber,QuantityUnitSymbol,FromQuantity,ToQuantity,PriceApplicableFromDate`
  );
  writeFileSync(join(OUTPUT_DIR, "purchase-price-agreements.json"), JSON.stringify(priceAgreements, null, 2));
  console.log(`  ${priceAgreements.length.toLocaleString()} price agreements saved`);

  // Summary
  console.log("\n=== COST DATA SUMMARY ===");
  console.log(`PO Lines: ${poLines.length.toLocaleString()}`);
  console.log(`Price Agreements: ${priceAgreements.length.toLocaleString()}`);

  // NSN items in PO lines
  const nsnPOs = poLines.filter((p: any) => p.BarCodeSetupId === "NSN" && p.Barcode);
  console.log(`\nPO lines with NSN barcode: ${nsnPOs.length.toLocaleString()}`);

  // Unique items with cost
  const itemCosts: Record<string, number[]> = {};
  poLines.forEach((p: any) => {
    if (p.PurchasePrice > 0) {
      if (!itemCosts[p.ItemNumber]) itemCosts[p.ItemNumber] = [];
      itemCosts[p.ItemNumber].push(p.PurchasePrice);
    }
  });
  console.log(`Unique items with purchase price: ${Object.keys(itemCosts).length.toLocaleString()}`);

  // Sample
  console.log("\nSample PO lines with NSN:");
  nsnPOs.slice(0, 5).forEach((p: any) => {
    const nsn = p.Barcode;
    const formatted = nsn.length === 13 ? nsn.slice(0,4)+'-'+nsn.slice(4,6)+'-'+nsn.slice(6,9)+'-'+nsn.slice(9) : nsn;
    console.log(`  ${p.ItemNumber} | NSN ${formatted} | $${p.PurchasePrice} | ${p.LineDescription} | PO ${p.PurchaseOrderNumber}`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
