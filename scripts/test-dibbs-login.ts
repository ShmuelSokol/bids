/**
 * Test DIBBS login — connect, accept consent, log in, screenshot each step.
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const DIBBS_BASE = "https://www.dibbs.bsm.dla.mil";
const USERNAME = process.env.DIBBS_USERNAME || "";
const PASSWORD = "REDACTED";
const DIR = join(__dirname, "..", "data", "dibbs-screenshots");

async function main() {
  mkdirSync(DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    // Step 1: Landing page
    console.log("1. Navigating to DIBBS...");
    await page.goto(DIBBS_BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.screenshot({ path: join(DIR, "01-consent.png") });
    console.log("   URL:", page.url());

    // Step 2: Click OK on consent banner
    console.log("2. Clicking OK on consent banner...");
    await page.click('#butAgree, input[name="butAgree"], input[value="OK"]');
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(DIR, "02-after-consent.png"), fullPage: true });
    console.log("   URL:", page.url());
    console.log("   Title:", await page.title());

    // Log visible inputs
    const inputs = await page.locator("input:visible").all();
    console.log("   Visible inputs:", inputs.length);
    for (const input of inputs) {
      const name = await input.getAttribute("name").catch(() => "");
      const type = await input.getAttribute("type").catch(() => "");
      const id = await input.getAttribute("id").catch(() => "");
      console.log(`     name="${name}" type="${type}" id="${id}"`);
    }

    // Step 3: Fill login form
    console.log("3. Looking for login fields...");
    const userField = page.locator('input[type="text"]:visible, input[name*="user" i]:visible, input[name*="User" i]:visible').first();
    const passField = page.locator('input[type="password"]:visible').first();

    if (await userField.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("   Found login form, filling...");
      await userField.fill(USERNAME);
      await passField.fill(PASSWORD);
      await page.screenshot({ path: join(DIR, "03-filled.png") });

      // Click login/submit
      const submitBtn = page.locator('input[type="submit"]:visible, button[type="submit"]:visible').first();
      console.log("4. Submitting login...");
      await submitBtn.click();
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await page.waitForTimeout(3000);
      await page.screenshot({ path: join(DIR, "04-after-login.png"), fullPage: true });
      console.log("   URL:", page.url());
      console.log("   Title:", await page.title());

      // Check for success
      const text = await page.textContent("body").catch(() => "");
      const success = text?.includes("Welcome") || text?.includes("Solicitation") || text?.includes("RFQ") || text?.includes("Home");
      const failed = text?.includes("invalid") || text?.includes("Invalid") || text?.includes("incorrect") || text?.includes("denied");

      if (success) console.log("\n   LOGIN SUCCESS!");
      else if (failed) console.log("\n   LOGIN FAILED");
      else console.log("\n   STATUS UNCLEAR — check screenshot 04-after-login.png");

      // Take one more screenshot in case there's a redirect
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(DIR, "05-final.png"), fullPage: true });
      console.log("   Final URL:", page.url());
    } else {
      console.log("   No login form found — check screenshot 02-after-consent.png");
    }
  } catch (err) {
    console.error("Error:", err);
    await page.screenshot({ path: join(DIR, "error.png") }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log("\nScreenshots in data/dibbs-screenshots/");
}

main().catch(console.error);
