/**
 * Enrich existing solicitations with PUB LOG data.
 * Matches NIIN from our solicitations against PUB LOG management + part data.
 * Adds: unit_price (gov reference), part_number, cage_code.
 *
 * Run: npx tsx scripts/enrich-from-publog.ts
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

async function main() {
  console.log("=== Enrich Solicitations from PUB LOG ===\n");

  // Step 1: Get all unique NIINs from our solicitations
  console.log("Step 1: Loading NIINs from solicitations...");
  const niinToNsn = new Map<string, string[]>();
  let page = 0;
  while (true) {
    const { data } = await sb.from("dibbs_solicitations").select("nsn").range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const s of data) {
      const parts = s.nsn?.split("-");
      if (parts && parts.length >= 2) {
        const niin = parts.slice(1).join("").replace(/-/g, ""); // "01-234-5678" → "012345678"
        if (!niinToNsn.has(niin)) niinToNsn.set(niin, []);
        niinToNsn.get(niin)!.push(s.nsn);
      }
    }
    if (data.length < 1000) break;
    page++;
  }
  console.log(`  ${niinToNsn.size} unique NIINs from ${page * 1000 + (niinToNsn.size % 1000)} solicitations\n`);

  // Step 2: Load PUB LOG management data — only for our NIINs
  console.log("Step 2: Scanning FLIS_MANAGEMENT for our NIINs...");
  const mgmtMatches = new Map<string, { price: number; ui: string }>();
  const rl1 = createInterface({ input: createReadStream("C:/tmp/fullexport-FLIS_MANAGEMENT.csv", "utf-8"), crlfDelay: Infinity });
  let headers1: string[] = [];
  let line1 = 0;
  for await (const line of rl1) {
    line1++;
    if (line1 === 1) { headers1 = parseCSVLine(line); continue; }
    const row = parseCSVLine(line);
    const niin = row[headers1.indexOf("NIIN")] || "";
    if (niinToNsn.has(niin)) {
      const price = parseFloat(row[headers1.indexOf("UNIT_PRICE")] || "0") || 0;
      const ui = row[headers1.indexOf("UI")] || "";
      if (price > 0 && !mgmtMatches.has(niin)) {
        mgmtMatches.set(niin, { price, ui });
      }
    }
    if (line1 % 1000000 === 0) console.log(`  ${(line1/1000000).toFixed(0)}M scanned, ${mgmtMatches.size} matches...`);
  }
  console.log(`  ${mgmtMatches.size} NIINs matched with prices\n`);

  // Step 3: Load PUB LOG part data — only for our NIINs
  console.log("Step 3: Scanning FLIS_PART for our NIINs...");
  const partMatches = new Map<string, { cage: string; partNo: string }>();
  const rl2 = createInterface({ input: createReadStream("C:/tmp/fullexport-FLIS_PART.csv", "utf-8"), crlfDelay: Infinity });
  let headers2: string[] = [];
  let line2 = 0;
  for await (const line of rl2) {
    line2++;
    if (line2 === 1) { headers2 = parseCSVLine(line); continue; }
    const row = parseCSVLine(line);
    const niin = row[headers2.indexOf("NIIN")] || "";
    if (niinToNsn.has(niin) && !partMatches.has(niin)) {
      const cage = row[headers2.indexOf("CAGE_CODE")] || "";
      const partNo = row[headers2.indexOf("PART_NUMBER")] || "";
      if (cage || partNo) partMatches.set(niin, { cage, partNo });
    }
    if (line2 % 1000000 === 0) console.log(`  ${(line2/1000000).toFixed(0)}M scanned, ${partMatches.size} matches...`);
  }
  console.log(`  ${partMatches.size} NIINs matched with part data\n`);

  // Step 4: Save to publog_nsns for reference
  console.log("Step 4: Saving matched data to publog_nsns...");
  const records: any[] = [];
  for (const [niin, nsns] of niinToNsn) {
    const mgmt = mgmtMatches.get(niin);
    const part = partMatches.get(niin);
    if (!mgmt && !part) continue;

    for (const nsn of nsns) {
      const fsc = nsn.split("-")[0];
      const formattedNiin = nsn.split("-").slice(1).join("-");
      records.push({
        nsn,
        fsc,
        niin: formattedNiin,
        unit_price: mgmt?.price || null,
        unit_of_issue: mgmt?.ui || null,
        cage_code: part?.cage || null,
        part_number: part?.partNo || null,
      });
    }
  }

  let saved = 0;
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500);
    const { error } = await sb.from("publog_nsns").upsert(batch, { onConflict: "nsn", ignoreDuplicates: true });
    if (!error) saved += batch.length;
    if ((i + 500) % 5000 === 0) console.log(`  ${saved} saved...`);
  }

  console.log(`\nDone! ${saved} records saved to publog_nsns`);
  console.log(`  ${mgmtMatches.size} with gov reference prices`);
  console.log(`  ${partMatches.size} with part numbers/CAGE codes`);
}

main().catch(console.error);
