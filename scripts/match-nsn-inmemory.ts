/**
 * In-memory NSN matching — loads both datasets locally, matches in seconds.
 * 1. Master DB export (ndjson) — items with mfr_part_number, no NSN
 * 2. LamLinks item master (json) — 262K part→NSN mappings
 * 3. D365 barcodes (json) — 24K item→NSN mappings
 * 4. External: govcagecodes.com for remaining unmatched
 * 5. Write back via POST /api/dibs/nsn
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const NSN_API = "https://masterdb.everreadygroup.com/api/dibs/nsn";
const KEY = process.env.MASTERDB_API_KEY || "dDOUwJxbhLLVQ_40H8OWRtwwER6QoFmayDiTHcQrDW8";
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

async function writeNsns(updates: { item_id: number; nsn: string }[]): Promise<number> {
  if (updates.length === 0) return 0;
  const resp = await fetch(NSN_API, {
    method: "POST",
    headers: { "X-Api-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  }).catch(() => null);
  if (!resp || !resp.ok) {
    console.error("  Write failed:", await resp?.text().catch(() => ""));
    return 0;
  }
  const data = await resp.json();
  return data.updated || 0;
}

async function searchGovcagecodes(partno: string): Promise<{ nsn: string; name: string } | null> {
  try {
    const resp = await fetch(
      `https://www.govcagecodes.com/nsn_search.php?part=${encodeURIComponent(partno)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!resp.ok) return null;
    const html = await resp.text();
    const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
    if (!tbodyMatch) return null;
    const cells = tbodyMatch[1].match(/<td class='col-sm-3'>([^<]+)<\/td>/g);
    if (!cells || cells.length < 3) return null;
    const extract = (s: string) => s.replace(/<td class='col-sm-3'>/, "").replace(/<\/td>/, "");
    const rawNsn = extract(cells[0]);
    const name = extract(cells[2]);
    if (!/^\d{13}$/.test(rawNsn)) return null;
    const nsn = `${rawNsn.slice(0, 4)}-${rawNsn.slice(4, 6)}-${rawNsn.slice(6, 9)}-${rawNsn.slice(9)}`;
    return { nsn, name };
  } catch {
    return null;
  }
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const startTime = Date.now();

  // Step 1: Load LamLinks
  console.log("Loading LamLinks item master...");
  const llItems = JSON.parse(
    readFileSync(join(__dirname, "..", "data", "llk-discovery", "item-master.json"), "utf-8")
  );
  const llByPart = new Map<string, { nsn: string; desc: string }>();
  for (const item of llItems) {
    const p = (item.partno_k08 || "").trim().toUpperCase();
    const fsc = (item.fsc_k08 || "").trim();
    const niin = (item.niin_k08 || "").trim();
    const desc = (item.description || "").trim();
    if (p.length >= 3 && fsc && niin) {
      llByPart.set(p, { nsn: `${fsc}-${niin}`, desc });
    }
  }
  console.log(`  ${llByPart.size.toLocaleString()} part→NSN\n`);

  // Step 2: Load D365
  console.log("Loading D365 NSN barcodes...");
  const d365ByItem = new Map<string, { nsn: string; desc: string }>();
  try {
    const barcodes = JSON.parse(
      readFileSync(join(__dirname, "..", "data", "d365", "barcodes.json"), "utf-8")
    );
    for (const b of barcodes) {
      if (b.BarcodeSetupId !== "NSN") continue;
      const item = (b.ItemNumber || "").trim().toUpperCase();
      const raw = b.Barcode || "";
      if (item && raw.length === 13) {
        const nsn = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 9)}-${raw.slice(9)}`;
        d365ByItem.set(item, { nsn, desc: (b.ProductDescription || "").trim() });
      }
    }
  } catch {}
  console.log(`  ${d365ByItem.size.toLocaleString()} item→NSN\n`);

  // Step 3: Load Master DB export
  console.log("Loading Master DB export...");
  const lines = readFileSync(join(__dirname, "..", "data", "masterdb-mfr-export.ndjson"), "utf-8")
    .split("\n")
    .filter((l) => l.trim());

  const mdbItems: any[] = [];
  for (const line of lines) {
    try {
      const item = JSON.parse(line);
      if (item.mfr_part_number && !item.nsn) mdbItems.push(item);
    } catch {}
  }
  console.log(`  ${mdbItems.length.toLocaleString()} items need NSN\n`);

  // Step 4: Match internally
  console.log("=== INTERNAL MATCHING ===");
  const confirmed: any[] = [];
  const rejected: any[] = [];
  const unmatched: any[] = [];

  for (const item of mdbItems) {
    const mfr = (item.mfr_part_number || "").trim().toUpperCase();
    const mdbDesc = item.description || "";

    // Try LamLinks — exact, then stripped
    let match = llByPart.get(mfr);
    if (!match) match = llByPart.get(mfr.replace(/[-\s]/g, ""));
    if (!match) match = llByPart.get(mfr.replace(/^0+/, ""));

    // Try D365
    if (!match) match = d365ByItem.get(mfr);

    if (match) {
      const sim = descSimilarity(mdbDesc, match.desc);
      const result = {
        item_id: item.id,
        upc: item.upc,
        sku: item.sku,
        mfr_part_number: item.mfr_part_number,
        mdb_desc: mdbDesc,
        matched_nsn: match.nsn,
        matched_desc: match.desc,
        similarity: sim,
        source: "internal",
      };

      if (sim >= 0.12) {
        confirmed.push(result);
      } else {
        rejected.push(result);
      }
    } else {
      unmatched.push(item);
    }
  }

  console.log(`Confirmed: ${confirmed.length}`);
  console.log(`Rejected (low similarity): ${rejected.length}`);
  console.log(`Unmatched (need external): ${unmatched.length}`);
  const internalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Internal matching took: ${internalTime}s\n`);

  // Step 5: External lookup for unmatched (only items with part# >= 5 chars)
  const extCandidates = unmatched.filter(
    (item) => (item.mfr_part_number || "").trim().length >= 5
  );
  console.log(`=== EXTERNAL LOOKUP (govcagecodes.com) ===`);
  console.log(`${extCandidates.length} candidates\n`);

  let extFound = 0;
  let extChecked = 0;

  for (const item of extCandidates) {
    const mfr = (item.mfr_part_number || "").trim();
    extChecked++;

    const result = await searchGovcagecodes(mfr);
    if (result) {
      const sim = descSimilarity(item.description || "", result.name);
      const match = {
        item_id: item.id,
        upc: item.upc,
        sku: item.sku,
        mfr_part_number: mfr,
        mdb_desc: item.description || "",
        matched_nsn: result.nsn,
        matched_desc: result.name,
        similarity: sim,
        source: "govcagecodes",
      };

      if (sim >= 0.12) {
        confirmed.push(match);
        extFound++;
        if (extFound <= 20) {
          console.log(`  FOUND: ${mfr} → NSN ${result.nsn} (sim=${sim.toFixed(2)})`);
          console.log(`    MDB: "${(item.description || "").substring(0, 50)}"`);
          console.log(`    GOV: "${result.name.substring(0, 50)}"`);
        }
      } else if (sim > 0) {
        rejected.push(match);
      }
    }

    if (extChecked % 200 === 0) {
      console.log(`  ...${extChecked}/${extCandidates.length} checked, ${extFound} found`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nExternal: checked ${extChecked}, found ${extFound}\n`);

  // Step 6: Save results
  writeFileSync(join(OUTPUT_DIR, "confirmed-all.json"), JSON.stringify(confirmed, null, 2));
  writeFileSync(join(OUTPUT_DIR, "rejected-all.json"), JSON.stringify(rejected, null, 2));

  console.log("=== TOTAL RESULTS ===");
  console.log(`Confirmed: ${confirmed.length}`);
  console.log(`Rejected: ${rejected.length}`);

  console.log("\nSample confirmed:");
  confirmed.slice(0, 15).forEach((m) => {
    const src = m.source === "govcagecodes" ? "[EXT]" : "[INT]";
    console.log(`  ${src} ${m.mfr_part_number} → NSN ${m.matched_nsn} (sim=${m.similarity.toFixed(2)})`);
    console.log(`    MDB: "${m.mdb_desc.substring(0, 55)}"`);
    console.log(`    Match: "${m.matched_desc.substring(0, 55)}"`);
  });

  // Step 7: Write back
  if (confirmed.length > 0) {
    console.log(`\nWriting ${confirmed.length} NSNs to Master DB...`);
    let totalWritten = 0;

    for (let i = 0; i < confirmed.length; i += 50) {
      const batch = confirmed.slice(i, i + 50).map((m) => ({
        item_id: m.item_id,
        nsn: m.matched_nsn,
      }));
      const written = await writeNsns(batch);
      totalWritten += written;
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log(`Written: ${totalWritten}`);
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nDone in ${totalTime} minutes.`);
}

main().catch(console.error);
