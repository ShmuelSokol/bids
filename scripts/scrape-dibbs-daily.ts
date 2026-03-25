/**
 * Daily DIBBS scrape — pulls today's new solicitations for all hot FSCs.
 * Designed to run on a cron schedule (6am + 12pm ET).
 * Saves to Supabase dibbs_solicitations table.
 *
 * Usage: npx tsx scripts/scrape-dibbs-daily.ts
 * Env: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
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

// All hot + warm FSCs
const FSC_CODES = [
  "6515", "6505", "6510", "6530", "6550", "6640", "5305", "6520",
  "6630", "5310", "4240", "4730", "6532", "6540", "6545", "8415",
  "6665", "6760", "7310", "7690", "5315", "6910", "6509", "8520",
  "5340", "5330", "4810", "4820", "6150", "6140", "6685", "6625",
];

interface Solicitation {
  nsn: string;
  nomenclature: string;
  solicitation_number: string;
  quantity: number;
  issue_date: string;
  return_by_date: string;
  fsc: string;
  set_aside: string;
  approved_parts: string | null;
  detail_url: string | null;
}

function parseResultsTable(html: string, fsc: string): Solicitation[] {
  const results: Solicitation[] = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;

  while ((match = rowPattern.exec(html)) !== null) {
    const row = match[1];
    if (!row.includes("SPE2D") && !row.includes("SPM")) continue;

    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;
    while ((cellMatch = cellPattern.exec(row)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
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
        approved_parts: null,
        detail_url: null,
      });
    }
  }
  return results;
}

async function scrapeFSC(page: Page, fsc: string, scope: string): Promise<Solicitation[]> {
  const allResults: Solicitation[] = [];

  // Use "today" scope for daily, "open" for full
  const url = `${DIBBS_BASE}/Rfq/RfqRecs.aspx?category=FSC&value=${fsc}&scope=${scope}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Parse first page
  let html = await page.content();
  allResults.push(...parseResultsTable(html, fsc));

  // Follow pagination
  let pageNum = 2;
  while (pageNum <= 20) {
    const nextLink = page.locator(`a[href*="Page$${pageNum}"]`).first();
    if (!(await nextLink.isVisible({ timeout: 1000 }).catch(() => false))) break;

    await nextLink.click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    html = await page.content();
    const pageResults = parseResultsTable(html, fsc);
    if (pageResults.length === 0) break;
    allResults.push(...pageResults);
    pageNum++;
  }

  return allResults;
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  const startTime = Date.now();
  const scope = process.argv.includes("--all") ? "open" : "today";

  console.log(`DIBBS Daily Scrape — ${scope} scope — ${FSC_CODES.length} FSCs`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  // Accept consent
  await page.goto(DIBBS_BASE, { waitUntil: "domcontentloaded" });
  await page.click("#butAgree").catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);

  const allSolicitations: Solicitation[] = [];

  for (const fsc of FSC_CODES) {
    try {
      const results = await scrapeFSC(page, fsc, scope);
      if (results.length > 0) {
        console.log(`  FSC ${fsc}: ${results.length} solicitations`);
        allSolicitations.push(...results);
      }
      await page.waitForTimeout(1500);
    } catch (err: any) {
      console.error(`  FSC ${fsc}: ERROR — ${err.message}`);
    }
  }

  await browser.close();

  console.log(`\nTotal: ${allSolicitations.length} solicitations`);

  // Save to file
  const filename = `solicitations-${scope}-${new Date().toISOString().split("T")[0]}.json`;
  writeFileSync(join(DIR, filename), JSON.stringify(allSolicitations, null, 2));

  // Save to Supabase (dedup by solicitation_number + nsn)
  if (allSolicitations.length > 0) {
    console.log("Saving to Supabase...");
    let saved = 0;
    for (let i = 0; i < allSolicitations.length; i += 100) {
      const batch = allSolicitations.slice(i, i + 100);
      const { error } = await supabase
        .from("dibbs_solicitations")
        .upsert(
          batch.map((s) => ({ ...s, scraped_at: new Date().toISOString() })),
          { onConflict: "solicitation_number,nsn", ignoreDuplicates: true }
        );
      if (!error) saved += batch.length;
    }
    console.log(`  ${saved} saved to Supabase`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nDone in ${elapsed}s — ${new Date().toISOString()}`);
}

main().catch(console.error);
