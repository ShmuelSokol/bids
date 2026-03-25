/**
 * Search DIBBS RFQs by FSC code using the proper search form.
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
    await page.goto(DIBBS_BASE, { waitUntil: "domcontentloaded" });
    await page.click('#butAgree');
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    // Go to RFQ page
    await page.goto("https://www.dibbs.bsm.dla.mil/RFQ/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Check dropdown options
    const categoryOpts = await page.locator("#ctl00_cph1_ddlCategory option").allTextContents();
    console.log("Category options:", categoryOpts);

    const scopeOpts = await page.locator("#ctl00_cph1_ddlScope option").allTextContents();
    console.log("Scope options:", scopeOpts);

    // Select FSC scope and search for 6515
    console.log("\nSearching for FSC 6515...");
    await page.selectOption("#ctl00_cph1_ddlScope", { label: scopeOpts.find(o => o.includes("FSC")) || scopeOpts[0] });
    await page.selectOption("#ctl00_cph1_ddlCategory", { label: categoryOpts.find(o => o.includes("6515")) || "6515" }).catch(() => {
      // Category might be a text input, not a dropdown of FSCs
    });

    // Take screenshot of form state
    await page.screenshot({ path: join(DIR, "10-rfq-form.png"), fullPage: true });

    // The search might use the top search bar instead
    await page.fill("#ctl00_txtValue", "6515");
    await page.click("#ctl00_cph1_butDbGo");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(DIR, "11-rfq-results.png"), fullPage: true });
    console.log("URL:", page.url());
    console.log("Title:", await page.title());

    // Check for results table
    const tables = await page.locator("table").all();
    console.log("Tables found:", tables.length);

    // Look for data grid
    const gridRows = await page.locator("tr").all();
    console.log("Total rows:", gridRows.length);

    // Get text from first few data rows
    const dataRows = await page.locator("table tr").all();
    console.log("\nFirst 10 rows:");
    for (let i = 0; i < Math.min(10, dataRows.length); i++) {
      const cells = await dataRows[i].locator("td, th").allTextContents();
      if (cells.length > 2) {
        console.log("  " + cells.map(c => c.trim()).filter(c => c).join(" | "));
      }
    }

    // Save the page HTML for deeper analysis
    const html = await page.content();
    writeFileSync(join(DIR, "rfq-results.html"), html);
    console.log("\nSaved full HTML to rfq-results.html");

  } catch (err) {
    console.error("Error:", err);
    await page.screenshot({ path: join(DIR, "error.png") }).catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
