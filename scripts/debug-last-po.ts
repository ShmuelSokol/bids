// Inspect the most recent PO creation + its member awards to figure out why
// it landed in one bucket.

import "./env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Most recent POs
  const { data: pos } = await sb
    .from("purchase_orders")
    .select("id, po_number, supplier, line_count, total_cost, created_at, created_by")
    .order("created_at", { ascending: false })
    .limit(5);
  console.log("=== Last 5 POs created ===");
  for (const p of pos || []) console.log(`  PO ${p.po_number}  supplier=${p.supplier}  lines=${p.line_count}  by=${p.created_by}  ${p.created_at}`);

  if (!pos || pos.length === 0) return;
  const latestPoId = pos[0].id;
  console.log(`\n=== Lines in latest PO (${pos[0].po_number}) — ${pos[0].supplier} ===`);
  const { data: lines } = await sb
    .from("po_lines")
    .select("award_id, nsn, unit_of_measure, supplier, cost_source, unit_cost, description")
    .eq("po_id", latestPoId);
  for (const l of lines || []) {
    console.log(`  award_id=${l.award_id}  NSN=${l.nsn}  award_uom="${l.unit_of_measure || "null"}"  cost_src="${l.cost_source}"`);
  }

  if (!lines || lines.length === 0) return;

  // Re-run routing simulation for those exact award IDs with the NEW rule
  const awardIds = lines.map((l: any) => l.award_id);
  const { data: awards } = await sb
    .from("awards")
    .select("id, fsc, niin, contract_number, unit_of_measure, bid_vendor, bid_uom, bid_cost")
    .in("id", awardIds);
  const nsns = [...new Set((awards || []).map((a: any) => `${a.fsc}-${a.niin}`))];
  const { data: costs } = await sb
    .from("nsn_costs")
    .select("nsn, cost, cost_source, vendor, unit_of_measure")
    .in("nsn", nsns);
  const costByNsn = new Map<string, any>();
  for (const c of costs || []) if (c.cost > 0) costByNsn.set(c.nsn, c);

  const sameUom = (a: any, b: any) => a && b && String(a).trim().toUpperCase() === String(b).trim().toUpperCase();
  const uomBlocks = (a: any, b: any) => a && b && !sameUom(a, b);

  console.log(`\n=== How each award SHOULD route under the new logic ===`);
  const supplierCounts = new Map<string, number>();
  for (const a of awards || []) {
    const nsn = `${a.fsc}-${a.niin}`;
    const cost = costByNsn.get(nsn);
    let supplier = "UNASSIGNED";
    let reason = "";
    if (a.bid_vendor) {
      if (uomBlocks(a.unit_of_measure, a.bid_uom)) {
        reason = `bid_vendor BLOCK: award="${a.unit_of_measure}" bid_uom="${a.bid_uom}"`;
      } else {
        supplier = a.bid_vendor.trim();
        reason = "bid_vendor ok";
      }
    } else if (!cost || !cost.vendor) {
      reason = "no cost/vendor in nsn_costs";
    } else if (uomBlocks(a.unit_of_measure, cost.unit_of_measure)) {
      reason = `waterfall BLOCK: award="${a.unit_of_measure}" vendor_uom="${cost.unit_of_measure}"`;
    } else {
      supplier = cost.vendor.trim();
      reason = `waterfall ok (vendor ${cost.vendor})`;
    }
    supplierCounts.set(supplier, (supplierCounts.get(supplier) || 0) + 1);
    console.log(`  award ${a.id} NSN ${nsn}: → ${supplier}  (${reason})`);
  }

  console.log(`\n=== Simulated supplier buckets (what the NEW code would do) ===`);
  for (const [s, n] of Array.from(supplierCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s.padEnd(15)} ${n} awards`);
  }
  console.log(`\n(Single-PO result means Railway deploy hasn't completed, OR these awards all genuinely have no vendor.)`);

  // Check Railway deploy status by reading the built /api/orders/generate-pos
  // if we can. Simplest: check if the Railway health endpoint returns a recent build.
  console.log(`\n=== Checking live Railway routing via /api/settings endpoint ===`);
  try {
    const r = await fetch("https://dibs-gov-production.up.railway.app/api/awards/search?nsn=nonexistent", { method: "GET" });
    console.log(`  Railway reachable: ${r.status}`);
  } catch (e: any) {
    console.log(`  Railway error: ${e.message}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
