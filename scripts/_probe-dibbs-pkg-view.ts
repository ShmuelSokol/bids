/** Hit the DIBBS Package View directly + dump the CLIN-relevant section.
 *   npx tsx scripts/_probe-dibbs-pkg-view.ts SPE2DS-26-T-021R
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

  // Package View
  const url = `https://www.dibbs.bsm.dla.mil/rfq/rfqrec.aspx?sn=${cleanSol}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const html = await page.content();
  writeFileSync("C:/tmp/dibbs-pkg.html", html, "utf-8");
  console.log(`saved ${html.length} bytes to C:/tmp/dibbs-pkg.html`);

  // CLIN rows usually have "0001", "0002", "0003" etc. Look for them
  const clinPattern = /\b00[0-9][0-9]\b/g;
  const matches = (html.match(clinPattern) || []).slice(0, 30);
  console.log("CLIN-shaped tokens found:", new Set(matches).size, "unique");

  // Look for table headers
  const tables = await page.locator("table").evaluateAll((els: Element[]) =>
    els.map((t) => {
      const headers = Array.from(t.querySelectorAll("th, thead td")).map((h) => h.textContent?.trim());
      const firstRow = t.querySelector("tr td")?.textContent?.trim().slice(0, 100);
      const rowCount = t.querySelectorAll("tr").length;
      return { headers: headers.slice(0, 10), firstRow, rowCount };
    })
  );
  console.log("\n--- tables on page ---");
  for (const [i, t] of tables.entries()) {
    console.log(`table ${i}: rows=${t.rowCount}, headers=${JSON.stringify(t.headers)}`);
  }

  // Try to find CLIN-specific selectors that match DLA conventions
  const clinTextSearches = ["CLIN", "Item", "Quantity", "Qty", "U/I", "UoM", "Unit Issue", "FOB", "Destination"];
  for (const term of clinTextSearches) {
    const count = await page.locator(`text=${term}`).count();
    if (count > 0) console.log(`"${term}" appears ${count}x`);
  }

  await browser.close();
})();
