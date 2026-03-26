/**
 * Targeted NSN lookup by supplier — prioritizes industrial/military suppliers.
 * Uses nsnlookup.com only (fast, not rate limited).
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(__dirname, "..", "data", "nsn-matching");
const MDB_KEY = process.env.MASTERDB_API_KEY || "dDOUwJxbhLLVQ_40H8OWRtwwER6QoFmayDiTHcQrDW8";
const NSN_API = "https://masterdb.everreadygroup.com/api/dibs/nsn";
const CONCURRENCY = 10;
const LOG_FILE = join(OUTPUT_DIR, "supplier-lookup.log");

// Priority order: most likely to have NSN matches first
const SUPPLIER_PRIORITY = [
  "3MHARD", "EMERYW", "LANCAS", "KINRAY", "SMITH", "AMERIB",
  "PACOA", "SBD", "DIAMW", "BULKOF", "TRUVAL", "ESSEND",
];

function descSim(a: string, b: string): number {
  if (!a || !b) return 0;
  const wa = new Set(a.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));
  const wb = new Set(b.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let o = 0;
  for (const w of wa) if (wb.has(w)) o++;
  return o / Math.min(wa.size, wb.size);
}

async function searchNsnLookup(partno: string): Promise<{ nsn: string; name: string } | null> {
  try {
    const resp = await fetch(
      `https://www.nsnlookup.com/search?q=${encodeURIComponent(partno)}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!resp.ok) return null;
    const html = await resp.text();
    const match = html.match(/href="\/nsn\/(\d{4}-\d{2}-\d{3}-\d{4})-([^"]+)"/);
    if (!match) return null;
    const nsn = match[1];
    const name = match[2].split("-").filter((w) => !/^\d+$/.test(w) && w.length > 1).join(" ").toUpperCase().substring(0, 60);
    return { nsn, name };
  } catch {
    return null;
  }
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const lines = readFileSync(join(__dirname, "..", "data", "masterdb-mfr-192k.ndjson"), "utf-8")
    .split("\n").filter((l) => l.trim());

  // Group by supplier
  const bySupplier = new Map<string, { id: number; mfr: string; desc: string }[]>();
  for (const line of lines) {
    try {
      const item = JSON.parse(line);
      const mfr = (item.mfr_part_number || "").trim();
      if (item.nsn || mfr.length < 5) continue;
      const sup = item.supplier_code || "?";
      if (!bySupplier.has(sup)) bySupplier.set(sup, []);
      bySupplier.get(sup)!.push({ id: item.id, mfr, desc: item.description || "" });
    } catch {}
  }

  console.log("Items by supplier:");
  for (const sup of SUPPLIER_PRIORITY) {
    const items = bySupplier.get(sup);
    if (items) console.log(`  ${sup}: ${items.length.toLocaleString()}`);
  }

  const confirmed: any[] = [];
  let totalChecked = 0, totalFound = 0, totalWritten = 0;
  const startTime = Date.now();

  for (const sup of SUPPLIER_PRIORITY) {
    const items = bySupplier.get(sup);
    if (!items || items.length === 0) continue;

    console.log(`\n=== ${sup} (${items.length} items) ===`);
    let supFound = 0;

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (item) => {
          const result = await searchNsnLookup(item.mfr);
          return { item, result };
        })
      );

      for (const { item, result } of results) {
        totalChecked++;
        if (result) {
          const sim = descSim(item.desc, result.name);
          if (sim >= 0.20) {
            confirmed.push({ item_id: item.id, mfr: item.mfr, nsn: result.nsn, sim, desc: item.desc.substring(0, 50), gov: result.name });
            totalFound++;
            supFound++;

            // Write immediately
            await fetch(NSN_API, {
              method: "POST",
              headers: { "X-Api-Key": MDB_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({ updates: [{ item_id: item.id, nsn: result.nsn }] }),
            }).then(r => r.ok ? r.json().then(d => { totalWritten += d.updated || 0; }) : null).catch(() => {});

            console.log(`  FOUND: ${item.mfr} → ${result.nsn} (${result.name}) sim=${sim.toFixed(2)}`);
          }
        }
      }

      if ((i + CONCURRENCY) % 500 === 0 || i + CONCURRENCY >= items.length) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const msg = `${sup}: ${i + CONCURRENCY}/${items.length} | total: ${totalChecked} checked, ${totalFound} found, ${totalWritten} written | ${elapsed}m`;
        console.log(`  ${msg}`);
        appendFileSync(LOG_FILE, msg + "\n");
      }

      await new Promise((r) => setTimeout(r, 50));
    }

    console.log(`  ${sup} done: ${supFound} found`);
  }

  writeFileSync(join(OUTPUT_DIR, "supplier-confirmed.json"), JSON.stringify(confirmed, null, 2));
  console.log(`\n=== DONE === ${totalChecked} checked, ${totalFound} found, ${totalWritten} written`);
}

main().catch(console.error);
