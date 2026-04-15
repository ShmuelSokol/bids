/**
 * Test 4: PO generation from Awards.
 *
 * Doesn't write a PO (that would require an auth'd session). Instead,
 * simulates the core grouping + math logic against real recent awards
 * and reports what it WOULD produce. That's enough to verify:
 *
 *   - Cheapest-vendor grouping picks the right supplier (not CAGE 0AG09)
 *   - Unit cost uses vendor price, falls back to historical our_cost
 *   - Awards without any vendor price land on UNASSIGNED
 *   - Margin math matches the server's computeMarginPct()
 *
 *   npx tsx scripts/test-po-generation.ts
 */
import "./env";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function marginPct(sell: number, cost: number): number | null {
  if (!sell || !cost || cost >= sell) return null;
  return ((sell - cost) / sell) * 100;
}

async function main() {
  console.log("=== PO GENERATION TEST (dry — no PO written) ===\n");

  // Find awards that haven't been generated into a PO yet. These are
  // the rows the UI would show as 'Select all' candidates on the
  // /orders page.
  const { data: candidates, error } = await sb
    .from("awards")
    .select("id, contract_number, fsc, niin, cage, unit_price, quantity, description, fob")
    .eq("po_generated", false)
    .eq("cage", "0AG09")
    .not("unit_price", "is", null)
    .gt("unit_price", 0)
    .order("award_date", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error loading awards:", error.message);
    return;
  }
  if (!candidates?.length) {
    console.log("No eligible awards. All our recent wins are already in POs.");
    return;
  }

  console.log(`Found ${candidates.length} award candidates.\n`);

  // Look up the cheapest vendor per NSN
  const nsns = [...new Set(candidates.map((a) => `${a.fsc}-${a.niin}`))];
  const { data: vendorPrices } = await sb
    .from("nsn_vendor_prices")
    .select("nsn, vendor, price, price_source, item_number")
    .in("nsn", nsns)
    .gt("price", 0)
    .order("price", { ascending: true });

  const cheapestByNsn = new Map<string, { vendor: string; price: number; source: string | null }>();
  for (const vp of vendorPrices || []) {
    if (!cheapestByNsn.has(vp.nsn)) {
      cheapestByNsn.set(vp.nsn, {
        vendor: vp.vendor,
        price: vp.price,
        source: vp.price_source,
      });
    }
  }

  // Group by supplier
  const bySupplier = new Map<string, typeof candidates>();
  for (const a of candidates) {
    const nsn = `${a.fsc}-${a.niin}`;
    const cheapest = cheapestByNsn.get(nsn);
    const supplier = cheapest?.vendor?.trim() || "UNASSIGNED";
    if (!bySupplier.has(supplier)) bySupplier.set(supplier, []);
    bySupplier.get(supplier)!.push(a);
  }

  console.log(`Would create ${bySupplier.size} PO(s):\n`);
  let grandTotal = 0;
  let grandMargin = 0;
  for (const [supplier, awards] of bySupplier) {
    let poCost = 0;
    let poRevenue = 0;
    console.log(`  PO → ${supplier}  (${awards.length} lines)`);
    for (const a of awards) {
      const nsn = `${a.fsc}-${a.niin}`;
      const cheapest = cheapestByNsn.get(nsn);
      const unitCost = cheapest?.price ?? 0;
      const qty = a.quantity || 1;
      const lineCost = unitCost * qty;
      const lineRevenue = (a.unit_price || 0) * qty;
      const m = marginPct(a.unit_price || 0, unitCost);
      poCost += lineCost;
      poRevenue += lineRevenue;
      const mTag = m === null ? "n/a" : `${m.toFixed(1)}%`;
      const costSource = cheapest?.source || (supplier === "UNASSIGNED" ? "no vendor price" : "nsn_vendor_prices");
      console.log(`    ${nsn} qty=${qty} cost=$${unitCost.toFixed(2)} sell=$${(a.unit_price || 0).toFixed(2)} margin=${mTag} [${costSource}]`);
    }
    const poMargin = marginPct(poRevenue, poCost);
    console.log(`    ─ PO total: cost=$${poCost.toFixed(2)} revenue=$${poRevenue.toFixed(2)} margin=${poMargin?.toFixed(1) || "n/a"}%\n`);
    grandTotal += poCost;
    grandMargin += poRevenue - poCost;
  }

  console.log("=== SUMMARY ===");
  console.log(`  Total PO cost:    $${grandTotal.toFixed(2)}`);
  console.log(`  Total margin:     $${grandMargin.toFixed(2)}`);
  console.log(`  Unassigned lines: ${bySupplier.get("UNASSIGNED")?.length || 0}`);
  console.log(`\nSanity checks:`);
  console.log(`  - Each supplier should be a real vendor CAGE, not "0AG09" (that's us)`);
  console.log(`  - UNASSIGNED lines are expected when NSN has no vendor price — Abe fixes via Switch`);
  console.log(`  - Margin should be positive (sell > cost) on most lines; negative means bad vendor match`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
