import { createServiceClient } from "@/lib/supabase-server";
import { AwardsList } from "./awards-list";

async function getData() {
  const supabase = createServiceClient();

  // Paginate our awards past 1K default
  const allAwards: any[] = [];
  let awPage = 0;
  while (true) {
    const { data } = await supabase
      .from("awards")
      .select("*")
      .eq("cage", "0AG09")
      .order("award_date", { ascending: false })
      .range(awPage * 1000, (awPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allAwards.push(...data);
    if (data.length < 1000) break;
    awPage++;
  }
  const awards = allAwards;

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
      margin_pct: cost && a.unit_price ? Math.round(((a.unit_price - cost) / a.unit_price) * 100) : null,
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
