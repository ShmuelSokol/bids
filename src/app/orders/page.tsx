import { createServiceClient } from "@/lib/supabase-server";
import { AwardsList } from "./awards-list";
import { computeMarginPct } from "@/lib/margin";

async function getData() {
  const supabase = createServiceClient();

  // Load recent awards (last 90 days). Paginate to avoid the Supabase
  // 1000-row default limit — we've seen >1000 awards in 90 days.
  const sinceIso = new Date(Date.now() - 90 * 86400000).toISOString();
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

  // Load cost data for margin calculation — paginate (24K+ rows)
  const allCosts: any[] = [];
  for (let p = 0; p < 30; p++) {
    const { data } = await supabase
      .from("nsn_costs")
      .select("nsn, cost, cost_source")
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allCosts.push(...data);
    if (data.length < 1000) break;
  }
  const costMap = new Map<string, number>();
  for (const c of allCosts) {
    if (c.cost > 0) costMap.set(c.nsn, c.cost);
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

  // Enrich awards with cost/margin
  const enriched = awards.map((a: any) => {
    const nsn = `${a.fsc}-${a.niin}`;
    const cost = costMap.get(nsn);
    return {
      ...a,
      nsn,
      our_cost: cost || null,
      margin_pct: computeMarginPct(a.unit_price, cost),
    };
  });

  return { awards: enriched, purchaseOrders: allPos };
}

export default async function OrdersPage() {
  const { awards, purchaseOrders } = await getData();

  return (
    <div className="p-4 md:p-8">
      <AwardsList awards={awards} purchaseOrders={purchaseOrders} />
    </div>
  );
}
