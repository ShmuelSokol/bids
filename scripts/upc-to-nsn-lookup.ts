/**
 * Look up NSNs for Master DB items by searching govcagecodes.com
 * with manufacturer part numbers extracted from SKUs.
 *
 * Strategy:
 * 1. Get Master DB items (starting with safety/medical/cleaning categories)
 * 2. For each, extract likely manufacturer part number from SKU
 * 3. Search govcagecodes.com for NSN matches
 * 4. Report matches and optionally write NSNs back to Master DB
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const API = "https://masterdb.everreadygroup.com/api/dibs/items";
const KEY = process.env.MASTERDB_API_KEY!;
const NSN_SEARCH = "https://www.govcagecodes.com/nsn_search.php";
const OUTPUT_DIR = join(__dirname, "..", "data", "nsn-matching");

// Known 3-letter supplier prefixes in Master DB SKUs
const SUPPLIER_PREFIXES = [
  "MMM", "CRW", "GHE", "QRT", "NUD", "SAF", "TNN", "MPG",
  "SCN", "BOS", "SWI", "HON", "ALE", "FEL", "UNV", "AVE",
  "DEF", "PAC", "IVR", "SAN", "DXE", "BWK", "RCP",
];

function extractPartNumber(sku: string): string[] {
  const clean = sku.replace(/-BULK$/, "").trim();
  const candidates: string[] = [];

  // Try removing known supplier prefixes
  for (const prefix of SUPPLIER_PREFIXES) {
    if (clean.startsWith(prefix) && clean.length > prefix.length + 3) {
      candidates.push(clean.slice(prefix.length));
    }
  }

  // If SKU is long enough and alphanumeric, try it as-is
  if (clean.length >= 6) {
    candidates.push(clean);
  }

  return candidates.filter((c) => c.length >= 5);
}

async function searchNsn(partNumber: string): Promise<{ nsn: string; name: string } | null> {
  const resp = await fetch(`${NSN_SEARCH}?part=${encodeURIComponent(partNumber)}`);
  if (!resp.ok) return null;

  const html = await resp.text();
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return null;

  const cells = tbodyMatch[1].match(/<td class='col-sm-3'>([^<]+)<\/td>/g);
  if (!cells || cells.length < 3) return null;

  const extract = (s: string) => s.replace(/<td class='col-sm-3'>/, "").replace(/<\/td>/, "");
  const nsn = extract(cells[0]);
  const name = extract(cells[2]);

  // Validate it's a real NSN (13 digits)
  if (!/^\d{13}$/.test(nsn)) return null;

  // Format as FSC-NIIN
  const formatted = `${nsn.slice(0, 4)}-${nsn.slice(4, 6)}-${nsn.slice(6, 9)}-${nsn.slice(9, 13)}`;
  return { nsn: formatted, name };
}

async function getMasterDbItems(query: string): Promise<any[]> {
  const resp = await fetch(`${API}?sku=${encodeURIComponent(query)}&limit=500`, {
    headers: { "X-Api-Key": KEY },
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.results || [];
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Get items from categories likely to have NSNs
  const prefixes = ["CRW", "MMM", "BWK", "RCP", "DXE", "SAN", "HON"];
  let allItems: any[] = [];

  console.log("Fetching Master DB items...");
  for (const prefix of prefixes) {
    const items = await getMasterDbItems(prefix);
    allItems.push(...items);
    console.log(`  ${prefix}: ${items.length} items`);
    await new Promise((r) => setTimeout(r, 100));
  }

  // Deduplicate
  const seen = new Set<number>();
  allItems = allItems.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  console.log(`\nTotal unique items to check: ${allItems.length}`);
  console.log("Searching NSN database...\n");

  const matches: any[] = [];
  let checked = 0;

  for (const item of allItems) {
    const candidates = extractPartNumber(item.sku);
    checked++;

    for (const partNo of candidates) {
      const result = await searchNsn(partNo);
      if (result) {
        // Verify it's plausible (description similarity)
        const itemDesc = (item.description || "").toLowerCase();
        const nsnName = (result.name || "").toLowerCase();

        matches.push({
          mdb_id: item.id,
          mdb_sku: item.sku,
          mdb_upc: item.upc,
          mdb_desc: item.description,
          mdb_cost: item.cost,
          searched_part: partNo,
          nsn: result.nsn,
          nsn_name: result.name,
        });

        console.log(
          `FOUND: ${item.sku} → NSN ${result.nsn} (${result.name})`
        );
        break; // Take first match per item
      }

      // Rate limit govcagecodes
      await new Promise((r) => setTimeout(r, 300));
    }

    if (checked % 25 === 0) {
      console.log(`  ...checked ${checked}/${allItems.length}, ${matches.length} matches`);
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Items checked: ${checked}`);
  console.log(`NSN matches found: ${matches.length}`);

  writeFileSync(
    join(OUTPUT_DIR, "upc-nsn-matches.json"),
    JSON.stringify(matches, null, 2)
  );
  console.log(`Saved to data/nsn-matching/upc-nsn-matches.json`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
