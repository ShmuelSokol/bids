/**
 * Import PUB LOG exported CSVs into Supabase publog_nsns table.
 *
 * Expected files in C:\tmp\:
 *   fullexport-FLIS_IDENTIFICATION.csv — 16.9M NIINs with codes
 *   fullexport-FLIS_MANAGEMENT.csv — unit prices, UI, AAC, FSC
 *   fullexport-FLIS_PART.csv — part number cross-references
 *
 * Run: npx tsx scripts/import-publog-csv.ts
 */
import "dotenv/config";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === "," && !inQuotes) { cells.push(current.trim()); current = ""; }
    else { current += char; }
  }
  cells.push(current.trim());
  return cells;
}

async function processFile(filePath: string, handler: (headers: string[], row: string[]) => any) {
  const rl = createInterface({ input: createReadStream(filePath, "utf-8"), crlfDelay: Infinity });
  let headers: string[] = [];
  let lineNum = 0;
  const results: any[] = [];

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) { headers = parseCSVLine(line); continue; }
    const row = parseCSVLine(line);
    const result = handler(headers, row);
    if (result) results.push(result);
    if (results.length >= 500) {
      await flushBatch(results.splice(0, 500));
      if (lineNum % 100000 === 0) console.log(`  ${(lineNum / 1000000).toFixed(1)}M rows...`);
    }
  }
  if (results.length > 0) await flushBatch(results);
  console.log(`  Done: ${lineNum - 1} rows processed`);
}

let totalSaved = 0;
async function flushBatch(batch: any[]) {
  const { error } = await sb.from("publog_nsns").upsert(batch, { onConflict: "nsn", ignoreDuplicates: true });
  if (error) console.error(`  Batch error: ${error.message}`);
  else totalSaved += batch.length;
}

async function main() {
  console.log("=== PUB LOG CSV Import ===\n");

  // Step 1: Load MANAGEMENT first (has FSC + unit price)
  console.log("Step 1: Loading FLIS_MANAGEMENT (FSC, prices)...");
  const mgmtMap = new Map<string, { fsc: string; price: number; ui: string }>();

  try {
    const rl = createInterface({ input: createReadStream("C:/tmp/fullexport-FLIS_MANAGEMENT.csv", "utf-8"), crlfDelay: Infinity });
    let headers: string[] = [];
    let lineNum = 0;
    for await (const line of rl) {
      lineNum++;
      if (lineNum === 1) { headers = parseCSVLine(line); console.log("  Columns:", headers.join(", ")); continue; }
      const row = parseCSVLine(line);
      const get = (name: string) => row[headers.indexOf(name)] || "";
      const niin = get("NIIN");
      if (!niin) continue;
      mgmtMap.set(niin, {
        fsc: get("FSC") || get("FSG") || "",
        price: parseFloat(get("UNIT_PRICE") || get("UP") || "0") || 0,
        ui: get("UI") || get("UNIT_OF_ISSUE") || "",
      });
    }
    console.log(`  Loaded ${mgmtMap.size} management records`);
  } catch (e: any) {
    console.log(`  Management file not ready: ${e.message}`);
  }

  // Step 2: Load PART cross-references
  console.log("\nStep 2: Loading FLIS_PART (part numbers)...");
  const partMap = new Map<string, { cage: string; partNo: string }>();

  try {
    const rl = createInterface({ input: createReadStream("C:/tmp/fullexport-FLIS_PART.csv", "utf-8"), crlfDelay: Infinity });
    let headers: string[] = [];
    let lineNum = 0;
    for await (const line of rl) {
      lineNum++;
      if (lineNum === 1) { headers = parseCSVLine(line); console.log("  Columns:", headers.join(", ")); continue; }
      const row = parseCSVLine(line);
      const get = (name: string) => row[headers.indexOf(name)] || "";
      const niin = get("NIIN");
      if (!niin || partMap.has(niin)) continue; // keep first part# per NIIN
      partMap.set(niin, {
        cage: get("CAGE") || get("CAGE_CD") || "",
        partNo: get("REF_NUM") || get("PART_NUMBER") || get("REF_NO") || "",
      });
    }
    console.log(`  Loaded ${partMap.size} part records`);
  } catch (e: any) {
    console.log(`  Part file not ready: ${e.message}`);
  }

  // Step 3: Process IDENTIFICATION and combine with management + part data
  console.log("\nStep 3: Processing FLIS_IDENTIFICATION (16.9M NIINs)...");

  await processFile("C:/tmp/fullexport-FLIS_IDENTIFICATION.csv", (headers, row) => {
    const get = (name: string) => row[headers.indexOf(name)] || "";
    const niin = get("NIIN");
    if (!niin || niin.length < 9) return null;

    const mgmt = mgmtMap.get(niin);
    const part = partMap.get(niin);
    const fsc = mgmt?.fsc || "";
    if (!fsc) return null; // Skip NIINs without FSC

    const nsn = `${fsc}-${niin.substring(0, 2)}-${niin.substring(2, 5)}-${niin.substring(5, 9)}`;

    return {
      nsn,
      fsc,
      niin: `${niin.substring(0, 2)}-${niin.substring(2, 5)}-${niin.substring(5, 9)}`,
      item_name: "", // Not in these exports — would need H6 name table
      unit_price: mgmt?.price || null,
      unit_of_issue: mgmt?.ui || null,
      cage_code: part?.cage || null,
      part_number: part?.partNo || null,
      demil_code: get("DMIL") || null,
      shelf_life: null,
    };
  });

  console.log(`\nTotal saved to Supabase: ${totalSaved.toLocaleString()}`);

  await sb.from("sync_log").insert({
    action: "publog_import",
    details: { identification_rows: 16986259, management_records: mgmtMap.size, part_records: partMap.size, saved: totalSaved },
  });
}

main().catch(console.error);
