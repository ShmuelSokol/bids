/**
 * Full DIBBS scrape — RFQ + RFP/IFB sections, recent scope (last 15 days), ALL FSCs.
 */
import "dotenv/config";
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DIBBS = "https://www.dibbs.bsm.dla.mil";
const DIR = join(__dirname, "..", "data", "dibbs");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jzgvdfzboknpcrhymjob.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ALL FSCs we care about — hot + warm + expansion
const FSCS = [
  "6515","6505","6510","6530","6550","6640","5305","6520","6630","5310",
  "4240","4730","6532","6540","6545","8415","6665","6760","7310","7690",
  "5315","6910","6509","8520","5340","5330","4810","4820","6150","6140",
  "6685","6625","5998","3431","6210","3040","2920","5360","7050","3020",
  "5895","2940","3990","2805","6840","4710","5307","8010","8030","8040",
  "8430","8340","8405","6610","7930","6145","5950","3510","9390","8105",
  "4230","3130","4120","3740","6695","6135","5935","5975","5985","4320",
];

interface Sol {
  nsn: string; nomenclature: string; solicitation_number: string;
  quantity: number; issue_date: string; return_by_date: string;
  fsc: string; set_aside: string; procurement_type?: string;
}

function parseTable(html: string, fsc: string): Sol[] {
  const results: Sol[] = [];
  const rowRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = rowRx.exec(html)) !== null) {
    const row = m[1];
    if (!row.includes("SPE2D") && !row.includes("SPM") && !row.includes("SPE4") && !row.includes("SPE7") && !row.includes("SPE8")) continue;
    const cellRx = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cm;
    while ((cm = cellRx.exec(row)) !== null) cells.push(cm[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
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

async function scrapeFSC(page: Page, fsc: string, section: string, scope: string): Promise<Sol[]> {
  const all: Sol[] = [];
  const baseUrl = section === "rfq"
    ? `${DIBBS}/Rfq/RfqRecs.aspx?category=FSC&value=${fsc}&scope=${scope}`
    : `${DIBBS}/RFP/RfpRecs.aspx?category=FSC&value=${fsc}&scope=${scope}`;

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);
  } catch { return []; }

  let html = await page.content();
  all.push(...parseTable(html, fsc));

  // Pagination
  let pageNum = 2;
  while (pageNum <= 10) {
    const next = page.locator(`a[href*="Page$${pageNum}"]`).first();
    if (!(await next.isVisible({ timeout: 1000 }).catch(() => false))) break;
    try {
      await next.click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1500);
      html = await page.content();
      const pr = parseTable(html, fsc);
      if (pr.length === 0) break;
      all.push(...pr);
      pageNum++;
    } catch { break; }
  }
  return all;
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  console.log(`FULL DIBBS Scrape — ${FSCS.length} FSCs × 2 sections (RFQ + RFP/IFB) × recent scope`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  await page.goto(DIBBS, { waitUntil: "domcontentloaded" });
  await page.click("#butAgree").catch(() => {});
  await page.waitForTimeout(1000);

  const allSols: Sol[] = [];
  let done = 0;

  for (const fsc of FSCS) {
    done++;
    // RFQ section - recent
    const rfqResults = await scrapeFSC(page, fsc, "rfq", "recent");
    // RFP/IFB section - recent
    const rfpResults = await scrapeFSC(page, fsc, "rfp", "recent");

    const total = rfqResults.length + rfpResults.length;
    if (total > 0) {
      console.log(`  [${done}/${FSCS.length}] FSC ${fsc}: ${rfqResults.length} RFQ + ${rfpResults.length} RFP = ${total}`);
      allSols.push(
        ...rfqResults.map(r => ({ ...r, procurement_type: "RFQ" })),
        ...rfpResults.map(r => ({ ...r, procurement_type: "RFP/IFB" }))
      );
    }
    await page.waitForTimeout(1000);
  }

  await browser.close();

  // Deduplicate
  const seen = new Set<string>();
  const unique = allSols.filter(s => {
    const key = `${s.solicitation_number}_${s.nsn}`;
    if (seen.has(key) || !s.solicitation_number || !s.nsn) return false;
    seen.add(key);
    return true;
  });

  console.log(`\nTotal: ${allSols.length} raw, ${unique.length} unique`);

  // Save locally
  writeFileSync(join(DIR, `full-scrape-${new Date().toISOString().split("T")[0]}.json`), JSON.stringify(unique, null, 2));

  // Save to Supabase
  console.log("Saving to Supabase...");
  let saved = 0;
  for (const s of unique) {
    const { error } = await sb.from("dibbs_solicitations").insert({
      ...s, scraped_at: new Date().toISOString(), is_sourceable: false,
    });
    if (!error) saved++;
  }
  console.log(`  ${saved} new added to Supabase`);

  console.log(`\nDone in ${((Date.now() - Date.now()) / 60000).toFixed(1)} min`);
}

main().catch(console.error);
