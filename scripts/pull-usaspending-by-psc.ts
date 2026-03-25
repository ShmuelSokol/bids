/**
 * Pull DLA awards from USASpending by PSC group (2-digit level).
 * Focuses on FSC categories relevant to ERG Supply.
 * Uses the spending_by_category endpoint for aggregated data first,
 * then pulls individual awards for key categories.
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(__dirname, "..", "data", "usaspending");

const startDate = "2025-09-25";
const endDate = "2026-03-25";

// PSC 2-digit groups that cover our active + expansion FSCs
const PSC_GROUPS = [
  "65", // Medical/dental/veterinary equipment & supplies (Abe's bread & butter)
  "66", // Instruments & laboratory equipment
  "53", // Hardware & abrasives
  "42", // Fire fighting/rescue/safety
  "47", // Pipe/tubing/hose/fittings
  "73", // Food preparation/serving equipment
  "76", // Books/maps/publications
  "80", // Brushes/paints/sealers/adhesives (PAINT - expansion)
  "81", // Containers/packaging/packing
  "84", // Clothing/individual equipment/insignia
  "83", // Textiles/leather/furs/tents (tents - dropped category)
  "59", // Electrical components
  "61", // Electric wire/power distribution
  "85", // Toiletries
  "69", // Training aids/devices
];

interface PscResult {
  psc_group: string;
  total_awards: number;
  total_value: number;
  top_recipients: { name: string; count: number; value: number }[];
}

async function fetchAwardsByPsc(pscGroup: string): Promise<{
  awards: any[];
  hasMore: boolean;
}> {
  const resp = await fetch(
    "https://api.usaspending.gov/api/v2/search/spending_by_award/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: {
          time_period: [{ start_date: startDate, end_date: endDate }],
          award_type_codes: ["A", "B", "C", "D"],
          agencies: [
            { type: "awarding", tier: "subtier", name: "Defense Logistics Agency" },
          ],
          psc_codes: { require: [["Product", pscGroup]] },
        },
        fields: [
          "Award ID",
          "Recipient Name",
          "Award Amount",
          "Description",
          "Start Date",
          "End Date",
          "Award Type",
          "generated_internal_id",
        ],
        page: 1,
        limit: 100,
        sort: "Award Amount",
        order: "desc",
        subawards: false,
      }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API ${resp.status} for PSC ${pscGroup}: ${text.substring(0, 200)}`);
  }

  const data = await resp.json();
  return {
    awards: data.results || [],
    hasMore: data.page_metadata?.hasNext ?? false,
  };
}

// Use spending_by_category to get aggregate PSC-level data
async function fetchPscSummary(): Promise<any[]> {
  const resp = await fetch(
    "https://api.usaspending.gov/api/v2/search/spending_by_category/psc/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: {
          time_period: [{ start_date: startDate, end_date: endDate }],
          award_type_codes: ["A", "B", "C", "D"],
          agencies: [
            { type: "awarding", tier: "subtier", name: "Defense Logistics Agency" },
          ],
        },
        category: "psc",
        page: 1,
        limit: 100,
        subawards: false,
      }),
    }
  );

  if (!resp.ok) {
    console.log("  PSC summary endpoint returned " + resp.status + ", skipping...");
    return [];
  }

  const data = await resp.json();
  return data.results || [];
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`DLA awards by PSC group (${startDate} to ${endDate})\n`);

  // First: get aggregate PSC spending
  console.log("Fetching aggregate PSC spending summary...");
  const pscSummary = await fetchPscSummary();
  if (pscSummary.length > 0) {
    writeFileSync(
      join(OUTPUT_DIR, "dla-psc-summary.json"),
      JSON.stringify(pscSummary, null, 2)
    );
    console.log(`  ${pscSummary.length} PSC categories returned\n`);

    // Show top 30
    console.log("--- TOP 30 PSC CATEGORIES BY DLA SPEND ---");
    pscSummary.slice(0, 30).forEach((r: any, i: number) => {
      console.log(
        `  ${(i + 1).toString().padStart(3)}. PSC ${(r.code || "?").padEnd(6)} | $${(r.amount || 0).toLocaleString().padStart(15)} | ${r.name || "?"}`
      );
    });
    console.log("");
  }

  // Second: pull top 100 awards for each PSC group
  console.log("Fetching awards by PSC group...\n");
  const allResults: Record<string, any[]> = {};

  for (const psc of PSC_GROUPS) {
    try {
      const { awards, hasMore } = await fetchAwardsByPsc(psc);
      allResults[psc] = awards;
      const totalVal = awards.reduce((s: number, a: any) => s + (a["Award Amount"] || 0), 0);
      console.log(
        `  PSC ${psc}: ${awards.length} awards (top 100), $${totalVal.toLocaleString()}${hasMore ? " (more available)" : ""}`
      );
    } catch (err: any) {
      console.error(`  PSC ${psc}: ERROR — ${err.message}`);
      allResults[psc] = [];
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  // Save all awards
  writeFileSync(
    join(OUTPUT_DIR, "dla-awards-by-psc.json"),
    JSON.stringify(allResults, null, 2)
  );
  console.log(`\nSaved to data/usaspending/dla-awards-by-psc.json`);

  // Summary
  const totalAwards = Object.values(allResults).reduce((s, a) => s + a.length, 0);
  const totalValue = Object.values(allResults)
    .flat()
    .reduce((s, a) => s + (a["Award Amount"] || 0), 0);
  console.log(`\nTotal: ${totalAwards} awards, $${totalValue.toLocaleString()}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
