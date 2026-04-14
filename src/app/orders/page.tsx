import { createServiceClient } from "@/lib/supabase-server";
import { AwardsList } from "./awards-list";
import { computeMarginPct } from "@/lib/margin";

async function getData() {
  const supabase = createServiceClient();

  // Load recent awards only (last 90 days) — avoid Railway timeout on 74K rows
  const { data: awards } = await supabase
    .from("awards")
    .select("*")
    .eq("cage", "0AG09")
    .gte("award_date", new Date(Date.now() - 90 * 86400000).toISOString())
    .order("award_date", { ascending: false })
    .limit(1000);

  // Load cost data for margin calculation
  const { data: costs } = await supabase
    .from("nsn_costs")
    .select("nsn, cost, cost_source");
  const costMap = new Map<string, number>();
  for (const c of costs || []) {
    if (c.cost > 0) costMap.set(c.nsn, c.cost);
  }

  // Load existing POs
  const { data: pos } = await supabase
    .from("purchase_orders")
    .select("*, po_lines(*)")
    .order("created_at", { ascending: false });

  // Enrich awards with cost/margin
  const enriched = (awards || []).map((a) => {
    const nsn = `${a.fsc}-${a.niin}`;
    const cost = costMap.get(nsn);
    return {
      ...a,
      nsn,
      our_cost: cost || null,
      margin_pct: computeMarginPct(a.unit_price, cost),
    };
  });

  return { awards: enriched, purchaseOrders: pos || [] };
}

export default async function OrdersPage() {
  const { awards, purchaseOrders } = await getData();

  return (
    <div className="p-4 md:p-8">
      <AwardsList awards={awards} purchaseOrders={purchaseOrders} />
    </div>
  );
}
