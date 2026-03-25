/**
 * Full DIBBS scraper — pulls open solicitations for all hot FSCs,
 * including detail pages for approved part numbers and CAGE codes.
 * Saves to Supabase.
 *
 * Run: npx tsx scripts/scrape-dibbs-full.ts
 */
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DIBBS_BASE = "https://www.dibbs.bsm.dla.mil";
const DIR = join(__dirname, "..", "data", "dibbs");
const supabase = createClient(
  "https://jzgvdfzboknpcrhymjob.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6Z3ZkZnpib2tucGNyaHltam9iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ2NjU2NiwiZXhwIjoyMDkwMDQyNTY2fQ.u1GycK2kRPFjYrj75VteWyFEfuUb7bbO91uwNp6VMzo"
);

// Hot + warm FSCs from our heatmap analysis
const FSC_CODES = [
  // Hot (top 20 by last-month volume)
  "6515", "6505", "6510", "6530", "6550", "6640", "5305", "6520",
  "6630", "5310", "4240", "4730", "6532", "6540", "6545", "8415",
  "6665", "6760", "7310", "7690",
  // Expansion targets
  "8010", "8030", "8040", "8430", "8340",
];

interface DibbsSolicitation {
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

async function acceptConsent(page: Page) {
  await page.goto(DIBBS_BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.click("#butAgree").catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);
}

async function searchFSC(page: Page, fsc: string): Promise<DibbsSolicitation[]> {
  const results: DibbsSolicitation[] = [];

  // Navigate to RFQ search results directly via URL
  const url = `${DIBBS_BASE}/Rfq/RfqRecs.aspx?category=FSC&value=${fsc}&scope=open`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Parse the results table from HTML
  const html = await page.content();

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
      const nsn = cells[1]?.trim() || "";
      const solMatch = cells[4]?.match(/(SPE\S+|SPM\S+)/);
      const solNum = solMatch ? solMatch[1] : cells[4]?.trim() || "";
      const qtyMatch = cells[6]?.match(/QTY:\s*(\d+)/);
      const qty = qtyMatch ? parseInt(qtyMatch[1]) : 0;

      results.push({
        nsn,
        nomenclature: cells[2]?.trim() || "",
        solicitation_number: solNum,
        quantity: qty,
        issue_date: cells[7]?.trim() || "",
        return_by_date: cells[8]?.trim() || "",
        fsc,
        set_aside: cells[3]?.trim() || "None",
        approved_parts: null,
        detail_url: null,
      });
    }
  }

  // Follow pagination — DIBBS uses ASP.NET __doPostBack for page nav
  let pageNum = 2;
  const MAX_PAGES = 20; // safety cap
  while (pageNum <= MAX_PAGES) {
    const nextLink = page.locator(
      `a[href*="Page$${pageNum}"], a[href*="Page\\$${pageNum}"]`
    ).first();

    if (!(await nextLink.isVisible({ timeout: 1000 }).catch(() => false))) break;

    await nextLink.click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    const pageHtml = await page.content();
    let pageCount = 0;
    const pageRowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let pageMatch;
    while ((pageMatch = pageRowPattern.exec(pageHtml)) !== null) {
      const row = pageMatch[1];
      if (!row.includes("SPE2D") && !row.includes("SPM")) continue;

      const cellPattern2 = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
      let cellMatch2;
      while ((cellMatch2 = cellPattern2.exec(row)) !== null) {
        cells.push(cellMatch2[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
      }

      if (cells.length >= 8) {
        const nsn = cells[1]?.trim() || "";
        const solMatch = cells[4]?.match(/(SPE\S+|SPM\S+)/);
        const solNum = solMatch ? solMatch[1] : cells[4]?.trim() || "";
        const qtyMatch = cells[6]?.match(/QTY:\s*(\d+)/);
        const qty = qtyMatch ? parseInt(qtyMatch[1]) : 0;

        results.push({
          nsn,
          nomenclature: cells[2]?.trim() || "",
          solicitation_number: solNum,
          quantity: qty,
          issue_date: cells[7]?.trim() || "",
          return_by_date: cells[8]?.trim() || "",
          fsc,
          set_aside: cells[3]?.trim() || "None",
          approved_parts: null,
          detail_url: null,
        });
        pageCount++;
      }
    }

    if (pageCount === 0) break;
    pageNum++;
    await page.waitForTimeout(1000);
  }

  return results;
}

async function getDetailParts(page: Page, nsn: string): Promise<string | null> {
  try {
    const url = `${DIBBS_BASE}/RFQ/RfqDetail.aspx?nsn=${nsn.replace(/-/g, "")}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(1000);

    const text = await page.locator("body").innerText();
    // Look for approved sources / part numbers
    const partLines = text.split("\n").filter(
      (l) => /part\s*#|part\s*number|cage|approved\s*source/i.test(l) && l.trim().length > 5
    );

    // Also try to find a table with part/cage data
    const partTable = await page
      .locator("table")
      .filter({ hasText: /CAGE|Part/ })
      .first()
      .innerText()
      .catch(() => "");

    const result = partTable || partLines.join("; ");
    return result.trim() || null;
  } catch {
    return null;
  }
}

async function main() {
  mkdirSync(DIR, { recursive: true });

  console.log(`DIBBS Full Scrape — ${FSC_CODES.length} FSC codes`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  // Accept consent
  await acceptConsent(page);

  const allSolicitations: DibbsSolicitation[] = [];

  for (const fsc of FSC_CODES) {
    console.log(`FSC ${fsc}...`);
    try {
      const results = await searchFSC(page, fsc);
      console.log(`  ${results.length} open solicitations`);
      allSolicitations.push(...results);

      // Rate limit
      await page.waitForTimeout(1500);
    } catch (err: any) {
      console.error(`  ERROR: ${err.message}`);
    }
  }

  console.log(`\nTotal solicitations: ${allSolicitations.length}`);

  // Get detail/part info for first 50 unique NSNs
  const uniqueNSNs = [...new Set(allSolicitations.map((s) => s.nsn))].slice(0, 50);
  console.log(`\nFetching part details for ${uniqueNSNs.length} unique NSNs...`);

  const partsMap: Record<string, string> = {};
  for (const nsn of uniqueNSNs) {
    const parts = await getDetailParts(page, nsn);
    if (parts) {
      partsMap[nsn] = parts;
      console.log(`  ${nsn}: ${parts.substring(0, 80)}`);
    }
    await page.waitForTimeout(500);
  }

  // Merge parts back
  allSolicitations.forEach((s) => {
    if (partsMap[s.nsn]) s.approved_parts = partsMap[s.nsn];
  });

  await browser.close();

  // Save to file
  writeFileSync(join(DIR, "open-solicitations.json"), JSON.stringify(allSolicitations, null, 2));
  console.log(`\nSaved to data/dibbs/open-solicitations.json`);

  // Save to Supabase
  console.log("Saving to Supabase...");

  // Create table if needed
  await fetch("https://api.supabase.com/v1/projects/jzgvdfzboknpcrhymjob/database/query", {
    method: "POST",
    headers: {
      Authorization: "Bearer sbp_v0_484815b13adb8ee0a78457e0a087b2cb6502bd91",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        CREATE TABLE IF NOT EXISTS dibbs_solicitations (
          id SERIAL PRIMARY KEY,
          nsn TEXT,
          nomenclature TEXT,
          solicitation_number TEXT,
          quantity INTEGER,
          issue_date TEXT,
          return_by_date TEXT,
          fsc TEXT,
          set_aside TEXT,
          approved_parts TEXT,
          detail_url TEXT,
          scraped_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(solicitation_number, nsn)
        );
        CREATE INDEX IF NOT EXISTS idx_dibbs_sol_fsc ON dibbs_solicitations(fsc);
        CREATE INDEX IF NOT EXISTS idx_dibbs_sol_nsn ON dibbs_solicitations(nsn);
        NOTIFY pgrst, 'reload schema';
      `,
    }),
  });

  // Wait for schema cache
  await new Promise((r) => setTimeout(r, 3000));

  // Upsert in batches
  for (let i = 0; i < allSolicitations.length; i += 100) {
    const batch = allSolicitations.slice(i, i + 100);
    const { error } = await supabase
      .from("dibbs_solicitations")
      .upsert(batch, { onConflict: "solicitation_number,nsn" });
    if (error) {
      console.error(`  Batch ${i} error:`, error.message);
    }
  }

  console.log(`  ${allSolicitations.length} solicitations saved to Supabase`);

  // Summary
  const byFsc: Record<string, number> = {};
  allSolicitations.forEach((s) => {
    byFsc[s.fsc] = (byFsc[s.fsc] || 0) + 1;
  });

  console.log("\n=== SCRAPE SUMMARY ===");
  Object.entries(byFsc)
    .sort((a, b) => b[1] - a[1])
    .forEach(([fsc, count]) => {
      console.log(`  FSC ${fsc}: ${count} solicitations`);
    });

  console.log(`\nFinished: ${new Date().toISOString()}`);
}

main().catch(console.error);
