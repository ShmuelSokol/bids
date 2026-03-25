/**
 * Pull vendor part numbers from D365 (VendorProductDescriptionsV2),
 * cross-reference with NSN barcodes, then match to Master DB.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const TENANT_ID = process.env.AX_TENANT_ID!;
const CLIENT_ID = process.env.AX_CLIENT_ID!;
const CLIENT_SECRET = process.env.AX_CLIENT_SECRET!;
const D365_URL = process.env.AX_D365_URL!;
const OUTPUT_DIR = join(__dirname, "..", "data", "d365");
const MDB_KEY = process.env.MASTERDB_API_KEY || "dDOUwJxbhLLVQ_40H8OWRtwwER6QoFmayDiTHcQrDW8";

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
    const resp = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) { console.error("  Error:", resp.status); break; }
    const data = await resp.json();
    all.push(...(data.value || []));
    nextUrl = data["@odata.nextLink"] || null;
    if (all.length % 10000 < 1000) console.log(`  ${all.length.toLocaleString()} rows...`);
    await new Promise((r) => setTimeout(r, 50));
  }
  return all;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("Authenticating...");
  const token = await getToken();

  // Pull vendor part numbers
  console.log("\nPulling VendorProductDescriptionsV2...");
  const vendorParts = await fetchAllPages(
    token,
    `${D365_URL}/data/VendorProductDescriptionsV2?cross-company=true&$select=ItemNumber,VendorAccountNumber,VendorProductNumber,VendorProductDescription`
  );
  writeFileSync(join(OUTPUT_DIR, "vendor-parts.json"), JSON.stringify(vendorParts, null, 2));
  console.log(`  ${vendorParts.length.toLocaleString()} vendor-item associations`);

  // Build ItemNumber → NSN lookup from barcodes
  console.log("\nLoading NSN barcodes...");
  const barcodes = JSON.parse(readFileSync(join(OUTPUT_DIR, "barcodes.json"), "utf-8"));
  const itemToNsn = new Map<string, string>();
  for (const b of barcodes) {
    if (b.BarcodeSetupId !== "NSN" || b.Barcode.length !== 13) continue;
    const raw = b.Barcode;
    itemToNsn.set(b.ItemNumber, `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 9)}-${raw.slice(9)}`);
  }
  console.log(`  ${itemToNsn.size.toLocaleString()} items with NSN`);

  // Build vendor part# → NSN mapping
  const vendorPartToNsn = new Map<string, { nsn: string; vendor: string; axItem: string }>();
  let withNsn = 0;
  for (const vp of vendorParts) {
    const vendorPart = (vp.VendorProductNumber || "").trim();
    const nsn = itemToNsn.get(vp.ItemNumber);
    if (vendorPart && nsn) {
      vendorPartToNsn.set(vendorPart.toUpperCase(), {
        nsn,
        vendor: vp.VendorAccountNumber,
        axItem: vp.ItemNumber,
      });
      withNsn++;
    }
  }
  console.log(`  ${withNsn.toLocaleString()} vendor parts with NSN`);
  console.log(`  ${vendorPartToNsn.size.toLocaleString()} unique vendor part→NSN mappings`);

  // Load Master DB export
  console.log("\nLoading Master DB export...");
  const mdbLines = readFileSync(join(__dirname, "..", "data", "masterdb-full-export.ndjson"), "utf-8")
    .split("\n")
    .filter((l) => l.trim());
  console.log(`  ${mdbLines.length.toLocaleString()} items`);

  // Match
  console.log("\nMatching...");
  const matches: any[] = [];

  for (const line of mdbLines) {
    let item: any;
    try { item = JSON.parse(line); } catch { continue; }
    if (item.nsn) continue;

    const sku = (item.sku || "").trim().toUpperCase();
    const mfr = (item.mfr_part_number || "").trim().toUpperCase();

    // Try sku, mfr, sku without -BULK, stripped prefixes
    const candidates = [sku, mfr, sku.replace(/-BULK$/, "")];

    for (const c of candidates) {
      if (!c || c.length < 3) continue;
      const match = vendorPartToNsn.get(c);
      if (match) {
        matches.push({
          item_id: item.id,
          upc: item.upc,
          sku: item.sku,
          mfr: item.mfr_part_number,
          mdb_desc: (item.description || "").substring(0, 60),
          nsn: match.nsn,
          vendor: match.vendor,
          ax_item: match.axItem,
        });
        break;
      }
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Matches: ${matches.length}`);

  console.log("\nSample:");
  matches.slice(0, 20).forEach((m) => {
    console.log(`  ${m.sku} (mfr: ${m.mfr || "n/a"}) → NSN ${m.nsn} | vendor: ${m.vendor} | AX: ${m.ax_item}`);
    console.log(`    "${m.mdb_desc}"`);
  });

  // Write back to Master DB
  if (matches.length > 0) {
    console.log(`\nWriting ${matches.length} NSNs to Master DB...`);
    let total = 0;
    for (let i = 0; i < matches.length; i += 100) {
      const batch = matches.slice(i, i + 100).map((m) => ({ item_id: m.item_id, nsn: m.nsn }));
      const resp = await fetch("https://masterdb.everreadygroup.com/api/dibs/nsn", {
        method: "POST",
        headers: { "X-Api-Key": MDB_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ updates: batch }),
      });
      if (resp.ok) {
        const d = await resp.json();
        total += d.updated || 0;
      }
    }
    console.log(`Written: ${total}`);
  }

  writeFileSync(join(__dirname, "..", "data", "nsn-matching", "ax-vendor-matches.json"), JSON.stringify(matches, null, 2));
  console.log("\nDone.");
}

main().catch(console.error);
