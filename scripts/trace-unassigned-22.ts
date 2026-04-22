// For the 22 UNASSIGNED awards from the user's test, show what each data
// source actually has on file. The user's question: "NSN in AX should =
// sourceable." Let's verify where the gap is.

import "./env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: awards } = await sb
    .from("awards")
    .select("id, fsc, niin, contract_number, unit_of_measure, bid_vendor")
    .eq("po_generated", false)
    .eq("cage", "0AG09")
    .order("award_date", { ascending: false })
    .limit(44);
  const nsns = [...new Set((awards || []).map((a: any) => `${a.fsc}-${a.niin}`))];

  // Load all three vendor/NSN sources
  const [costsRes, catalogRes, vendorPartsRes] = await Promise.all([
    sb.from("nsn_costs").select("nsn, cost, cost_source, vendor, unit_of_measure").in("nsn", nsns),
    sb.from("nsn_catalog").select("nsn, source, description").in("nsn", nsns),
    sb.from("nsn_ax_vendor_parts").select("nsn, vendor_account, vendor_product_number, vendor_description, ax_item_number").in("nsn", nsns),
  ]);
  const costByNsn = new Map<string, any>();
  for (const c of costsRes.data || []) if (c.cost > 0) costByNsn.set(c.nsn, c);
  const catalogByNsn = new Map<string, any>();
  for (const c of catalogRes.data || []) catalogByNsn.set(c.nsn, c);
  const vendorPartsByNsn = new Map<string, any[]>();
  for (const v of vendorPartsRes.data || []) {
    const arr = vendorPartsByNsn.get(v.nsn) || [];
    arr.push(v);
    vendorPartsByNsn.set(v.nsn, arr);
  }

  // Filter to the UNASSIGNED ones (no bid_vendor, no nsn_costs hit)
  const unassigned = (awards || []).filter((a: any) => {
    const nsn = `${a.fsc}-${a.niin}`;
    return !a.bid_vendor && !costByNsn.has(nsn);
  });
  console.log(`=== ${unassigned.length} UNASSIGNED awards — tracing what each source knows ===\n`);

  // Tally coverage
  let inCatalog = 0, inVendorParts = 0, inNeither = 0;
  for (const a of unassigned) {
    const nsn = `${a.fsc}-${a.niin}`;
    const c = catalogByNsn.has(nsn);
    const v = vendorPartsByNsn.has(nsn);
    if (c) inCatalog++;
    if (v) inVendorParts++;
    if (!c && !v) inNeither++;
  }
  console.log(`Coverage:`);
  console.log(`  In nsn_catalog (AX has the NSN as an item):    ${inCatalog} / ${unassigned.length}`);
  console.log(`  In nsn_ax_vendor_parts (AX has vendor part #): ${inVendorParts} / ${unassigned.length}`);
  console.log(`  In NEITHER (truly unknown to AX):              ${inNeither} / ${unassigned.length}`);

  // Per-award detail
  console.log(`\nPer-award breakdown:\n`);
  for (const a of unassigned) {
    const nsn = `${a.fsc}-${a.niin}`;
    const cat = catalogByNsn.get(nsn);
    const vparts = vendorPartsByNsn.get(nsn) || [];
    console.log(`NSN ${nsn}  contract ${a.contract_number}`);
    console.log(`  nsn_catalog:          ${cat ? `${cat.source} — "${cat.description?.slice(0, 40)}"` : "NOT IN AX"}`);
    console.log(`  nsn_costs:            ${costByNsn.has(nsn) ? "(has cost)" : "NO COST (never recent PO / no price agreement)"}`);
    if (vparts.length > 0) {
      console.log(`  nsn_ax_vendor_parts:  ${vparts.length} vendor(s) — ${vparts.map((v: any) => `${v.vendor_account}(${v.vendor_product_number})`).slice(0, 5).join(", ")}`);
    } else {
      console.log(`  nsn_ax_vendor_parts:  (no vendor part# in AX)`);
    }
    console.log();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
