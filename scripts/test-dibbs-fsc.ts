/**
 * Search DIBBS RFQs by FSC — using the correct form fields.
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
    await page.click("#butAgree");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    // Go to RFQ page
    await page.goto("https://www.dibbs.bsm.dla.mil/RFQ/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Select "Federal Supply Class" category
    console.log("1. Selecting FSC category...");
    await page.selectOption("#ctl00_cph1_ddlCategory", "Federal Supply Class");
    await page.waitForTimeout(1000);

    // Now find ALL inputs/textareas including dynamic ones
    const allInputs = await page.locator("input, textarea").all();
    console.log("   All form elements after category change:");
    for (const el of allInputs) {
      const visible = await el.isVisible().catch(() => false);
      if (!visible) continue;
      const tag = await el.evaluate(e => e.tagName);
      const name = await el.getAttribute("name").catch(() => "");
      const id = await el.getAttribute("id").catch(() => "");
      const type = await el.getAttribute("type").catch(() => "");
      const value = await el.inputValue().catch(() => "");
      console.log(`     <${tag}> name="${name}" id="${id}" type="${type}" val="${value?.substring(0, 30)}"`);
    }

    // The search value field is likely txtDbValue or similar
    console.log("\n2. Filling FSC value...");
    // Try multiple possible selectors for the search value
    const valueSelectors = [
      "#ctl00_cph1_txtDbValue",
      "textarea[name*='txtDbValue']",
      "input[name*='txtDbValue']",
      "#ctl00_cph1_txtValue",
      "textarea[name*='Value']:visible",
    ];

    let filled = false;
    for (const sel of valueSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.fill("6515");
        console.log("   Filled:", sel);
        filled = true;
        break;
      }
    }

    if (!filled) {
      // Try filling the top-level search with the database search approach
      console.log("   Trying top search bar with category...");
      await page.fill("#ctl00_txtValue", "6515");
      // Use the database search button next to the search bar
      const btns = await page.locator("input[type='submit']:visible, input[type='button']:visible").all();
      for (const btn of btns) {
        const val = await btn.getAttribute("value").catch(() => "");
        const name = await btn.getAttribute("name").catch(() => "");
        console.log(`     Button: name="${name}" value="${val}"`);
      }
    }

    await page.screenshot({ path: join(DIR, "30-before-search.png"), fullPage: true });

    // Click the Search button (the one in the RFQ section, not the nav)
    console.log("\n3. Clicking search...");
    const searchBtn = page.locator("#ctl00_cph1_butDbSearch, input[value='Search']:visible, input[value='SEARCH']:visible").first();
    if (await searchBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchBtn.click();
    } else {
      await page.click("#ctl00_cph1_butDbGo");
    }

    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000);
    await page.screenshot({ path: join(DIR, "31-results.png"), fullPage: true });
    console.log("   URL:", page.url());

    // Look for result links
    const allAnchors = await page.locator("a").all();
    let resultCount = 0;
    for (const a of allAnchors) {
      const href = await a.getAttribute("href").catch(() => "");
      const text = await a.textContent().catch(() => "");
      if (href?.includes("RfqDetail") || href?.includes("rfqdetail") || (text && /^SPE/.test(text.trim()))) {
        if (resultCount < 15) console.log("   " + text?.trim() + " → " + href);
        resultCount++;
      }
    }
    console.log(`\n   Total solicitation links found: ${resultCount}`);

    if (resultCount === 0) {
      // Try the direct FSC link instead
      console.log("\n4. Trying direct FSC link...");
      const fscLink = page.locator('a:has-text("Federal Supply Class"), a:has-text("FSC")').first();
      if (await fscLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fscLink.click();
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(3000);
        await page.screenshot({ path: join(DIR, "32-fsc-direct.png"), fullPage: true });
        console.log("   URL:", page.url());

        // Dump visible text
        const text = await page.locator("body").innerText().catch(() => "");
        console.log("   Text preview:", text?.substring(0, 600));
      }
    }

    writeFileSync(join(DIR, "results.html"), await page.content());

  } catch (err) {
    console.error("Error:", err);
    await page.screenshot({ path: join(DIR, "error.png") }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log("\nDone.");
}

main().catch(console.error);
