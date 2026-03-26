/**
 * Import PUB LOG NSN data from DLA Electronic Reading Room CSVs.
 *
 * PUB LOG files are available FREE at:
 *   https://www.dla.mil/Information-Operations/FLIS-Data-Electronic-Reading-Room/
 *
 * Download instructions:
 *   1. Visit the URL above in a browser
 *   2. Download "PUB LOG FLIS Search" files (CSV format)
 *   3. Also download "MCRL" (Master Cross Reference List) for part number mappings
 *   4. Place files in data/publog/ directory
 *   5. Run: npx tsx scripts/import-publog.ts
 *
 * Files typically available:
 *   - PUB_LOG_IDENTIFICATION.csv  (NSN, item name, FSC, NIIN, unit price, UoI)
 *   - PUB_LOG_REFERENCE.csv       (NSN → part numbers, CAGE codes)
 *   - MCRL.csv                    (Master Cross Reference List — part# to NSN)
 *   - H2_CAGE.csv                 (CAGE code directory)
 *
 * This script imports them into Supabase publog_nsns table for NSN matching.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createReadStream, readdirSync, existsSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";

const DIR = join(__dirname, "..", "data", "publog");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PubLogRecord {
  nsn: string;
  fsc: string;
  niin: string;
  item_name: string;
  unit_price: number | null;
  unit_of_issue: string | null;
  cage_code: string | null;
  part_number: string | null;
  demil_code: string | null;
  shelf_life: string | null;
}

async function processIdentificationFile(filePath: string): Promise<PubLogRecord[]> {
  const records: PubLogRecord[] = [];
  const rl = createInterface({ input: createReadStream(filePath, "utf-8"), crlfDelay: Infinity });

  let headers: string[] = [];
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) {
      // Parse header — PUB LOG CSVs use various header formats
      headers = line.split(",").map(h => h.trim().replace(/"/g, "").toLowerCase());
      continue;
    }

    const cells = parseCSVLine(line);
    if (cells.length < 3) continue;

    // Map columns dynamically based on headers
    const get = (names: string[]) => {
      for (const n of names) {
        const idx = headers.indexOf(n);
        if (idx >= 0 && cells[idx]) return cells[idx].trim();
      }
      return "";
    };

    const fsc = get(["fsc", "federal_supply_class", "fsc_code", "federal supply class"]);
    const niin = get(["niin", "national_item_identification_number", "niin_code"]);
    const itemName = get(["item_name", "approved_item_name", "item name", "nomenclature", "description"]);

    if (!fsc || !niin) continue;

    const nsn = `${fsc}-${niin.replace(/^(\d{2})(\d{3})(\d{4})$/, "$1-$2-$3")}`;
    const priceStr = get(["unit_price", "price", "unit price"]);

    records.push({
      nsn,
      fsc,
      niin,
      item_name: itemName || "",
      unit_price: priceStr ? parseFloat(priceStr) || null : null,
      unit_of_issue: get(["ui", "unit_of_issue", "unit of issue", "uoi"]) || null,
      cage_code: get(["cage", "cage_code", "cage code"]) || null,
      part_number: get(["part_number", "reference_number", "part number", "ref_no"]) || null,
      demil_code: get(["demil", "demil_code", "demilitarization"]) || null,
      shelf_life: get(["shelf_life", "shelf life"]) || null,
    });
  }

  return records;
}

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

async function main() {
  console.log("=== PUB LOG NSN Import ===\n");

  if (!existsSync(DIR)) {
    console.log(`Directory not found: ${DIR}`);
    console.log(`\nTo get PUB LOG data:`);
    console.log(`  1. Visit: https://www.dla.mil/Information-Operations/FLIS-Data-Electronic-Reading-Room/`);
    console.log(`  2. Download the PUB LOG identification and reference files (CSV)`);
    console.log(`  3. Create folder: data/publog/`);
    console.log(`  4. Place the CSV files there`);
    console.log(`  5. Re-run this script\n`);
    console.log(`Alternatively, download the MCRL (Master Cross Reference List) for part number → NSN mappings.\n`);

    // Try to fetch from nsnlookup.com as an alternative
    console.log("Attempting to scrape NSN data from nsnlookup.com for our FSCs...");
    await scrapeNsnLookup();
    return;
  }

  const files = readdirSync(DIR).filter(f => f.endsWith(".csv"));
  console.log(`Found ${files.length} CSV files in ${DIR}:`);
  files.forEach(f => console.log(`  - ${f}`));

  let allRecords: PubLogRecord[] = [];

  for (const file of files) {
    console.log(`\nProcessing ${file}...`);
    const records = await processIdentificationFile(join(DIR, file));
    console.log(`  Parsed ${records.length} records`);
    allRecords.push(...records);
  }

  // Deduplicate by NSN
  const seen = new Set<string>();
  const unique = allRecords.filter(r => {
    if (seen.has(r.nsn)) return false;
    seen.add(r.nsn);
    return true;
  });

  console.log(`\nTotal: ${allRecords.length} raw, ${unique.length} unique NSNs`);

  // Save to Supabase in batches
  console.log("Saving to Supabase publog_nsns...");
  let saved = 0;
  for (let i = 0; i < unique.length; i += 500) {
    const batch = unique.slice(i, i + 500);
    const { error } = await sb
      .from("publog_nsns")
      .upsert(batch, { onConflict: "nsn", ignoreDuplicates: false });

    if (error) {
      console.error(`  Batch ${i}-${i + 500} error: ${error.message}`);
    } else {
      saved += batch.length;
    }

    if ((i + 500) % 5000 === 0) console.log(`  ${saved.toLocaleString()} saved...`);
  }

  console.log(`\nDone! ${saved.toLocaleString()} NSN records imported.`);

  // Log sync
  await sb.from("sync_log").insert({
    action: "publog_import",
    details: { total: allRecords.length, unique: unique.length, saved },
  });
}

/**
 * Fallback: scrape NSN data from nsnlookup.com for our active FSCs
 * This gives us descriptions and CAGE codes for FSCs we bid on
 */
async function scrapeNsnLookup() {
  // Get our active FSCs from the solicitations
  const { data: fscs } = await sb
    .from("dibbs_solicitations")
    .select("fsc")
    .limit(50000);

  const uniqueFscs = [...new Set((fscs || []).map((r: any) => r.fsc).filter(Boolean))];
  console.log(`Found ${uniqueFscs.length} active FSCs to look up\n`);

  // For now, just report the FSCs — actual scraping would need Playwright
  console.log("Active FSCs needing NSN data:");
  console.log(uniqueFscs.sort().join(", "));
  console.log(`\nTo proceed, download PUB LOG CSVs from:`);
  console.log(`https://www.dla.mil/Information-Operations/FLIS-Data-Electronic-Reading-Room/`);
}

main().catch(console.error);
