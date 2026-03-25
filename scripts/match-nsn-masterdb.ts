/**
 * Find NSNs for Master DB items that have mfr_part_number but no NSN.
 * Match against LamLinks k08_tab + D365 NSN barcodes.
 * Validate by comparing descriptions.
 * Write back to Master DB.
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

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const startTime = Date.now();

  // Step 1: Build LamLinks part→NSN lookup
  console.log("Loading LamLinks item master (273K items)...");
  const llItems = JSON.parse(
    readFileSync(join(__dirname, "..", "data", "llk-discovery", "item-master.json"), "utf-8")
  );
  const llByPart: Map<string, { nsn: string; desc: string }> = new Map();
  for (const item of llItems) {
    const partno = (item.partno_k08 || "").trim().toUpperCase();
    const fsc = (item.fsc_k08 || "").trim();
    const niin = (item.niin_k08 || "").trim();
    const desc = (item.description || "").trim();
    if (partno && partno.length >= 3 && fsc && niin) {
      llByPart.set(partno, { nsn: `${fsc}-${niin}`, desc });
    }
  }
  console.log(`  ${llByPart.size.toLocaleString()} part→NSN mappings\n`);

  // Step 2: Build D365 item→NSN lookup
  console.log("Loading D365 NSN barcodes (25K)...");
  const d365ByItem: Map<string, { nsn: string; desc: string }> = new Map();
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
  console.log(`  ${d365ByItem.size.toLocaleString()} item→NSN mappings\n`);

  // Step 3: Pull ALL Master DB items with mfr_part_number, page by page
  console.log("Pulling Master DB items...");
  const allItems: any[] = [];
  const prefixes = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
  const seenIds = new Set<number>();

  for (const prefix of prefixes) {
    let page = 1;
    while (true) {
      const resp = await fetch(`${API}?sku=${prefix}&limit=500&page=${page}`, {
        headers: { "X-Api-Key": KEY },
      });
      if (!resp.ok) break;
      const data = await resp.json();
      const items = data.results || [];
      if (items.length === 0) break;

      for (const item of items) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        // Only items WITH mfr_part_number and WITHOUT nsn
        if (item.mfr_part_number && !item.nsn) {
          allItems.push(item);
        }
      }

      if (items.length < 500) break;
      page++;
      await new Promise((r) => setTimeout(r, 30));
    }

    process.stdout.write(`\r  Scanned prefix ${prefix}: ${seenIds.size.toLocaleString()} total, ${allItems.length.toLocaleString()} need NSN`);
  }
  console.log(`\n  ${allItems.length.toLocaleString()} items need NSN lookup\n`);

  // Step 4: Match
  console.log("Matching...");
  const confirmed: any[] = [];
  const rejected: any[] = [];
  let noMatch = 0;

  for (const item of allItems) {
    const mfr = (item.mfr_part_number || "").trim().toUpperCase();
    const mdbDesc = item.description || "";

    // Try exact match in LamLinks
    let match = llByPart.get(mfr);

    // Try common variations
    if (!match) match = llByPart.get(mfr.replace(/[-\s]/g, ""));
    if (!match) match = llByPart.get(mfr.replace(/^0+/, "")); // strip leading zeros

    // Try D365 match
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
      };

      if (sim >= 0.12) {
        confirmed.push(result);
      } else {
        rejected.push(result);
      }
    } else {
      noMatch++;
    }
  }

  console.log(`\n=== INTERNAL MATCHING RESULTS ===`);
  console.log(`Items checked: ${allItems.length.toLocaleString()}`);
  console.log(`Confirmed (LamLinks + D365): ${confirmed.length}`);
  console.log(`Rejected (low similarity): ${rejected.length}`);
  console.log(`No internal match: ${noMatch.toLocaleString()}`);

  // Step 5: External lookup via govcagecodes.com for unmatched items
  const unmatched = allItems.filter((item) => {
    const mfr = (item.mfr_part_number || "").trim().toUpperCase();
    return !confirmed.find((c) => c.item_id === item.id) &&
           !rejected.find((r) => r.item_id === item.id) &&
           mfr.length >= 5; // govcagecodes needs at least 5 chars
  });

  console.log(`\n=== EXTERNAL LOOKUP (govcagecodes.com) ===`);
  console.log(`Searching ${unmatched.length.toLocaleString()} unmatched items...`);
  console.log(`(Rate limited: ~200/min)\n`);

  let extFound = 0;
  let extChecked = 0;
  let extFailed = 0;

  for (const item of unmatched) {
    const mfr = (item.mfr_part_number || "").trim();
    extChecked++;

    try {
      const resp = await fetch(
        `https://www.govcagecodes.com/nsn_search.php?part=${encodeURIComponent(mfr)}`
      );
      if (!resp.ok) { extFailed++; continue; }

      const html = await resp.text();
      const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
      if (!tbodyMatch) continue;

      const cells = tbodyMatch[1].match(/<td class='col-sm-3'>([^<]+)<\/td>/g);
      if (!cells || cells.length < 3) continue;

      const extract = (s: string) => s.replace(/<td class='col-sm-3'>/, "").replace(/<\/td>/, "");
      const rawNsn = extract(cells[0]);
      const nsnName = extract(cells[2]);

      // Validate it's a real 13-digit NSN
      if (!/^\d{13}$/.test(rawNsn)) continue;

      const nsn = `${rawNsn.slice(0, 4)}-${rawNsn.slice(4, 6)}-${rawNsn.slice(6, 9)}-${rawNsn.slice(9)}`;
      const sim = descSimilarity(item.description || "", nsnName);

      const result = {
        item_id: item.id,
        upc: item.upc,
        sku: item.sku,
        mfr_part_number: mfr,
        mdb_desc: item.description || "",
        matched_nsn: nsn,
        matched_desc: nsnName,
        similarity: sim,
        source: "govcagecodes",
      };

      if (sim >= 0.12) {
        confirmed.push(result);
        extFound++;
        console.log(`  FOUND: ${mfr} → NSN ${nsn} (sim=${sim.toFixed(2)})`);
        console.log(`    MDB: "${(item.description || "").substring(0, 50)}"`);
        console.log(`    GOV: "${nsnName.substring(0, 50)}"`);
      } else if (sim > 0) {
        rejected.push(result);
      }
    } catch {
      extFailed++;
    }

    // Rate limit: 300ms between requests (~200/min)
    await new Promise((r) => setTimeout(r, 300));

    if (extChecked % 100 === 0) {
      console.log(`  ...checked ${extChecked.toLocaleString()}/${unmatched.length.toLocaleString()}, found ${extFound} externally`);
    }
  }

  console.log(`\nExternal lookup complete:`);
  console.log(`  Checked: ${extChecked.toLocaleString()}`);
  console.log(`  Found: ${extFound}`);
  console.log(`  Failed requests: ${extFailed}`);

  console.log(`\n=== TOTAL RESULTS ===`);
  console.log(`Confirmed matches: ${confirmed.length}`);
  console.log(`Rejected: ${rejected.length}`);

  // Save
  writeFileSync(join(OUTPUT_DIR, "masterdb-confirmed.json"), JSON.stringify(confirmed, null, 2));
  writeFileSync(join(OUTPUT_DIR, "masterdb-rejected.json"), JSON.stringify(rejected, null, 2));

  // Show samples
  console.log("\nConfirmed matches (sample):");
  confirmed.slice(0, 15).forEach((m) => {
    const src = (m as any).source === "govcagecodes" ? "[EXT]" : "[INT]";
    console.log(`  ${src} ${m.mfr_part_number} → NSN ${m.matched_nsn} (sim=${m.similarity.toFixed(2)})`);
    console.log(`    MDB: "${m.mdb_desc.substring(0, 60)}"`);
    console.log(`    Match: "${m.matched_desc.substring(0, 60)}"`);
  });

  if (rejected.length > 0) {
    console.log("\nRejected (sample):");
    rejected.slice(0, 5).forEach((m) => {
      console.log(`  ${m.mfr_part_number} → NSN ${m.matched_nsn} (sim=${m.similarity.toFixed(2)}) REJECTED`);
      console.log(`    MDB: "${m.mdb_desc.substring(0, 60)}"`);
      console.log(`    Match: "${m.matched_desc.substring(0, 60)}"`);
    });
  }

  // Step 6: Write ALL confirmed NSNs back (internal + external)
  if (confirmed.length > 0) {
    console.log(`\nWriting ${confirmed.length} NSNs to Master DB...`);
    let totalWritten = 0;

    for (let i = 0; i < confirmed.length; i += 50) {
      const batch = confirmed.slice(i, i + 50).map((m) => ({
        item_id: m.item_id,
        nsn: m.matched_nsn,
      }));

      const resp = await fetch(NSN_API, {
        method: "POST",
        headers: { "X-Api-Key": KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ updates: batch }),
      });

      if (resp.ok) {
        const data = await resp.json();
        totalWritten += data.updated || 0;
      } else {
        console.error(`  Batch ${i} failed:`, await resp.text());
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log(`  Written: ${totalWritten}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nDone in ${elapsed} minutes.`);
}

main().catch(console.error);
