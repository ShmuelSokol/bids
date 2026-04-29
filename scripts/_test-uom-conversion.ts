import "./env";
import { parseUomMultiplier, costPerEach, convertCost } from "../src/lib/uom";

// Direct unit tests of the helpers
console.log("=== parseUomMultiplier ===");
for (const u of ["B25", "B10", "B100", "B1000", "EA", "PR", "PG", "BX", "PK", "CT", "ZZ", null, ""]) {
  console.log(`  ${JSON.stringify(u)} → ${JSON.stringify(parseUomMultiplier(u))}`);
}

console.log("\n=== costPerEach ===");
console.log(`  $100.90/B25 = $${costPerEach(100.90, "B25").toFixed(4)}/EA  (expect $4.0360)`);
console.log(`  $41.00/B1000 = $${costPerEach(41.00, "B1000").toFixed(4)}/EA  (expect $0.0410)`);
console.log(`  $20.40/EA   = $${costPerEach(20.40, "EA").toFixed(4)}/EA  (expect $20.4000)`);

console.log("\n=== convertCost (full case) ===");
console.log(JSON.stringify(convertCost(100.90, "B25", "EA"), null, 2));
console.log(JSON.stringify(convertCost(100.90, "B25", "B25"), null, 2));
console.log(JSON.stringify(convertCost(20, "BX", "EA"), null, 2));

// Now full-flow simulation: apply the reprice logic to our B25 test sol
console.log("\n=== Simulated reprice for SPE2DS-26-T-021J ===");
const cost = 100.9;
const axUom = "B25";
const solUom = "EA";
const quantity = 2;
const lamlinksEst = 20.40; // per EA

const { mult } = parseUomMultiplier(axUom);
const isAxBundle = /^B\d+$/i.test(axUom) && mult > 1;
const useCostPerEach = isAxBundle && solUom === "EA";
const effectiveCost = useCostPerEach ? cost / mult : cost;
console.log(`  AX cost: $${cost}/${axUom} (pack of ${mult})`);
console.log(`  SOL UoM: ${solUom}`);
console.log(`  → useCostPerEach = ${useCostPerEach}, effectiveCost = $${effectiveCost.toFixed(4)}/EA`);

// Simulate +10% (Cost + 10% strategy) — replicate what reprice does
const suggestedAt10pct = Math.round(effectiveCost * 1.10 * 100) / 100;
const suggestedAt30pct = Math.round(effectiveCost * 1.30 * 100) / 100;
console.log(`  Suggested at +10% margin: $${suggestedAt10pct}/EA`);
console.log(`  Suggested at +30% markup: $${suggestedAt30pct}/EA`);
console.log(`  LL est: $${lamlinksEst}/EA — bid easily fits below market`);
console.log(`  Margin at LL est:  ${Math.round((1 - effectiveCost / lamlinksEst) * 100)}%`);
console.log(`  Quantity ${quantity} → potential value @LL est: $${(lamlinksEst * quantity).toFixed(2)}`);

// What was wrong before: cost treated as per-EA, suggest = $100.90 × 1.10 = $110.99
console.log(`\n  PRIOR (buggy): cost=$${cost}/EA × 1.10 = $${(cost * 1.10).toFixed(2)}/EA  ← 5.4× over market`);
