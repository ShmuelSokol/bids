// Simulate what happens with the 44 awards from yesterday/today.
// Show: how many have bid_vendor, how many have nsn_costs hit, how many
// the UI would show as "UNASSIGNED", and how the NEW routing resolves each.

import "./env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Today + yesterday in ISO
  const yesterday = new Date(Date.now() - 48 * 3600_000).toISOString();
  const { data: awards } = await sb
    .from("awards")
    .select("id, fsc, niin, contract_number, unit_of_measure, bid_vendor, bid_uom, award_date, description")
    .gte("award_date", yesterday.slice(0, 10))
    .eq("po_generated", false)
    .order("award_date", { ascending: false })
    .limit(100);
  console.log(`Recent awards (last 2 days, no PO yet): ${awards?.length || 0}`);

  const nsns = [...new Set((awards || []).map((a: any) => `${a.fsc}-${a.niin}`))];
  const { data: costs } = await sb
    .from("nsn_costs")
    .select("nsn, cost, cost_source, vendor, unit_of_measure")
    .in("nsn", nsns);
  const costByNsn = new Map<string, any>();
  for (const c of costs || []) if (c.cost > 0) costByNsn.set(c.nsn, c);

  // Count UI-visible "supplier column" states
  let uiHasVendor = 0;
  let uiUnassigned = 0;
  for (const a of awards || []) {
    const nsn = `${a.fsc}-${a.niin}`;
    const uiVendor = a.bid_vendor || costByNsn.get(nsn)?.vendor || null;
    if (uiVendor) uiHasVendor++;
    else uiUnassigned++;
  }
  console.log(`\nUI supplier column (what you see on /orders):`);
  console.log(`  has a vendor name: ${uiHasVendor}`);
  console.log(`  shows UNASSIGNED:  ${uiUnassigned}`);

  // Simulate NEW routing
  const sameUom = (a: any, b: any) => a && b && String(a).trim().toUpperCase() === String(b).trim().toUpperCase();
  const uomBlocks = (a: any, b: any) => a && b && !sameUom(a, b);
  const byReason: Record<string, number> = {};
  const bySupplier = new Map<string, number>();
  for (const a of awards || []) {
    const nsn = `${a.fsc}-${a.niin}`;
    const cost = costByNsn.get(nsn);
    let supplier = "UNASSIGNED";
    let reason = "";
    if (a.bid_vendor) {
      if (uomBlocks(a.unit_of_measure, a.bid_uom)) {
        reason = `UoM mismatch (bid_vendor)`;
      } else {
        supplier = a.bid_vendor.trim();
        reason = "bid_vendor";
      }
    } else if (!cost || !cost.vendor) {
      reason = "no nsn_costs match";
    } else if (uomBlocks(a.unit_of_measure, cost.unit_of_measure)) {
      reason = `UoM mismatch (waterfall)`;
    } else {
      supplier = cost.vendor.trim();
      reason = "nsn_costs waterfall";
    }
    bySupplier.set(supplier, (bySupplier.get(supplier) || 0) + 1);
    byReason[reason] = (byReason[reason] || 0) + 1;
  }
  console.log(`\nServer routing (NEW logic post-fix) — grouping into suppliers:`);
  for (const [s, n] of Array.from(bySupplier.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s.padEnd(20)} ${n} awards`);
  }
  console.log(`\nReason breakdown:`);
  for (const [r, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${r}`);
  }

  // Sample of the UI-visible vendors vs server routing
  console.log(`\n=== Mismatch sample: awards where UI shows a vendor but server routes to UNASSIGNED ===`);
  let shown = 0;
  for (const a of awards || []) {
    if (shown >= 10) break;
    const nsn = `${a.fsc}-${a.niin}`;
    const uiVendor = a.bid_vendor || costByNsn.get(nsn)?.vendor || null;
    if (!uiVendor) continue;
    const cost = costByNsn.get(nsn);
    let serverSupplier = "UNASSIGNED";
    if (a.bid_vendor && !uomBlocks(a.unit_of_measure, a.bid_uom)) serverSupplier = a.bid_vendor.trim();
    else if (!a.bid_vendor && cost?.vendor && !uomBlocks(a.unit_of_measure, cost.unit_of_measure)) serverSupplier = cost.vendor.trim();
    if (uiVendor.trim() !== serverSupplier) {
      console.log(`  id=${a.id} NSN=${nsn} UI="${uiVendor}" SERVER="${serverSupplier}" award.UoM="${a.unit_of_measure}" bid_uom="${a.bid_uom}" vendor_uom="${cost?.unit_of_measure}"`);
      shown++;
    }
  }
  if (shown === 0) console.log(`  (no mismatches)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
