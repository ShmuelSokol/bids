/**
 * Pull all DLA awards from USASpending.gov for the last 6 months.
 * Uses the paginated search API with award detail lookups for key fields.
 * Saves to data/usaspending/dla-awards-6mo.json
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(__dirname, "..", "data", "usaspending");
const SEARCH_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/";

// Last 6 months
const endDate = new Date().toISOString().split("T")[0];
const startDate = new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0];

const PAGE_SIZE = 100; // max allowed

interface Award {
  internal_id: number;
  "Award ID": string;
  "Recipient Name": string;
  "Award Amount": number;
  Description: string;
  "Start Date": string;
  "End Date": string;
  "Awarding Sub Agency": string;
  "Award Type": string | null;
  generated_internal_id: string;
}

async function fetchPage(page: number): Promise<{
  results: Award[];
  hasNext: boolean;
}> {
  const body = {
    filters: {
      time_period: [{ start_date: startDate, end_date: endDate }],
      award_type_codes: ["A", "B", "C", "D"],
      agencies: [
        {
          type: "awarding",
          tier: "subtier",
          name: "Defense Logistics Agency",
        },
      ],
    },
    fields: [
      "Award ID",
      "Recipient Name",
      "Award Amount",
      "Description",
      "Start Date",
      "End Date",
      "Awarding Sub Agency",
      "Award Type",
      "generated_internal_id",
    ],
    page,
    limit: PAGE_SIZE,
    sort: "Award Amount",
    order: "desc",
    subawards: false,
  };

  const resp = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`USASpending API ${resp.status}: ${text.substring(0, 200)}`);
  }

  const data = await resp.json();
  return {
    results: data.results || [],
    hasNext: data.page_metadata?.hasNext ?? false,
  };
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Pulling DLA awards from ${startDate} to ${endDate}...`);
  console.log(`Using paginated search API (${PAGE_SIZE}/page)\n`);

  const allAwards: Award[] = [];
  let page = 1;
  let hasNext = true;
  const MAX_PAGES = 500; // USASpending caps at 50,000 results (500 pages x 100)

  while (hasNext && page <= MAX_PAGES) {
    try {
      const result = await fetchPage(page);
      allAwards.push(...result.results);
      hasNext = result.hasNext;

      if (page % 10 === 0 || !hasNext) {
        console.log(`  Page ${page}: ${allAwards.length} awards so far...`);
      }
      page++;

      // Rate limiting
      await new Promise((r) => setTimeout(r, 250));
    } catch (err: any) {
      console.error(`  Error on page ${page}: ${err.message}`);
      if (page > 1) {
        console.log("  Saving what we have so far...");
        hasNext = false;
      } else {
        throw err;
      }
    }
  }

  console.log(`\nTotal awards fetched: ${allAwards.length}`);

  // Save raw results
  const outPath = join(OUTPUT_DIR, "dla-awards-6mo.json");
  writeFileSync(outPath, JSON.stringify(allAwards, null, 2));
  console.log(`Saved to ${outPath}`);

  // Summary stats
  const totalValue = allAwards.reduce((s, a) => s + (a["Award Amount"] || 0), 0);
  console.log(`\nTotal award value: $${totalValue.toLocaleString()}`);

  // Top recipients
  const byRecipient: Record<string, { count: number; value: number }> = {};
  allAwards.forEach((a) => {
    const name = a["Recipient Name"] || "Unknown";
    if (!byRecipient[name]) byRecipient[name] = { count: 0, value: 0 };
    byRecipient[name].count++;
    byRecipient[name].value += a["Award Amount"] || 0;
  });
  const topRecipients = Object.entries(byRecipient)
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 20);
  console.log("\nTop 20 recipients by award value:");
  topRecipients.forEach(([name, { count, value }], i) => {
    console.log(`  ${(i + 1).toString().padStart(3)}. ${name} — $${value.toLocaleString()} (${count} awards)`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
