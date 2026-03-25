/**
 * Full app audit — screenshots every page, tests buttons, validates functionality.
 * Run: npx tsx scripts/audit-app.ts
 */
import { chromium, type Page } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const DIR = join(__dirname, "..", "data", "audit-screenshots");
const EMAIL = "ssokol@everreadygroup.com";
const PASSWORD = "D1bs-Admin-2026!";

let screenshotNum = 0;
async function shot(page: Page, name: string) {
  screenshotNum++;
  const filename = `${String(screenshotNum).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: join(DIR, filename), fullPage: true });
  console.log(`  📸 ${filename}`);
}

async function main() {
  mkdirSync(DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(15000);

  const issues: string[] = [];

  // ============ LOGIN ============
  console.log("\n=== LOGIN PAGE ===");
  await page.goto(BASE);
  await page.waitForTimeout(1000);
  await shot(page, "login-page");

  // Check it redirected to /login
  if (!page.url().includes("/login")) {
    issues.push("❌ Not redirected to /login when unauthenticated");
  } else {
    console.log("  ✅ Redirects to /login");
  }

  // Check forgot password link
  const forgotLink = page.locator('a[href*="forgot"]');
  if (await forgotLink.isVisible().catch(() => false)) {
    console.log("  ✅ Forgot password link visible");
  } else {
    issues.push("❌ Forgot password link not found");
  }

  // Test login
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await shot(page, "login-filled");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  // Check if we're still on login or redirected
  const postLoginUrl = page.url();
  await shot(page, "after-login");

  if (postLoginUrl.includes("/login") && !postLoginUrl.includes("set-password")) {
    // Try navigating directly — cookies might be set
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    if (page.url().includes("/login")) {
      issues.push("❌ Login failed — still on login page");
      console.log("  ❌ Login failed, URL:", page.url());
      await browser.close();
      printResults(issues);
      return;
    }
  }
  console.log("  ✅ Login successful, URL:", page.url());

  // ============ DASHBOARD ============
  console.log("\n=== DASHBOARD ===");
  await page.goto(BASE);
  await page.waitForTimeout(2000);
  await shot(page, "dashboard");

  // Check stat cards
  const statCards = await page.locator(".rounded-xl").count();
  console.log(`  Stats/cards: ${statCards}`);

  // Check sidebar (desktop)
  const sidebarNav = page.locator('a[href="/solicitations"]').first();
  if (await sidebarNav.isVisible().catch(() => false)) {
    console.log("  ✅ Sidebar navigation visible");
  } else {
    issues.push("❌ Sidebar navigation not visible on dashboard");
    // Take debug screenshot
    await shot(page, "debug-no-sidebar");
    console.log("  Current URL:", page.url());
  }

  // Check bug reporter button
  const bugBtn = page.locator('button[title="Report a Bug"]');
  if (await bugBtn.isVisible().catch(() => false)) {
    console.log("  ✅ Bug reporter button visible");
  } else {
    issues.push("⚠️ Bug reporter button not visible");
  }

  // ============ SOLICITATIONS ============
  console.log("\n=== SOLICITATIONS ===");
  await page.goto(BASE + '/solicitations');
  await page.waitForTimeout(2000);
  await shot(page, "solicitations");

  // Check pipeline stats
  const pipelineStats = await page.locator("button .text-2xl").count();
  console.log(`  Pipeline stat buttons: ${pipelineStats}`);

  // Check Scrape Now button
  const scrapeBtn = page.locator('text=Scrape Now');
  if (await scrapeBtn.isVisible().catch(() => false)) {
    console.log("  ✅ 'Scrape Now' button visible");
  } else {
    issues.push("❌ 'Scrape Now' button not found on solicitations page");
  }

  // Check Match NSNs button
  const enrichBtn = page.locator('text=Match NSNs');
  if (await enrichBtn.isVisible().catch(() => false)) {
    console.log("  ✅ 'Match NSNs' button visible");
  } else {
    issues.push("❌ 'Match NSNs' button not found");
  }

  // Check filter tabs
  for (const tab of ["Sourceable", "Quoted", "Submitted", "Skipped", "All"]) {
    const btn = page.locator(`text=${tab}`).first();
    if (await btn.isVisible().catch(() => false)) {
      console.log(`  ✅ '${tab}' filter tab visible`);
    } else {
      issues.push(`⚠️ '${tab}' filter tab not found`);
    }
  }

  // ============ ORDERS ============
  console.log("\n=== ORDERS ===");
  await page.goto(BASE + '/orders');
  await page.waitForTimeout(2000);
  await shot(page, "orders");

  const orderRows = await page.locator("table tbody tr").count();
  console.log(`  Order rows: ${orderRows}`);
  if (orderRows === 0) {
    issues.push("⚠️ Orders page has no data rows");
  }

  // ============ PURCHASE ORDERS ============
  console.log("\n=== PURCHASE ORDERS ===");
  await page.goto(BASE + '/purchase-orders');
  await page.waitForTimeout(1000);
  await shot(page, "purchase-orders");

  // ============ SHIPPING ============
  console.log("\n=== SHIPPING ===");
  await page.goto(BASE + '/shipping');
  await page.waitForTimeout(1000);
  await shot(page, "shipping");

  // ============ INVOICING ============
  console.log("\n=== INVOICING ===");
  await page.goto(BASE + '/invoicing');
  await page.waitForTimeout(1000);
  await shot(page, "invoicing");

  // ============ ANALYTICS ============
  console.log("\n=== ANALYTICS ===");
  await page.goto(BASE + '/analytics');
  await page.waitForTimeout(2000);
  await shot(page, "analytics");

  // Check FSC heatmap
  const heatmapRows = await page.locator("table tbody tr").count();
  console.log(`  Heatmap/table rows: ${heatmapRows}`);

  // ============ SETTINGS ============
  console.log("\n=== SETTINGS ===");
  await page.goto(BASE + '/settings');
  await page.waitForTimeout(1000);
  await shot(page, "settings");

  // Check sub-pages
  const settingsLinks = ["Suppliers", "FSC", "Import", "Address"];
  for (const link of settingsLinks) {
    const el = page.locator(`a:has-text("${link}")`).first();
    if (await el.isVisible().catch(() => false)) {
      console.log(`  ✅ '${link}' settings link visible`);
    }
  }

  // ============ FORGOT PASSWORD ============
  console.log("\n=== FORGOT PASSWORD ===");
  await page.goto(`${BASE}/login/forgot-password`);
  await page.waitForTimeout(1000);
  await shot(page, "forgot-password");

  const resetInput = page.locator('input[type="email"]');
  if (await resetInput.isVisible().catch(() => false)) {
    console.log("  ✅ Email input visible");
  } else {
    issues.push("❌ Forgot password email input not found");
  }

  // ============ MOBILE VIEW ============
  console.log("\n=== MOBILE VIEW ===");
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
  await page.goto(BASE);
  await page.waitForTimeout(2000);
  await shot(page, "mobile-dashboard");

  // Check hamburger menu
  const hamburger = page.locator('button svg.lucide-menu, button:has(svg)').first();
  const mobileHeader = page.locator("text=DIBS").first();
  if (await mobileHeader.isVisible().catch(() => false)) {
    console.log("  ✅ Mobile header visible");
  } else {
    issues.push("⚠️ Mobile header not visible");
  }

  // Open hamburger
  const menuBtn = page.locator("button").filter({ has: page.locator("svg") }).first();
  await menuBtn.click().catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, "mobile-menu-open");

  // Navigate to solicitations on mobile
  await page.click('a:has-text("Solicitations")');
  await page.waitForTimeout(2000);
  await shot(page, "mobile-solicitations");

  // Navigate to analytics on mobile
  await page.goto(`${BASE}/analytics`);
  await page.waitForTimeout(2000);
  await shot(page, "mobile-analytics");

  // ============ BUG REPORTER ============
  console.log("\n=== BUG REPORTER ===");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE);
  await page.waitForTimeout(2000);

  const bugButton = page.locator('button[title="Report a Bug"]');
  if (await bugButton.isVisible().catch(() => false)) {
    await bugButton.click();
    await page.waitForTimeout(2000);
    await shot(page, "bug-reporter-modal");

    // Check form elements
    const descField = page.locator('textarea[name="description"]');
    const typeField = page.locator('select[name="type"]');
    const priorityField = page.locator('select[name="priority"]');
    const submitBtn = page.locator('button:has-text("Submit Report")');

    if (await descField.isVisible().catch(() => false)) console.log("  ✅ Description field");
    else issues.push("❌ Bug reporter description field not found");

    if (await typeField.isVisible().catch(() => false)) console.log("  ✅ Type dropdown");
    else issues.push("❌ Bug reporter type dropdown not found");

    if (await priorityField.isVisible().catch(() => false)) console.log("  ✅ Priority dropdown");
    else issues.push("❌ Bug reporter priority dropdown not found");

    if (await submitBtn.isVisible().catch(() => false)) console.log("  ✅ Submit button");
    else issues.push("❌ Bug reporter submit button not found");

    // Check screenshot
    const screenshotImg = page.locator('#bug-screenshot, img[alt="Screenshot"]');
    if (await screenshotImg.isVisible().catch(() => false)) {
      console.log("  ✅ Screenshot captured");
    } else {
      issues.push("⚠️ Bug reporter screenshot not captured");
    }

    // Close modal
    await page.locator('button:has-text("×")').click().catch(() => {});
  }

  // ============ LOGOUT ============
  console.log("\n=== LOGOUT ===");
  const logoutBtn = page.locator('button[title="Sign out"]');
  if (await logoutBtn.isVisible().catch(() => false)) {
    console.log("  ✅ Logout button visible");
    await logoutBtn.click();
    await page.waitForTimeout(2000);
    await shot(page, "after-logout");
    if (page.url().includes("/login")) {
      console.log("  ✅ Redirected to login after logout");
    } else {
      issues.push("❌ Not redirected after logout");
    }
  } else {
    issues.push("❌ Logout button not found");
  }

  await browser.close();
  printResults(issues);
}

function printResults(issues: string[]) {
  console.log("\n" + "=".repeat(60));
  console.log("AUDIT COMPLETE — " + screenshotNum + " screenshots taken");
  console.log("=".repeat(60));

  if (issues.length === 0) {
    console.log("\n✅ All checks passed!");
  } else {
    console.log(`\n${issues.length} issues found:\n`);
    issues.forEach((i) => console.log("  " + i));
  }

  console.log(`\nScreenshots saved to data/audit-screenshots/`);
}

main().catch(console.error);
