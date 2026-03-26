/**
 * Parallel external NSN lookup — splits 175K items across multiple workers.
 * Each worker searches govcagecodes.com for a chunk.
 *
 * Usage: npx tsx scripts/nsn-external-parallel.ts [workerIndex] [totalWorkers]
 * Or run without args to spawn all workers.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { fork } from "child_process";

const OUTPUT_DIR = join(__dirname, "..", "data", "nsn-matching");
const MDB_KEY = process.env.MASTERDB_API_KEY || "dDOUwJxbhLLVQ_40H8OWRtwwER6QoFmayDiTHcQrDW8";
const NSN_API = "https://masterdb.everreadygroup.com/api/dibs/nsn";
const TOTAL_WORKERS = 20;
const RATE_MS = 200; // ms between requests per worker

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
    return {
      nsn: `${rawNsn.slice(0, 4)}-${rawNsn.slice(4, 6)}-${rawNsn.slice(6, 9)}-${rawNsn.slice(9)}`,
      name,
    };
  } catch {
    return null;
  }
}

async function writeNsns(updates: { item_id: number; nsn: string }[]): Promise<number> {
  if (updates.length === 0) return 0;
  const resp = await fetch(NSN_API, {
    method: "POST",
    headers: { "X-Api-Key": MDB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  }).catch(() => null);
  if (!resp || !resp.ok) return 0;
  const data = await resp.json();
  return data.updated || 0;
}

async function runWorker(workerIndex: number, totalWorkers: number) {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Load items
  const lines = readFileSync(join(__dirname, "..", "data", "masterdb-mfr-192k.ndjson"), "utf-8")
    .split("\n")
    .filter((l) => l.trim());

  // Filter to searchable items (no NSN, mfr >= 5 chars)
  const items: any[] = [];
  for (const line of lines) {
    try {
      const item = JSON.parse(line);
      if (!item.nsn && (item.mfr_part_number || "").trim().length >= 5) {
        items.push(item);
      }
    } catch {}
  }

  // Take this worker's chunk
  const chunkSize = Math.ceil(items.length / totalWorkers);
  const start = workerIndex * chunkSize;
  const chunk = items.slice(start, start + chunkSize);

  console.log(`Worker ${workerIndex + 1}/${totalWorkers}: ${chunk.length} items (${start}-${start + chunk.length})`);

  const confirmed: any[] = [];
  let checked = 0;
  let written = 0;
  const pendingWrites: { item_id: number; nsn: string }[] = [];

  for (const item of chunk) {
    const mfr = (item.mfr_part_number || "").trim();
    checked++;

    const result = await searchGovcagecodes(mfr);
    if (result) {
      const sim = descSimilarity(item.description || "", result.name);
      if (sim >= 0.20) {
        confirmed.push({
          item_id: item.id,
          mfr,
          nsn: result.nsn,
          sim,
          mdb_desc: (item.description || "").substring(0, 50),
          gov_desc: result.name,
        });
        pendingWrites.push({ item_id: item.id, nsn: result.nsn });
      }
    }

    // Write in batches of 25
    if (pendingWrites.length >= 25) {
      const batch = pendingWrites.splice(0, 25);
      written += await writeNsns(batch);
    }

    if (checked % 500 === 0) {
      console.log(`  W${workerIndex + 1}: ${checked}/${chunk.length} checked, ${confirmed.length} found, ${written} written`);
    }

    await new Promise((r) => setTimeout(r, RATE_MS));
  }

  // Flush remaining
  if (pendingWrites.length > 0) {
    written += await writeNsns(pendingWrites);
  }

  // Save results
  writeFileSync(
    join(OUTPUT_DIR, `external-worker-${workerIndex}.json`),
    JSON.stringify(confirmed, null, 2)
  );

  console.log(`\nWorker ${workerIndex + 1} DONE: ${checked} checked, ${confirmed.length} found, ${written} written`);
}

// Main: either run as worker or spawn all workers
const args = process.argv.slice(2);
if (args.length >= 2) {
  // Running as a worker
  const workerIndex = parseInt(args[0]);
  const totalWorkers = parseInt(args[1]);
  runWorker(workerIndex, totalWorkers).catch(console.error);
} else {
  // Spawn all workers
  console.log(`Spawning ${TOTAL_WORKERS} parallel workers for 175K items...\n`);

  for (let i = 0; i < TOTAL_WORKERS; i++) {
    const child = fork(__filename, [String(i), String(TOTAL_WORKERS)], {
      execArgv: ["--import", "tsx"],
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      console.log(`Worker ${i + 1} exited with code ${code}`);
    });
  }
}
