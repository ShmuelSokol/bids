import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/jobs/rankings
 *
 * Aggregates discovered_suppliers into supplier_rankings.
 * Shows top suppliers by number of NSNs they could supply.
 */
export async function POST() {
  const supabase = createServiceClient();

  // Get all discovered suppliers
  const allSuppliers: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from("discovered_suppliers")
      .select("*")
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allSuppliers.push(...data);
    if (data.length < 1000) break;
    page++;
  }

  // Aggregate by supplier_domain
  const byDomain = new Map<string, {
    name: string;
    domain: string;
    nsns: Set<string>;
    items: Set<string>;
    totalValue: number;
  }>();

  for (const s of allSuppliers) {
    const domain = s.supplier_domain;
    if (!domain) continue;
    if (!byDomain.has(domain)) {
      byDomain.set(domain, {
        name: s.supplier_name || domain,
        domain,
        nsns: new Set(),
        items: new Set(),
        totalValue: 0,
      });
    }
    const entry = byDomain.get(domain)!;
    if (s.nsn) entry.nsns.add(s.nsn);
    if (s.nomenclature) entry.items.add(s.nomenclature);
  }

  // Get estimated values for the NSNs
  const allNsns = [...new Set(allSuppliers.map(s => s.nsn).filter(Boolean))];
  const { data: solData } = await supabase
    .from("dibbs_solicitations")
    .select("nsn, est_value, suggested_price, quantity")
    .in("nsn", allNsns.slice(0, 500));

  const valueByNsn = new Map<string, number>();
  for (const s of solData || []) {
    const val = s.est_value || (s.suggested_price || 0) * (s.quantity || 1);
    if (val > 0) valueByNsn.set(s.nsn, val);
  }

  // Build rankings
  const rankings = Array.from(byDomain.entries())
    .map(([domain, data]) => {
      let totalValue = 0;
      for (const nsn of data.nsns) {
        totalValue += valueByNsn.get(nsn) || 0;
      }
      return {
        supplier_name: data.name,
        supplier_domain: domain,
        nsn_count: data.nsns.size,
        total_potential_value: totalValue,
        sample_nsns: [...data.nsns].slice(0, 5),
        sample_items: [...data.items].slice(0, 5),
        last_seen: new Date().toISOString(),
        status: "discovered",
      };
    })
    .filter((r) => r.nsn_count >= 2) // only suppliers with 2+ NSNs
    .sort((a, b) => b.nsn_count - a.nsn_count);

  // Upsert rankings
  if (rankings.length > 0) {
    await supabase
      .from("supplier_rankings")
      .upsert(rankings, { onConflict: "supplier_name" });
  }

  return NextResponse.json({
    total_suppliers: byDomain.size,
    ranked: rankings.length,
    top_5: rankings.slice(0, 5).map((r) => ({
      name: r.supplier_name,
      domain: r.supplier_domain,
      nsns: r.nsn_count,
      value: r.total_potential_value,
    })),
  });
}
