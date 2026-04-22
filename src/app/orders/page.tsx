import { createServiceClient } from "@/lib/supabase-server";
import { AwardsList } from "./awards-list";
import { computeMarginPct } from "@/lib/margin";

async function getData() {
  const supabase = createServiceClient();

  // Load last 6 months of awards. Older awards without ship_status
  // (~19K with null) clutter the page. 6 months covers all actionable
  // items. The date picker on the page lets Abe go further back.
  const sinceIso = new Date(Date.now() - 180 * 86400000).toISOString();
  const awards: any[] = [];
  for (let p = 0; p < 20; p++) {
    const { data } = await supabase
      .from("awards")
      .select("*")
      .eq("cage", "0AG09")
      .gte("award_date", sinceIso)
      .order("award_date", { ascending: false })
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    awards.push(...data);
    if (data.length < 1000) break;
  }

  // Load cost data with vendor for margin + supplier assignment preview
  const allCosts: any[] = [];
  for (let p = 0; p < 30; p++) {
    const { data } = await supabase
      .from("nsn_costs")
      .select("nsn, cost, cost_source, vendor")
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allCosts.push(...data);
    if (data.length < 1000) break;
  }
  const costMap = new Map<string, number>();
  const vendorMap = new Map<string, string>();
  for (const c of allCosts) {
    if (c.cost > 0) costMap.set(c.nsn, c.cost);
    if (c.vendor) vendorMap.set(c.nsn, c.vendor);
  }

  // Load existing POs — paginate to avoid 1000-row cap
  const allPos: any[] = [];
  for (let p = 0; p < 20; p++) {
    const { data } = await supabase
      .from("purchase_orders")
      .select("*, po_lines(*)")
      .order("created_at", { ascending: false })
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allPos.push(...data);
    if (data.length < 1000) break;
  }

  // Enrich each PO line with two AX part#s:
  //   - ax_item_number: the AX internal item code (e.g. "COV059031"), from
  //     nsn_catalog.source (stored as "AX:<itemNumber>")
  //   - vendor_product_number_ax: the part # AX's vendor table has on file
  //     for this NSN+supplier pair, from nsn_ax_vendor_parts. Helpful for
  //     PO lines when we need to tell the vendor what to ship.
  const lineNsns = [...new Set(allPos.flatMap((p: any) => (p.po_lines || []).map((l: any) => l.nsn).filter(Boolean)))];
  const axItemByNsn = new Map<string, string>();
  if (lineNsns.length > 0) {
    for (let i = 0; i < lineNsns.length; i += 500) {
      const chunk = lineNsns.slice(i, i + 500);
      const { data } = await supabase.from("nsn_catalog").select("nsn, source").in("nsn", chunk);
      for (const c of data || []) {
        const m = /^AX:(.+)$/.exec((c.source || "").trim());
        if (m) axItemByNsn.set(c.nsn, m[1].trim());
      }
    }
  }
  const vendorPartKey = (nsn: string, vendor: string) => `${nsn}__${vendor}`;
  const vendorPartByKey = new Map<string, string>();
  if (lineNsns.length > 0) {
    for (let i = 0; i < lineNsns.length; i += 500) {
      const chunk = lineNsns.slice(i, i + 500);
      const { data } = await supabase
        .from("nsn_ax_vendor_parts")
        .select("nsn, vendor_account, vendor_product_number")
        .in("nsn", chunk);
      for (const r of data || []) {
        const k = vendorPartKey(r.nsn, (r.vendor_account || "").trim());
        vendorPartByKey.set(k, r.vendor_product_number);
      }
    }
  }
  for (const po of allPos) {
    for (const l of po.po_lines || []) {
      l.ax_item_number = axItemByNsn.get(l.nsn) || null;
      l.vendor_product_number_ax =
        vendorPartByKey.get(vendorPartKey(l.nsn, l.supplier || "")) || null;
    }
  }

  // Enrich awards with cost/margin
  const enriched = awards.map((a: any) => {
    const nsn = `${a.fsc}-${a.niin}`;
    const cost = costMap.get(nsn);
    const vendor = a.bid_vendor || vendorMap.get(nsn) || null;
    return {
      ...a,
      nsn,
      our_cost: cost || null,
      margin_pct: computeMarginPct(a.unit_price, cost),
      assigned_vendor: vendor,
    };
  });

  // Compute ship status breakdown
  const shipStats = { shipped: 0, notShipped: 0, noStatus: 0, shipping: 0, partial: 0, total: enriched.length };
  for (const a of enriched) {
    const s = (a.ship_status || "").trim().toLowerCase();
    if (s === "shipped" || s === "invoiced" || s === "complete") shipStats.shipped++;
    else if (s === "not shipped") shipStats.notShipped++;
    else if (s === "shipping") shipStats.shipping++;
    else if (s.includes("partial")) shipStats.partial++;
    else if (!s) shipStats.noStatus++;
    else shipStats.notShipped++; // catch-all for other non-shipped
  }

  return { awards: enriched, purchaseOrders: allPos, shipStats };
}

export default async function OrdersPage() {
  const { awards, purchaseOrders, shipStats } = await getData();

  return (
    <div className="p-4 md:p-8">
      <AwardsList awards={awards} purchaseOrders={purchaseOrders} shipStats={shipStats} />
    </div>
  );
}
