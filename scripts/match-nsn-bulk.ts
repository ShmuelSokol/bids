/**
 * Bulk NSN matching: Match Master DB items (192K with mfr_part_number)
 * against Lam Links k08_tab (365K items with NSNs) and D365 barcodes (25K NSNs).
 * Validates by comparing descriptions. Writes NSNs back to Master DB.
 *
 * Strategy:
 * 1. Load Lam Links part→NSN lookup (from k08_tab)
 * 2. Load D365 barcode→NSN lookup
 * 3. Paginate through ALL Master DB items
 * 4. For each item with mfr_part_number, try matching against both lookups
 * 5. Score description similarity to filter false positives
 * 6. Write confirmed NSNs back via POST /api/dibs/nsn
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const API = "https://masterdb.everreadygroup.com/api/dibs/items";
const KEY = process.env.MASTERDB_API_KEY!;
const OUTPUT_DIR = join(__dirname, "..", "data", "nsn-matching");

// Simple word-overlap similarity
function descSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.min(wordsA.size, wordsB.size);
}

async function fetchMasterDbPage(page: number): Promise<any> {
  // Search with a single character to get broad results, paginate through
  // Actually we need to iterate through prefixes to cover everything
  const resp = await fetch(`${API}?sku=&limit=500&page=${page}`, {
    headers: { "X-Api-Key": KEY },
  });
  if (!resp.ok) return { results: [], count: 0 };
  return resp.json();
}

async function searchMasterDb(query: string, param: string = "sku"): Promise<any[]> {
  const resp = await fetch(`${API}?${param}=${encodeURIComponent(query)}&limit=500`, {
    headers: { "X-Api-Key": KEY },
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.results || [];
}

async function writeNsnBack(updates: { item_id: number; nsn: string }[]): Promise<number> {
  if (updates.length === 0) return 0;
  const resp = await fetch(`${API.replace("/items", "/nsn")}`, {
    method: "POST",
    headers: {
      "X-Api-Key": KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ updates }),
  });
  if (!resp.ok) {
    console.error("  Write-back failed:", await resp.text());
    return 0;
  }
  const data = await resp.json();
  return data.updated || 0;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const startTime = Date.now();

  // Step 1: Build Lam Links part→NSN lookup
  console.log("Loading Lam Links item master...");
  const llItems = JSON.parse(
    readFileSync(join(__dirname, "..", "data", "llk-discovery", "item-master.json"), "utf-8")
  );

  const llLookup: Map<string, { nsn: string; desc: string }> = new Map();
  for (const item of llItems) {
    const partno = (item.partno_k08 || "").trim().toUpperCase();
    const fsc = (item.fsc_k08 || "").trim();
    const niin = (item.niin_k08 || "").trim();
    const desc = (item.description || item.p_desc_k08 || "").trim();
    if (partno && fsc && niin) {
      llLookup.set(partno, { nsn: `${fsc}-${niin}`, desc });
    }
  }
  console.log(`  ${llLookup.size.toLocaleString()} part→NSN mappings loaded from Lam Links\n`);

  // Step 2: Build D365 barcode→NSN lookup
  console.log("Loading D365 barcodes...");
  let d365Lookup: Map<string, { nsn: string; desc: string }> = new Map();
  try {
    const barcodes = JSON.parse(
      readFileSync(join(__dirname, "..", "data", "d365", "barcodes.json"), "utf-8")
    );
    // Build item→NSN from NSN barcodes
    const nsnBarcodes = barcodes.filter((b: any) => b.BarcodeSetupId === "NSN");
    for (const b of nsnBarcodes) {
      const itemNum = (b.ItemNumber || "").trim().toUpperCase();
      const raw = b.Barcode || "";
      if (itemNum && raw.length === 13) {
        const nsn = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 9)}-${raw.slice(9)}`;
        d365Lookup.set(itemNum, { nsn, desc: (b.ProductDescription || "").trim() });
      }
    }
    console.log(`  ${d365Lookup.size.toLocaleString()} item→NSN mappings loaded from D365\n`);
  } catch {
    console.log("  D365 barcodes not found, skipping\n");
  }

  // Step 3: Paginate through Master DB items by searching with common prefixes
  console.log("Scanning Master DB items...");

  // Search using alphabet + numbers to cover all items
  const prefixes = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
  const allMatches: any[] = [];
  const noMatches: any[] = [];
  let totalScanned = 0;
  let totalWithMfr = 0;
  const seenIds = new Set<number>();

  for (const prefix of prefixes) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await fetch(`${API}?sku=${prefix}&limit=500&page=${page}`, {
        headers: { "X-Api-Key": KEY },
      }).then((r) => r.json()).catch(() => ({ results: [], count: 0 }));

      const items = data.results || [];
      if (items.length === 0) break;

      for (const item of items) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        totalScanned++;

        const mfr = (item.mfr_part_number || "").trim();
        if (!mfr) continue;
        totalWithMfr++;

        // Already has NSN? Skip
        if (item.nsn) continue;

        const mfrUpper = mfr.toUpperCase();
        const mdbDesc = item.description || "";

        // Try Lam Links match
        let match = llLookup.get(mfrUpper);

        // Try without common suffixes/prefixes
        if (!match) {
          // Try removing trailing revision letters
          const stripped = mfrUpper.replace(/[-\s]?REV\s*[A-Z]$/i, "").replace(/[-\s]+$/, "");
          match = llLookup.get(stripped);
        }

        // Try D365 match (by item number which might match mfr part#)
        if (!match) {
          match = d365Lookup.get(mfrUpper);
        }

        if (match) {
          const sim = descSimilarity(mdbDesc, match.desc);
          const result = {
            item_id: item.id,
            mdb_sku: item.sku,
            mdb_mfr: mfr,
            mdb_desc: mdbDesc,
            matched_nsn: match.nsn,
            matched_desc: match.desc,
            similarity: sim,
            confident: sim >= 0.15 || mdbDesc.length < 10 || match.desc.length < 10,
          };

          if (result.confident) {
            allMatches.push(result);
          } else {
            noMatches.push(result);
          }
        }
      }

      // Check if there are more pages
      hasMore = items.length === 500;
      page++;

      // Rate limit
      await new Promise((r) => setTimeout(r, 50));
    }

    if (totalScanned % 5000 < 500) {
      console.log(
        `  Scanned ${totalScanned.toLocaleString()} (${totalWithMfr.toLocaleString()} with mfr#), ${allMatches.length} matches so far...`
      );
    }
  }

  console.log(`\n=== MATCHING RESULTS ===`);
  console.log(`Total items scanned: ${totalScanned.toLocaleString()}`);
  console.log(`Items with mfr_part_number: ${totalWithMfr.toLocaleString()}`);
  console.log(`Confident matches: ${allMatches.length}`);
  console.log(`Low-confidence (rejected): ${noMatches.length}`);

  // Save results
  writeFileSync(join(OUTPUT_DIR, "confirmed-matches.json"), JSON.stringify(allMatches, null, 2));
  writeFileSync(join(OUTPUT_DIR, "rejected-matches.json"), JSON.stringify(noMatches, null, 2));

  // Show samples
  console.log("\nSample confirmed matches:");
  allMatches.slice(0, 10).forEach((m) => {
    console.log(
      `  ${m.mdb_mfr} → NSN ${m.matched_nsn} (sim=${m.similarity.toFixed(2)})`
    );
    console.log(`    MDB: "${m.mdb_desc}"`);
    console.log(`    LLK: "${m.matched_desc}"`);
  });

  console.log("\nSample rejected (low similarity):");
  noMatches.slice(0, 5).forEach((m) => {
    console.log(
      `  ${m.mdb_mfr} → NSN ${m.matched_nsn} (sim=${m.similarity.toFixed(2)}) REJECTED`
    );
    console.log(`    MDB: "${m.mdb_desc}"`);
    console.log(`    LLK: "${m.matched_desc}"`);
  });

  // Step 4: Write confirmed NSNs back to Master DB
  if (allMatches.length > 0) {
    console.log(`\nWriting ${allMatches.length} NSNs back to Master DB...`);
    let totalWritten = 0;

    for (let i = 0; i < allMatches.length; i += 50) {
      const batch = allMatches.slice(i, i + 50).map((m) => ({
        item_id: m.item_id,
        nsn: m.matched_nsn,
      }));
      const written = await writeNsnBack(batch);
      totalWritten += written;

      if ((i + 50) % 500 === 0 || i + 50 >= allMatches.length) {
        console.log(`  Written ${totalWritten}/${allMatches.length}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log(`\nTotal NSNs written to Master DB: ${totalWritten}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nDone in ${elapsed} minutes.`);
}

main().catch(console.error);
