/**
 * Try matching Lam Links part numbers against Master DB items.
 * Tests multiple matching strategies:
 * 1. Direct SKU match (part number appears in Master DB SKU)
 * 2. Stripped SKU match (remove common prefixes/suffixes)
 * 3. Description keyword match
 */
import { readFileSync } from "fs";
import { join } from "path";

const API = "https://masterdb.everreadygroup.com/api/dibs/items";
const KEY = process.env.MASTERDB_API_KEY!;

interface LlkItem {
  partno: string;
  cage: string;
  fsc: string;
  niin: string;
  descr: string;
}

async function searchMasterDb(
  param: string,
  value: string
): Promise<any[]> {
  const url = `${API}?${param}=${encodeURIComponent(value)}&limit=10`;
  const resp = await fetch(url, { headers: { "X-Api-Key": KEY } });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.results || [];
}

async function main() {
  const items: LlkItem[] = JSON.parse(
    readFileSync(join(__dirname, "..", "data", "llk-discovery", "sample-partnos.json"), "utf-8")
  );

  console.log(`Testing ${items.length} Lam Links part numbers against Master DB...\n`);

  let matches = 0;
  let tested = 0;
  const matchedItems: any[] = [];

  for (const item of items.slice(0, 50)) {
    tested++;
    const partno = item.partno.trim();

    // Strategy 1: search by SKU using the part number
    const results = await searchMasterDb("sku", partno);

    if (results.length > 0) {
      matches++;
      console.log(
        `MATCH: ${partno} (NSN ${item.fsc}-${item.niin}) → ${results[0].sku} | ${results[0].description} | UPC: ${results[0].upc}`
      );
      matchedItems.push({
        llk_partno: partno,
        llk_nsn: `${item.fsc}-${item.niin}`,
        llk_desc: item.descr,
        mdb_sku: results[0].sku,
        mdb_upc: results[0].upc,
        mdb_desc: results[0].description,
        mdb_cost: results[0].cost,
      });
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Tested: ${tested}`);
  console.log(`Matches: ${matches} (${((matches / tested) * 100).toFixed(1)}%)`);

  if (matchedItems.length > 0) {
    console.log("\nMatched items:");
    matchedItems.forEach((m) => {
      console.log(`  NSN ${m.llk_nsn} | LL: ${m.llk_partno} → MDB: ${m.mdb_sku} | UPC: ${m.mdb_upc} | Cost: $${m.mdb_cost}`);
    });
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
