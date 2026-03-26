/**
 * Expanded DIBBS scrape — 60+ FSCs including expansion targets.
 * Covers everything Abe bids on PLUS categories he should be bidding on.
 */
import "dotenv/config";
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DIBBS_BASE = "https://www.dibbs.bsm.dla.mil";
const DIR = join(__dirname, "..", "data", "dibbs");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ALL FSCs: Abe's hot (32) + warm (15) + expansion targets (20+)
const FSC_CODES = [
  // Hot FSCs (Abe's active)
  "6515", "6505", "6510", "6530", "6550", "6640", "5305", "6520",
  "6630", "5310", "4240", "4730", "6532", "6540", "6545", "8415",
  "6665", "6760", "7310", "7690", "5315", "6910", "6509", "8520",
  "5340", "5330", "4810", "4820", "6150", "6140", "6685", "6625",
  // Warm FSCs
  "5998", "3431", "6210", "3040", "2920", "5360", "7050", "3020",
  "5895", "2940", "3990", "2805", "6840", "4710", "5307",
  // Expansion targets (NOT in LamLinks — these will show as "DIBBS only")
  "8010", "8030", "8040", "8430", "8340", "8405", "6610", "7930",
  "6145", "5950", "3510", "8030", "9390", "8105", "4230", "3130",
  "4120", "3740", "8030", "6695",
];

// Deduplicate
const UNIQUE_FSCS = [...new Set(FSC_CODES)];

interface Solicitation {
  nsn: string;
  nomenclature: string;
  solicitation_number: string;
  quantity: number;
  issue_date: string;
  return_by_date: string;
  fsc: string;
  set_aside: string;
}

function parseTable(html: string, fsc: string): Solicitation[] {
  const results: Solicitation[] = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowPattern.exec(html)) !== null) {
    const row = match[1];
    if (!row.includes("SPE2D") && !row.includes("SPM")) continue;
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cm;
    while ((cm = cellPattern.exec(row)) !== null) {
      cells.push(cm[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
    }
    if (cells.length >= 8) {
      const solMatch = cells[4]?.match(/(SPE\S+|SPM\S+)/);
      const qtyMatch = cells[6]?.match(/QTY:\s*(\d+)/);
      results.push({
        nsn: cells[1]?.trim() || "",
        nomenclature: cells[2]?.trim() || "",
        solicitation_number: solMatch ? solMatch[1] : "",
        quantity: qtyMatch ? parseInt(qtyMatch[1]) : 0,
        issue_date: cells[7]?.trim() || "",
        return_by_date: cells[8]?.trim() || "",
        fsc,
        set_aside: cells[3]?.trim() || "None",
      });
    }
  }
  return results;
}

async function scrapeFSC(page: Page, fsc: string): Promise<Solicitation[]> {
  const allResults: Solicitation[] = [];
  const url = `${DIBBS_BASE}/Rfq/RfqRecs.aspx?category=FSC&value=${fsc}&scope=open`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
  } catch {
    return [];
  }

  // Parse first page
  let html = await page.content();
  allResults.push(...parseTable(html, fsc));

  // Follow pagination
  let pageNum = 2;
  while (pageNum <= 10) {
    const nextLink = page.locator(`a[href*="Page$${pageNum}"]`).first();
    if (!(await nextLink.isVisible({ timeout: 1000 }).catch(() => false))) break;
    try {
      await nextLink.click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);
      html = await page.content();
      const pageResults = parseTable(html, fsc);
      if (pageResults.length === 0) break;
      allResults.push(...pageResults);
      pageNum++;
    } catch { break; }
    await page.waitForTimeout(500);
  }

  return allResults;
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  const startTime = Date.now();

  console.log(`EXPANDED DIBBS Scrape — ${UNIQUE_FSCS.length} FSCs`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  // Accept consent
  await page.goto(DIBBS_BASE, { waitUntil: "domcontentloaded" });
  await page.click("#butAgree").catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  const allSolicitations: Solicitation[] = [];
  let fscsDone = 0;

  for (const fsc of UNIQUE_FSCS) {
    fscsDone++;
    try {
      const results = await scrapeFSC(page, fsc);
      if (results.length > 0) {
        console.log(`  [${fscsDone}/${UNIQUE_FSCS.length}] FSC ${fsc}: ${results.length} solicitations`);
        allSolicitations.push(...results);
      } else {
        console.log(`  [${fscsDone}/${UNIQUE_FSCS.length}] FSC ${fsc}: 0`);
      }
      await page.waitForTimeout(1500);
    } catch (err: any) {
      console.error(`  [${fscsDone}/${UNIQUE_FSCS.length}] FSC ${fsc}: ERROR — ${err.message}`);
    }
  }

  await browser.close();

  // Deduplicate
  const seen = new Set<string>();
  const unique = allSolicitations.filter(s => {
    const key = `${s.solicitation_number}_${s.nsn}`;
    if (seen.has(key) || !s.solicitation_number || !s.nsn) return false;
    seen.add(key);
    return true;
  });

  console.log(`\nTotal: ${allSolicitations.length} raw, ${unique.length} unique`);

  // Save to file
  const filename = `expanded-scrape-${new Date().toISOString().split("T")[0]}.json`;
  writeFileSync(join(DIR, filename), JSON.stringify(unique, null, 2));

  // Save to Supabase
  console.log("Saving to Supabase...");
  let saved = 0;
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50).map(s => ({
      ...s,
      scraped_at: new Date().toISOString(),
      is_sourceable: false,
      approved_parts: null,
      detail_url: null,
    }));
    // Insert, skip duplicates
    for (const row of batch) {
      const { error } = await supabase.from("dibbs_solicitations").insert(row);
      if (!error) saved++;
    }
  }
  console.log(`  ${saved} new solicitations added to Supabase`);

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nDone in ${elapsed} minutes — ${new Date().toISOString()}`);
}

main().catch(console.error);
