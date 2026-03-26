/**
 * Dual-source NSN lookup — nsnlookup.com (fast) + govcagecodes.com (backup).
 * 20 concurrent requests to nsnlookup, which responds in ~200ms.
 * Expected: ~175K items in ~30 minutes.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(__dirname, "..", "data", "nsn-matching");
const MDB_KEY = process.env.MASTERDB_API_KEY || "dDOUwJxbhLLVQ_40H8OWRtwwER6QoFmayDiTHcQrDW8";
const NSN_API = "https://masterdb.everreadygroup.com/api/dibs/nsn";
const CONCURRENCY = 15;
const LOG_FILE = join(OUTPUT_DIR, "dual-lookup.log");

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

    // Parse NSN + name from results
    // Format in href: "6515-01-398-6635-applicator-disposable-..."
    const match = html.match(
      /href="\/nsn\/(\d{4}-\d{2}-\d{3}-\d{4})-([^"]+)"/
    );
    if (!match) return null;

    const nsn = match[1];
    // Convert slug to name: "applicator-disposable" → "APPLICATOR DISPOSABLE"
    const name = match[2]
      .split("-")
      .filter((w) => !/^\d+$/.test(w) && w.length > 1)
      .join(" ")
      .toUpperCase()
      .substring(0, 60);

    return { nsn, name };
  } catch {
    return null;
  }
}

async function searchGovcagecodes(partno: string): Promise<{ nsn: string; name: string } | null> {
  try {
    const resp = await fetch(
      `https://www.govcagecodes.com/nsn_search.php?part=${encodeURIComponent(partno)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!resp.ok) return null;
    const html = await resp.text();
    const m = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
    if (!m) return null;
    const cells = m[1].match(/<td class='col-sm-3'>([^<]+)<\/td>/g);
    if (!cells || cells.length < 3) return null;
    const ext = (s: string) => s.replace(/<td class='col-sm-3'>/, "").replace(/<\/td>/, "");
    const rawNsn = ext(cells[0]);
    if (!/^\d{13}$/.test(rawNsn)) return null;
    return {
      nsn: `${rawNsn.slice(0, 4)}-${rawNsn.slice(4, 6)}-${rawNsn.slice(6, 9)}-${rawNsn.slice(9)}`,
      name: ext(cells[2]),
    };
  } catch {
    return null;
  }
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const lines = readFileSync(join(__dirname, "..", "data", "masterdb-mfr-192k.ndjson"), "utf-8")
    .split("\n").filter((l) => l.trim());

  const items: { id: number; mfr: string; desc: string }[] = [];
  for (const line of lines) {
    try {
      const item = JSON.parse(line);
      const mfr = (item.mfr_part_number || "").trim();
      if (!item.nsn && mfr.length >= 5) {
        items.push({ id: item.id, mfr, desc: item.description || "" });
      }
    } catch {}
  }

  console.log(`${items.length.toLocaleString()} items | ${CONCURRENCY} concurrent | nsnlookup.com (primary) + govcagecodes.com (backup)`);
  console.log(`Estimated: ~${Math.round(items.length / CONCURRENCY * 0.3 / 60)} minutes\n`);

  const confirmed: any[] = [];
  let checked = 0, found = 0, written = 0, nsnlookupHits = 0, govHits = 0;
  const pendingWrites: { item_id: number; nsn: string }[] = [];
  const startTime = Date.now();

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);

    const results = await Promise.all(
      batch.map(async (item) => {
        // Try nsnlookup first (fast)
        let result = await searchNsnLookup(item.mfr);
        let source = "nsnlookup";

        // Fall back to govcagecodes if nsnlookup misses
        if (!result) {
          result = await searchGovcagecodes(item.mfr);
          source = "govcagecodes";
        }

        return { item, result, source };
      })
    );

    for (const { item, result, source } of results) {
      checked++;
      if (result) {
        const sim = descSim(item.desc, result.name);
        if (sim >= 0.20) {
          confirmed.push({
            item_id: item.id, mfr: item.mfr, nsn: result.nsn, sim, source,
            mdb_desc: item.desc.substring(0, 50), gov_desc: result.name,
          });
          pendingWrites.push({ item_id: item.id, nsn: result.nsn });
          found++;
          if (source === "nsnlookup") nsnlookupHits++;
          else govHits++;
        }
      }
    }

    // Write in batches
    if (pendingWrites.length >= 50) {
      const wb = pendingWrites.splice(0, 50);
      const resp = await fetch(NSN_API, {
        method: "POST",
        headers: { "X-Api-Key": MDB_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ updates: wb }),
      }).catch(() => null);
      if (resp?.ok) { const d = await resp.json(); written += d.updated || 0; }
    }

    if (checked % 1000 === 0 || checked >= items.length) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const rate = (checked / ((Date.now() - startTime) / 1000)).toFixed(0);
      const eta = (((items.length - checked) / Math.max(1, parseFloat(rate))) / 60).toFixed(0);
      const msg = `${checked.toLocaleString()}/${items.length.toLocaleString()} | ${found} found (${nsnlookupHits} nsnlookup + ${govHits} govcage) | ${written} written | ${rate}/s | ${elapsed}m | ~${eta}m left`;
      console.log(msg);
      appendFileSync(LOG_FILE, msg + "\n");
    }

    await new Promise((r) => setTimeout(r, 30));
  }

  // Flush
  if (pendingWrites.length > 0) {
    const resp = await fetch(NSN_API, {
      method: "POST",
      headers: { "X-Api-Key": MDB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ updates: pendingWrites }),
    }).catch(() => null);
    if (resp?.ok) { const d = await resp.json(); written += d.updated || 0; }
  }

  writeFileSync(join(OUTPUT_DIR, "dual-confirmed.json"), JSON.stringify(confirmed, null, 2));

  console.log(`\n=== DONE ===`);
  console.log(`Checked: ${checked.toLocaleString()}`);
  console.log(`Found: ${found} (${nsnlookupHits} nsnlookup + ${govHits} govcagecodes)`);
  console.log(`Written: ${written}`);
  console.log(`Time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`);
}

main().catch(console.error);
