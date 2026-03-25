/**
 * Reverse match: Take Lam Links items with known NSNs,
 * search Master DB for their part numbers.
 * If found, we can write the NSN back to Master DB.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const API = "https://masterdb.everreadygroup.com/api/dibs/items";
const KEY = "dDOUwJxbhLLVQ_40H8OWRtwwER6QoFmayDiTHcQrDW8";
const OUTPUT_DIR = join(__dirname, "..", "data", "nsn-matching");

interface LlkItem {
  partno: string;
  cage: string;
  nsn: string;
  fsc: string;
  descr: string;
}

async function searchMasterDb(sku: string): Promise<any[]> {
  const resp = await fetch(`${API}?sku=${encodeURIComponent(sku)}&limit=10`, {
    headers: { "X-Api-Key": KEY },
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.results || [];
}

// Simple description similarity check
function descSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(w => w.length > 2));
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.max(wordsA.size, 1);
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const items: LlkItem[] = JSON.parse(
    readFileSync(join(__dirname, "..", "data", "llk-discovery", "nsn-partnos-for-matching.json"), "utf-8")
  );

  console.log(`Searching Master DB for ${items.length} Lam Links part numbers...\n`);

  const matches: any[] = [];
  const falsePositives: any[] = [];
  let checked = 0;

  for (const item of items) {
    checked++;
    const partno = item.partno.trim();

    // Only search if part number is specific enough
    if (partno.length < 6) continue;

    const results = await searchMasterDb(partno);

    if (results.length > 0) {
      // Check description similarity to filter false positives
      const best = results[0];
      const sim = descSimilarity(item.descr, best.description);

      const match = {
        llk_partno: partno,
        llk_nsn: item.nsn,
        llk_fsc: item.fsc,
        llk_desc: item.descr,
        mdb_id: best.id,
        mdb_sku: best.sku,
        mdb_upc: best.upc,
        mdb_desc: best.description,
        mdb_cost: best.cost,
        desc_similarity: sim,
      };

      if (sim >= 0.15 || best.sku.includes(partno)) {
        matches.push(match);
        console.log(
          `MATCH (sim=${sim.toFixed(2)}): ${partno} [${item.descr}] → ${best.sku} [${best.description}] | NSN: ${item.nsn} | UPC: ${best.upc}`
        );
      } else {
        falsePositives.push(match);
      }
    }

    if (checked % 50 === 0) {
      console.log(`  ...checked ${checked}/${items.length}, ${matches.length} matches, ${falsePositives.length} rejected`);
    }

    await new Promise((r) => setTimeout(r, 80));
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Items checked: ${checked}`);
  console.log(`Confirmed matches: ${matches.length}`);
  console.log(`Rejected (false positives): ${falsePositives.length}`);

  writeFileSync(join(OUTPUT_DIR, "reverse-matches.json"), JSON.stringify(matches, null, 2));
  writeFileSync(join(OUTPUT_DIR, "reverse-rejected.json"), JSON.stringify(falsePositives, null, 2));
  console.log(`Saved to data/nsn-matching/`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
