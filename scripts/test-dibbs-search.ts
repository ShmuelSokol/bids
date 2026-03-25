/**
 * Test DIBBS solicitation search — search by FSC after accepting consent.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DIBBS_BASE = "https://www.dibbs.bsm.dla.mil";
const DIR = join(__dirname, "..", "data", "dibbs-screenshots");

async function main() {
  mkdirSync(DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    // Accept consent
    console.log("1. Navigating to DIBBS...");
    await page.goto(DIBBS_BASE, { waitUntil: "domcontentloaded" });
    await page.click('#butAgree, input[name="butAgree"], input[value="OK"]');
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
    console.log("   Consent accepted, on home page");

    // Try clicking on "Requests for Quotation" or similar solicitation link
    console.log("\n2. Looking for solicitation links...");
    const links = await page.locator("a").all();
    const solLinks: string[] = [];
    for (const link of links) {
      const text = await link.textContent().catch(() => "");
      const href = await link.getAttribute("href").catch(() => "");
      if (text && (text.includes("RFQ") || text.includes("Solicitation") || text.includes("Quotation") || text.includes("Request for"))) {
        solLinks.push(`${text.trim()} → ${href}`);
      }
    }
    console.log("   Solicitation-related links:");
    solLinks.forEach(l => console.log("     " + l));

    // Navigate to RFQ search
    console.log("\n3. Navigating to RFQ search...");
    const rfqLink = page.locator('a:has-text("Requests for Quotation"), a:has-text("RFQ")').first();
    if (await rfqLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rfqLink.click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(DIR, "06-rfq-page.png"), fullPage: true });
      console.log("   URL:", page.url());
      console.log("   Title:", await page.title());

      // List all visible inputs and selects
      const formElements = await page.locator("input:visible, select:visible").all();
      for (const el of formElements) {
        const tag = await el.evaluate(e => e.tagName);
        const name = await el.getAttribute("name").catch(() => "");
        const id = await el.getAttribute("id").catch(() => "");
        const type = await el.getAttribute("type").catch(() => "");
        console.log(`     <${tag}> name="${name}" type="${type}" id="${id}"`);
      }
    }

    // Also try the search box on the home page
    console.log("\n4. Testing home page search with FSC 6515...");
    await page.goto(DIBBS_BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // The home page search: txtValue + butDbSearch
    await page.fill('#ctl00_txtValue', '6515');
    await page.screenshot({ path: join(DIR, "07-search-filled.png") });
    await page.click('#ctl00_butDbSearch');
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(DIR, "08-search-results.png"), fullPage: true });
    console.log("   URL:", page.url());
    console.log("   Title:", await page.title());

    // Check if there are results
    const bodyText = await page.textContent("body").catch(() => "");
    console.log("   Page text preview:", bodyText?.substring(0, 300));

  } catch (err) {
    console.error("Error:", err);
    await page.screenshot({ path: join(DIR, "error.png") }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log("\nScreenshots in data/dibbs-screenshots/");
}

main().catch(console.error);
