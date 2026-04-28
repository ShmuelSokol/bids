/** Extract the CLIN table from DIBBS Package View.
 *   npx tsx scripts/_probe-dibbs-clin-table.ts SPE2DS-26-T-021R
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require("playwright");

(async () => {
  const SOL = process.argv[2] || "SPE2DS-26-T-021R";
  const cleanSol = SOL.replace(/-/g, "");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto("https://www.dibbs.bsm.dla.mil/dodwarning.aspx?goto=/", { waitUntil: "domcontentloaded" });
  const agree = await page.$("#butAgree");
  if (agree) await agree.click();
  await page.waitForLoadState("networkidle").catch(() => {});

  const url = `https://www.dibbs.bsm.dla.mil/rfq/rfqrec.aspx?sn=${cleanSol}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  // Get all rows of table 2 (the CLIN table)
  const rows = await page.evaluate(() => {
    const tables = document.querySelectorAll("table");
    if (tables.length < 3) return null;
    const t = tables[2];
    return Array.from(t.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.querySelectorAll("th, td")).map((c) => (c as HTMLElement).innerText.replace(/\s+/g, " ").trim())
    );
  });
  if (!rows) { console.log("no table[2]"); await browser.close(); return; }

  console.log("CLIN table rows:");
  for (const r of rows) console.log("  |", r.join(" | "));

  // Sum quantities — find the Qty column
  const headers = rows[0];
  const qtyIdx = headers.findIndex((h: string) => /qty|quantity/i.test(h));
  if (qtyIdx >= 0) {
    let total = 0;
    for (const r of rows.slice(1)) {
      const v = r[qtyIdx]?.replace(/[^\d]/g, "");
      total += parseInt(v || "0", 10);
    }
    console.log(`\nQty column: ${qtyIdx} ("${headers[qtyIdx]}")`);
    console.log(`Total qty across all CLINs: ${total}`);
  }

  await browser.close();
})();
