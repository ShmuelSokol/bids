// Diagnose PO routing: for awards without a PO yet, show how each would route
// through generate-pos's logic. Look for UoM mismatches collapsing suppliers
// into UNASSIGNED.

import "./env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Pull awards without POs yet + their UoM info
  const { data: awards } = await sb
    .from("awards")
    .select("id, fsc, niin, contract_number, unit_of_measure, bid_vendor, bid_uom, bid_cost")
    .eq("po_generated", false)
    .limit(200)
    .order("id", { ascending: false });
  if (!awards) { console.log("no awards"); return; }
  console.log(`Found ${awards.length} awards without POs (most recent 200)`);

  // Load nsn_costs for all involved NSNs
  const nsns = [...new Set(awards.map((a: any) => `${a.fsc}-${a.niin}`))];
  const { data: costs } = await sb
    .from("nsn_costs")
    .select("nsn, cost, cost_source, vendor, unit_of_measure")
    .in("nsn", nsns);
  const costByNsn = new Map<string, any>();
  for (const c of costs || []) if (c.cost > 0) costByNsn.set(c.nsn, c);

  // Simulate generate-pos routing (new rule: UoM only blocks when both are populated)
  const sameUom = (a: any, b: any) => a && b && String(a).trim().toUpperCase() === String(b).trim().toUpperCase();
  const uomBlocks = (a: any, b: any) => a && b && !sameUom(a, b);
  const bySupplier = new Map<string, number>();
  const reasons: Record<string, number> = {};
  for (const a of awards) {
    const nsn = `${a.fsc}-${a.niin}`;
    let supplier = "UNASSIGNED";
    let reason = "";
    if (a.bid_vendor) {
      if (uomBlocks(a.unit_of_measure, a.bid_uom)) {
        reason = `bid_vendor route blocked: award.UoM="${a.unit_of_measure}" vs bid_uom="${a.bid_uom}"`;
      } else {
        supplier = a.bid_vendor.trim();
        reason = "bid_vendor path";
      }
    } else {
      const cost = costByNsn.get(nsn);
      if (!cost || !cost.vendor) {
        reason = "no cost/vendor in nsn_costs";
      } else if (uomBlocks(a.unit_of_measure, cost.unit_of_measure)) {
        reason = `fallback route blocked: award.UoM="${a.unit_of_measure}" vs vendor_uom="${cost.unit_of_measure}"`;
      } else {
        supplier = cost.vendor.trim();
        reason = "nsn_costs fallback";
      }
    }
    bySupplier.set(supplier, (bySupplier.get(supplier) || 0) + 1);
    reasons[reason] = (reasons[reason] || 0) + 1;
  }

  console.log(`\n=== Routing result (simulated) ===`);
  console.log(`Distinct suppliers the awards would group into: ${bySupplier.size}`);
  for (const [s, n] of Array.from(bySupplier.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s.padEnd(20)} ${n} awards`);
  }

  console.log(`\n=== Reason breakdown ===`);
  for (const [r, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(4)}  ${r}`);
  }

  // Show first 10 blocked routing examples for debugging
  console.log(`\n=== Sample of UoM-blocked awards (first 10) ===`);
  let shown = 0;
  for (const a of awards) {
    if (shown >= 10) break;
    const nsn = `${a.fsc}-${a.niin}`;
    const cost = costByNsn.get(nsn);
    let blocked = false;
    let label = "";
    if (a.bid_vendor && !sameUom(a.unit_of_measure, a.bid_uom) && a.bid_uom) {
      blocked = true;
      label = `bid_vendor=${a.bid_vendor} bid_uom="${a.bid_uom}" award_uom="${a.unit_of_measure}"`;
    } else if (!a.bid_vendor && cost?.vendor && !sameUom(a.unit_of_measure, cost.unit_of_measure)) {
      blocked = true;
      label = `cost_vendor=${cost.vendor} vendor_uom="${cost.unit_of_measure}" award_uom="${a.unit_of_measure}"`;
    }
    if (blocked) {
      console.log(`  award ${a.id} NSN ${nsn} contract ${a.contract_number}: ${label}`);
      shown++;
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
