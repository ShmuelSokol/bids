/**
 * Fast NSN matching — search Master DB for LamLinks part numbers.
 * Instead of paginating through 192K Master DB items,
 * take the 262K LamLinks part→NSN mappings and search Master DB for each.
 * Writes matches back immediately in batches.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const API = "https://masterdb.everreadygroup.com/api/dibs/items";
const NSN_API = "https://masterdb.everreadygroup.com/api/dibs/nsn";
const KEY = process.env.MASTERDB_API_KEY!;
const OUTPUT_DIR = join(__dirname, "..", "data", "nsn-matching");

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

async function searchMdb(partno: string): Promise<any[]> {
  const resp = await fetch(`${API}?sku=${encodeURIComponent(partno)}&limit=10`, {
    headers: { "X-Api-Key": KEY },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!resp || !resp.ok) return [];
  const data = await resp.json();
  return (data.results || []).filter((r: any) => !r.nsn); // only items without NSN
}

async function writeNsns(updates: { item_id: number; nsn: string }[]): Promise<number> {
  if (updates.length === 0) return 0;
  const resp = await fetch(NSN_API, {
    method: "POST",
    headers: { "X-Api-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!resp || !resp.ok) return 0;
  const data = await resp.json();
  return data.updated || 0;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const startTime = Date.now();

  // Load LamLinks part→NSN
  console.log("Loading LamLinks part→NSN mappings...");
  const llItems = JSON.parse(
    readFileSync(join(__dirname, "..", "data", "llk-discovery", "item-master.json"), "utf-8")
  );

  // Deduplicate and filter to good part numbers (5+ chars, not all numeric short)
  const partMap = new Map<string, { nsn: string; desc: string }>();
  for (const item of llItems) {
    const partno = (item.partno_k08 || "").trim();
    const fsc = (item.fsc_k08 || "").trim();
    const niin = (item.niin_k08 || "").trim();
    const desc = (item.description || "").trim();
    if (partno.length >= 5 && fsc && niin) {
      partMap.set(partno, { nsn: `${fsc}-${niin}`, desc });
    }
  }
  console.log(`  ${partMap.size.toLocaleString()} unique part numbers to search\n`);

  const confirmed: any[] = [];
  const rejected: any[] = [];
  let searched = 0;
  let totalWritten = 0;
  const pendingWrites: { item_id: number; nsn: string }[] = [];

  for (const [partno, llData] of partMap) {
    searched++;

    // Search Master DB for this part number
    const mdbItems = await searchMdb(partno);

    for (const mdbItem of mdbItems) {
      // Check if mfr_part_number matches (not just sku substring)
      const mfr = (mdbItem.mfr_part_number || "").trim();
      const skuMatch = mfr.toUpperCase() === partno.toUpperCase() ||
                       mfr.toUpperCase().includes(partno.toUpperCase()) ||
                       partno.toUpperCase().includes(mfr.toUpperCase());

      if (!skuMatch && !mdbItem.sku.toUpperCase().includes(partno.toUpperCase())) continue;

      const sim = descSimilarity(mdbItem.description || "", llData.desc);
      const result = {
        item_id: mdbItem.id,
        sku: mdbItem.sku,
        upc: mdbItem.upc,
        mfr_part_number: mfr,
        mdb_desc: mdbItem.description || "",
        searched_part: partno,
        matched_nsn: llData.nsn,
        matched_desc: llData.desc,
        similarity: sim,
      };

      if (sim >= 0.12) {
        confirmed.push(result);
        pendingWrites.push({ item_id: mdbItem.id, nsn: llData.nsn });
      } else {
        rejected.push(result);
      }
    }

    // Write back in batches of 50
    if (pendingWrites.length >= 50) {
      const batch = pendingWrites.splice(0, 50);
      const written = await writeNsns(batch);
      totalWritten += written;
    }

    // Progress every 1000 searches
    if (searched % 1000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(
        `  ${searched.toLocaleString()}/${partMap.size.toLocaleString()} searched | ${confirmed.length} matches | ${totalWritten} written | ${elapsed}s`
      );
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 30));
  }

  // Flush remaining writes
  if (pendingWrites.length > 0) {
    const written = await writeNsns(pendingWrites);
    totalWritten += written;
  }

  // Save results
  writeFileSync(join(OUTPUT_DIR, "fast-confirmed.json"), JSON.stringify(confirmed, null, 2));
  writeFileSync(join(OUTPUT_DIR, "fast-rejected.json"), JSON.stringify(rejected, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log(`\n=== RESULTS ===`);
  console.log(`Part numbers searched: ${searched.toLocaleString()}`);
  console.log(`Confirmed matches: ${confirmed.length}`);
  console.log(`Rejected (low similarity): ${rejected.length}`);
  console.log(`NSNs written to Master DB: ${totalWritten}`);
  console.log(`Time: ${elapsed} minutes`);

  console.log("\nSample confirmed:");
  confirmed.slice(0, 10).forEach((m) => {
    console.log(`  ${m.searched_part} → NSN ${m.matched_nsn} (sim=${m.similarity.toFixed(2)})`);
    console.log(`    MDB: "${m.mdb_desc.substring(0, 60)}"`);
    console.log(`    LLK: "${m.matched_desc.substring(0, 60)}"`);
  });
}

main().catch(console.error);
