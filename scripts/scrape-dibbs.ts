#!/usr/bin/env npx tsx
/**
 * DIBBS Scraper — Standalone Script
 *
 * Run directly: npx tsx scripts/scrape-dibbs.ts
 * Or via npm:   npm run scrape:dibbs
 *
 * Environment variables (or edit defaults below):
 *   DIBBS_USERNAME — your DIBBS login
 *   DIBBS_PASSWORD — your DIBBS password
 *   DIBBS_CAGE     — your cage code (default: 0AG09)
 *
 * Actions:
 *   --solicitations  Scrape open solicitations for configured FSC codes
 *   --awards         Scrape recent awards for our cage code
 *   --batch          Download the batch quote CSV file
 *   --competitors    Scrape awards for competitor cage codes
 *   --all            Run everything
 */

import { scrapeSolicitations, scrapeAwards, downloadBatchFile, closeBrowser } from "../src/lib/dibbs-scraper";
import { promises as fs } from "fs";
import path from "path";

// ─── Configuration ──────────────────────────────────────────

const DIBBS_USERNAME = process.env.DIBBS_USERNAME || "";
const DIBBS_PASSWORD = process.env.DIBBS_PASSWORD || "";
const OUR_CAGE = process.env.DIBBS_CAGE || "0AG09";

// FSC codes we're currently bidding on (add more as we expand)
const OUR_FSC_CODES = [
  "6505", "6508", "6510", "6515", "6520", "6525", "6530", "6532",
  "6540", "6545", "6550", "6605", "6640", "6685", "6810",
  "4110", "4240", "4510", "4610",
  "5120", "5130", "5305", "5306", "5310", "5330",
  "6135", "6140", "6210",
  "7310", "7510", "7920", "7930",
  "8105", "8520", "8540",
];

// Competitor cage codes to monitor
const COMPETITOR_CAGES = [
  { cage: "6P7Q8", name: "VWR International" },
  { cage: "ADS01", name: "Atlantic Diving Supply" },
  { cage: "MDS01", name: "Midland Scientific" },
  { cage: "5R6S7", name: "North American Rescue" },
  { cage: "8T9U0", name: "United Spirit" },
];

const OUTPUT_DIR = path.join(process.cwd(), "data", "dibbs-scrapes");

// ─── Main ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (!DIBBS_USERNAME || !DIBBS_PASSWORD) {
    console.error("ERROR: Set DIBBS_USERNAME and DIBBS_PASSWORD environment variables");
    console.error("  Example: DIBBS_USERNAME=myuser DIBBS_PASSWORD=mypass npx tsx scripts/scrape-dibbs.ts --all");
    process.exit(1);
  }

  const creds = { username: DIBBS_USERNAME, password: DIBBS_PASSWORD };
  const runAll = args.includes("--all") || args.length === 0;

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().slice(0, 10);

  console.log("========================================");
  console.log("  DIBBS Scraper");
  console.log("  " + new Date().toLocaleString());
  console.log("========================================\n");

  // ─── Solicitations ─────────────────────────────────────
  if (runAll || args.includes("--solicitations")) {
    console.log(`Scraping solicitations for ${OUR_FSC_CODES.length} FSC codes...`);
    console.log(`  FSC codes: ${OUR_FSC_CODES.slice(0, 10).join(", ")}...`);

    const result = await scrapeSolicitations(creds, OUR_FSC_CODES);

    console.log(`  Found: ${result.data.length} solicitations`);
    console.log(`  Errors: ${result.errors.length}`);
    console.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);

    if (result.data.length > 0) {
      const outFile = path.join(OUTPUT_DIR, `solicitations_${timestamp}.json`);
      await fs.writeFile(outFile, JSON.stringify(result, null, 2));
      console.log(`  Saved to: ${outFile}`);
    }

    if (result.errors.length > 0) {
      console.log("  Errors:");
      result.errors.forEach(e => console.log(`    - ${e}`));
    }
    console.log();
  }

  // ─── Our Awards ────────────────────────────────────────
  if (runAll || args.includes("--awards")) {
    console.log(`Scraping our awards (cage: ${OUR_CAGE}, last 15 days)...`);

    const result = await scrapeAwards(creds, OUR_CAGE, 15);

    console.log(`  Found: ${result.data.length} awards`);
    console.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);

    if (result.data.length > 0) {
      const outFile = path.join(OUTPUT_DIR, `our_awards_${timestamp}.json`);
      await fs.writeFile(outFile, JSON.stringify(result, null, 2));
      console.log(`  Saved to: ${outFile}`);
    }
    console.log();
  }

  // ─── Batch Quote File ─────────────────────────────────
  if (runAll || args.includes("--batch")) {
    console.log("Attempting to download batch quote file...");

    const result = await downloadBatchFile(creds);

    if (result.success && result.csvContent) {
      const outFile = path.join(OUTPUT_DIR, `batch_quotes_${timestamp}.csv`);
      await fs.writeFile(outFile, result.csvContent);
      console.log(`  Success! Saved to: ${outFile}`);
      console.log(`  File size: ${result.csvContent.length} bytes`);
    } else {
      console.log(`  Failed: ${result.error}`);
    }
    console.log();
  }

  // ─── Competitor Awards ────────────────────────────────
  if (runAll || args.includes("--competitors")) {
    console.log(`Scraping competitor awards (${COMPETITOR_CAGES.length} competitors)...`);

    for (const comp of COMPETITOR_CAGES) {
      console.log(`  ${comp.name} (${comp.cage})...`);
      const result = await scrapeAwards(creds, comp.cage, 15);
      console.log(`    Found: ${result.data.length} awards`);

      if (result.data.length > 0) {
        const outFile = path.join(OUTPUT_DIR, `competitor_${comp.cage}_${timestamp}.json`);
        await fs.writeFile(outFile, JSON.stringify(result, null, 2));
      }

      // Rate limiting between competitors
      await new Promise(r => setTimeout(r, 3000));
    }
    console.log();
  }

  // ─── Summary ──────────────────────────────────────────
  console.log("========================================");
  console.log("  Scrape complete!");
  console.log(`  Output: ${OUTPUT_DIR}`);
  console.log("========================================");

  await closeBrowser();
}

main().catch(err => {
  console.error("Fatal error:", err);
  closeBrowser().then(() => process.exit(1));
});
