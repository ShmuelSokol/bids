/** Use Playwright to load DIBBS for a multi-CLIN sol, save the rendered
 *  HTML so we can see what the per-CLIN structure looks like.
 *   npx tsx scripts/_probe-dibbs-clin-structure.ts
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require("playwright");
import { writeFileSync } from "fs";

(async () => {
  const SOL = process.argv[2] || "SPE2DS-26-T-021R";
  const cleanSol = SOL.replace(/-/g, "");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Accept consent
  await page.goto("https://www.dibbs.bsm.dla.mil/dodwarning.aspx?goto=/", { waitUntil: "domcontentloaded" });
  const agree = await page.$("#butAgree");
  if (agree) await agree.click();
  await page.waitForLoadState("networkidle").catch(() => {});

  // Search by sol
  const url = `https://www.dibbs.bsm.dla.mil/Rfq/RfqRecs.aspx?category=SOL&value=${cleanSol}&scope=open`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const html = await page.content();
  writeFileSync("C:/tmp/dibbs-sol.html", html, "utf-8");
  console.log(`saved ${html.length} bytes to C:/tmp/dibbs-sol.html`);

  // Find rows containing the sol
  const rowCount = await page.locator(`tr:has-text("${cleanSol}")`).count();
  console.log(`rows with sol: ${rowCount}`);

  // Find any links going to per-sol detail
  const links = await page.locator(`a[href*="${cleanSol}"]`).evaluateAll((els: Element[]) =>
    els.map((e) => ({ href: (e as HTMLAnchorElement).href, text: e.textContent?.trim().slice(0, 80) }))
  );
  console.log("links containing sol:");
  for (const l of links.slice(0, 10)) console.log(" ", l.href, "→", l.text);

  // Also look for any href containing "View" or "Pkg"
  const detailLinks = await page.locator('a[href*="Aspx"], a[href*="aspx"]').evaluateAll((els: Element[]) =>
    els.map((e) => (e as HTMLAnchorElement).href).filter((h) => /Pkg|Detail|View|Item|Clin/i.test(h)).slice(0, 20)
  );
  console.log("possible detail links:", detailLinks);

  // Print all visible text in rows that mention the sol
  const rowTexts = await page.locator(`tr:has-text("${cleanSol}")`).evaluateAll((els: Element[]) =>
    els.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, " ").trim().slice(0, 400))
  );
  console.log("\n--- row text(s) ---");
  for (const t of rowTexts) console.log(t);

  await browser.close();
})();
