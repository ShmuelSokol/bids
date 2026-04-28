/**
 * Scrape per-CLIN data from DIBBS Package View for one solicitation
 * and write to dibbs_sol_clins. Used to fix the multi-CLIN qty gap
 * where LL's own scraper only captures the first CLIN's qty (e.g.
 * SPE2DS-26-T-021R was 6 CLINs / 318 EA but DIBS showed 1 CLIN / 18 EA).
 *
 *   npx tsx scripts/scrape-dibbs-clins.ts --sol SPE2DS-26-T-021R
 *
 * The DIBBS Package View URL is:
 *   https://www.dibbs.bsm.dla.mil/rfq/rfqrec.aspx?sn=<sol-no-no-dashes>
 *
 * The CLIN table is the third <table> on that page; columns are:
 *   #  |  NSN/Part No.  |  Nomenclature  |  Technical Documents  |  Purchase Request QTY
 *
 * "Purchase Request QTY" cells look like "<10-digit PR number> Qty: <integer>".
 *
 * Future: parse FOB / destination from elsewhere on the page (we don't grab
 * those today; not blocking for the qty-correction use case). Could be added
 * with a second pass on the same loaded page.
 */
import "./env";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require("playwright");
import { createClient } from "@supabase/supabase-js";

interface ClinRow {
  sol_no: string;
  clin_no: string;
  nsn: string | null;
  fsc: string | null;
  niin: string | null;
  qty: number;
  uom: string | null;
  raw_html_snippet: string;
}

async function scrapeOne(sol: string): Promise<ClinRow[]> {
  const cleanSol = sol.replace(/-/g, "").toUpperCase();
  const browser = await chromium.launch({ headless: true });
  try {
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

    // Extract the CLIN table (3rd table on the page)
    const data = await page.evaluate(() => {
      const tables = document.querySelectorAll("table");
      if (tables.length < 3) return null;
      const t = tables[2];
      const rowsHtml: string[] = [];
      const rows: string[][] = [];
      for (const tr of Array.from(t.querySelectorAll("tr"))) {
        rowsHtml.push((tr as HTMLElement).outerHTML);
        rows.push(Array.from(tr.querySelectorAll("th, td")).map((c) => (c as HTMLElement).innerText.replace(/\s+/g, " ").trim()));
      }
      return { rows, rowsHtml };
    });
    if (!data || data.rows.length < 2) return [];

    const headers = data.rows[0];
    const dataRows = data.rows.slice(1);
    const dataHtml = data.rowsHtml.slice(1);

    const idxNum = headers.findIndex((h: string) => /^#/.test(h.trim()));
    const idxNsn = headers.findIndex((h: string) => /NSN|Part/i.test(h));
    const idxQty = headers.findIndex((h: string) => /Qty|Quantity/i.test(h));

    const out: ClinRow[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const clin_no = idxNum >= 0 ? r[idxNum]?.trim() : String(i + 1);
      const nsnRaw = idxNsn >= 0 ? r[idxNsn]?.trim() : "";
      const qtyRaw = idxQty >= 0 ? r[idxQty]?.trim() : "";

      // qty cell looks like "7016504021 Qty: 2" — pull the number after Qty:
      const qtyMatch = qtyRaw.match(/Qty:\s*(\d+)/i);
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 0;

      // NSN format from DIBBS is "FSC-NIIN" with dashes (e.g. 6510-01-581-0553)
      const nsnMatch = nsnRaw.match(/(\d{4})-(\d{2}-\d{3}-\d{4})/);
      const fsc = nsnMatch ? nsnMatch[1] : null;
      const niin = nsnMatch ? nsnMatch[2] : null;
      const nsn = nsnMatch ? `${fsc}-${niin}` : nsnRaw || null;

      out.push({
        sol_no: sol.toUpperCase(),
        clin_no: clin_no || String(i + 1),
        nsn,
        fsc,
        niin,
        qty,
        uom: null, // not in package-view CLIN table; could be parsed elsewhere
        raw_html_snippet: dataHtml[i].slice(0, 4000),
      });
    }
    return out;
  } finally {
    await browser.close();
  }
}

async function main() {
  const idx = process.argv.indexOf("--sol");
  if (idx < 0) { console.error("Usage: --sol <sol_number>"); process.exit(1); }
  const sol = process.argv[idx + 1];
  if (!sol) { console.error("missing sol value"); process.exit(1); }

  console.log(`Scraping CLINs for ${sol}...`);
  const clins = await scrapeOne(sol);
  if (clins.length === 0) {
    console.log("No CLINs found (sol may be closed, no longer on DIBBS, or page structure changed).");
    process.exit(0);
  }

  console.log(`Found ${clins.length} CLINs:`);
  let total = 0;
  for (const c of clins) {
    console.log(`  CLIN ${c.clin_no}: NSN=${c.nsn} qty=${c.qty}`);
    total += c.qty;
  }
  console.log(`Total qty across all CLINs: ${total}`);

  // Upsert
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const rows = clins.map((c) => ({
    sol_no: c.sol_no,
    clin_no: c.clin_no,
    nsn: c.nsn,
    fsc: c.fsc,
    niin: c.niin,
    qty: c.qty,
    uom: c.uom,
    raw_html_snippet: c.raw_html_snippet,
    scraped_at: new Date().toISOString(),
  }));
  const { error } = await sb.from("dibbs_sol_clins").upsert(rows, { onConflict: "sol_no,clin_no" });
  if (error) { console.error("upsert failed:", error.message); process.exit(2); }
  console.log(`✓ wrote ${rows.length} CLIN rows`);
}

main().catch((e) => { console.error(e); process.exit(1); });
