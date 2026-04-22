import "./env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Simulate the UI's award filter: recent awards, not yet in a PO,
  // for our CAGE. Order matches awards-list default.
  const { data: awards } = await sb
    .from("awards")
    .select("id, fsc, niin, contract_number, award_date, unit_of_measure, bid_vendor, bid_uom, cage")
    .eq("po_generated", false)
    .eq("cage", "0AG09")
    .order("award_date", { ascending: false })
    .limit(44);
  console.log(`Top-44 recent awards that user would have selected: ${awards?.length}`);

  const nsns = [...new Set((awards || []).map((a: any) => `${a.fsc}-${a.niin}`))];
  const { data: costs } = await sb
    .from("nsn_costs")
    .select("nsn, cost, cost_source, vendor, unit_of_measure")
    .in("nsn", nsns);
  const costByNsn = new Map<string, any>();
  for (const c of costs || []) if (c.cost > 0) costByNsn.set(c.nsn, c);

  let haveBidVendor = 0, haveNsnCost = 0, haveNeither = 0, uiHasVendor = 0;
  for (const a of awards || []) {
    const nsn = `${a.fsc}-${a.niin}`;
    if (a.bid_vendor) haveBidVendor++;
    if (costByNsn.has(nsn)) haveNsnCost++;
    if (!a.bid_vendor && !costByNsn.has(nsn)) haveNeither++;
    const uiVendor = a.bid_vendor || costByNsn.get(nsn)?.vendor || null;
    if (uiVendor) uiHasVendor++;
  }
  console.log(`\nVendor availability across those 44:`);
  console.log(`  bid_vendor populated:        ${haveBidVendor}`);
  console.log(`  nsn_costs has entry:         ${haveNsnCost}`);
  console.log(`  neither (UNASSIGNED in UI):  ${haveNeither}`);
  console.log(`  UI shows a vendor name:      ${uiHasVendor}`);

  // Simulate NEW routing (post-fix: always route by vendor)
  const bySupplier = new Map<string, number>();
  for (const a of awards || []) {
    const nsn = `${a.fsc}-${a.niin}`;
    const cost = costByNsn.get(nsn);
    let supplier = "UNASSIGNED";
    if (a.bid_vendor) supplier = a.bid_vendor.trim();
    else if (cost?.vendor) supplier = cost.vendor.trim();
    bySupplier.set(supplier, (bySupplier.get(supplier) || 0) + 1);
  }
  console.log(`\nServer routing (NEW NEW logic — always by vendor, UoM is cost-only):`);
  for (const [s, n] of Array.from(bySupplier.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s.padEnd(15)} ${n} awards`);
  }
  console.log(`  ==> ${bySupplier.size} POs would be created\n`);

  console.log(`\nPer-award breakdown:`);
  for (const a of awards || []) {
    const nsn = `${a.fsc}-${a.niin}`;
    const cost = costByNsn.get(nsn);
    const uiVendor = a.bid_vendor || cost?.vendor || "UNASSIGNED";
    console.log(`  id=${a.id}  NSN=${nsn}  contract=${a.contract_number}  UI_vendor=${uiVendor}  award_UoM="${a.unit_of_measure}"  bid_uom="${a.bid_uom || ""}"  cost_vendor_uom="${cost?.unit_of_measure || ""}"`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
