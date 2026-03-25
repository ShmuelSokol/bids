/**
 * Pull product data from D365: barcodes (UPCs), item prices, and product catalog.
 * Saves to data/d365/
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

async function fetchAllPages(token: string, entity: string, select?: string): Promise<any[]> {
  const all: any[] = [];
  let url = `${D365_URL}/data/${entity}?cross-company=true&$count=true`;
  if (select) url += `&$select=${select}`;

  while (url) {
    console.log(`  Fetching page... (${all.length} so far)`);
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`D365 ${resp.status}: ${text.substring(0, 300)}`);
    }

    const data = await resp.json();
    const rows = data.value || [];
    all.push(...rows);

    // OData pagination
    url = data["@odata.nextLink"] || null;

    // Rate limit
    await new Promise((r) => setTimeout(r, 100));
  }

  return all;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("Authenticating with D365...");
  const token = await getToken();
  console.log("Authenticated!\n");

  // 1. Product Barcodes (UPCs)
  console.log("Pulling ProductBarcodesV3 (UPC mappings)...");
  const barcodes = await fetchAllPages(
    token,
    "ProductBarcodesV3",
    "ItemNumber,Barcode,BarcodeSetupId,ProductDescription,dataAreaId"
  );
  writeFileSync(join(OUTPUT_DIR, "barcodes.json"), JSON.stringify(barcodes, null, 2));
  console.log(`  ${barcodes.length.toLocaleString()} barcodes saved\n`);

  // 2. Item Prices / Costs
  console.log("Pulling InventItemPricesV3 (item costs)...");
  const prices = await fetchAllPages(
    token,
    "InventItemPricesV3",
    "ItemNumber,Price,PriceType,CostingVersionId,ProductUnitSymbol,PriceQuantity,IsActive,FromDate,dataAreaId"
  );
  writeFileSync(join(OUTPUT_DIR, "item-prices.json"), JSON.stringify(prices, null, 2));
  console.log(`  ${prices.length.toLocaleString()} price records saved\n`);

  // 3. All Products
  console.log("Pulling AllProducts (product catalog)...");
  const products = await fetchAllPages(
    token,
    "AllProducts",
    "ProductNumber,ProductName,ProductDescription,ProductSearchName"
  );
  writeFileSync(join(OUTPUT_DIR, "products.json"), JSON.stringify(products, null, 2));
  console.log(`  ${products.length.toLocaleString()} products saved\n`);

  // Summary
  console.log("=== D365 PULL SUMMARY ===");
  console.log(`Barcodes: ${barcodes.length.toLocaleString()}`);
  console.log(`Prices: ${prices.length.toLocaleString()}`);
  console.log(`Products: ${products.length.toLocaleString()}`);

  // Quick analysis
  const upcBarcodes = barcodes.filter((b: any) => b.BarcodeSetupId === "UPC");
  const uniqueItems = new Set(barcodes.map((b: any) => b.ItemNumber));
  const activePrices = prices.filter((p: any) => p.IsActive === "Yes" && p.Price > 0);

  console.log(`\nUPC barcodes: ${upcBarcodes.length.toLocaleString()}`);
  console.log(`Unique items with barcodes: ${uniqueItems.size.toLocaleString()}`);
  console.log(`Active prices > $0: ${activePrices.length.toLocaleString()}`);

  console.log("\nDone! All saved to data/d365/");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
