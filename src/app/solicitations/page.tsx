import { createServiceClient } from "@/lib/supabase-server";
import { SolicitationsList } from "./solicitations-list";

async function getData() {
  const supabase = createServiceClient();

  // Get today's and recent solicitations from DIBBS
  const { data: solicitations } = await supabase
    .from("dibbs_solicitations")
    .select("*")
    .order("scraped_at", { ascending: false })
    .limit(200);

  // Get existing bid decisions
  const { data: decisions } = await supabase
    .from("bid_decisions")
    .select("*")
    .order("created_at", { ascending: false });

  // Get recent awards for pricing history (last bid price per NSN)
  const { data: awards } = await supabase
    .from("awards")
    .select("fsc, niin, unit_price, quantity, description, award_date")
    .order("award_date", { ascending: false })
    .limit(5000);

  // Build pricing lookup: NSN → last award price
  const pricingHistory: Record<
    string,
    { lastPrice: number; avgPrice: number; count: number; desc: string }
  > = {};
  for (const a of awards || []) {
    const nsn = `${a.fsc}-${a.niin}`;
    if (!pricingHistory[nsn]) {
      pricingHistory[nsn] = {
        lastPrice: a.unit_price,
        avgPrice: a.unit_price,
        count: 1,
        desc: a.description || "",
      };
    } else {
      const h = pricingHistory[nsn];
      h.avgPrice = (h.avgPrice * h.count + a.unit_price) / (h.count + 1);
      h.count++;
    }
  }

  // Build decision lookup
  const decisionMap: Record<string, any> = {};
  for (const d of decisions || []) {
    decisionMap[`${d.solicitation_number}_${d.nsn}`] = d;
  }

  // Enrich solicitations with pricing and decision status
  const enriched = (solicitations || []).map((s) => {
    const history = pricingHistory[s.nsn];
    const decision = decisionMap[`${s.solicitation_number}_${s.nsn}`];
    const suggestedPrice = history
      ? Math.round(history.lastPrice * 1.02 * 100) / 100 // 2% increment
      : null;

    return {
      ...s,
      has_history: !!history,
      last_award_price: history?.lastPrice || null,
      avg_award_price: history?.avgPrice || null,
      award_count: history?.count || 0,
      suggested_price: suggestedPrice,
      decision_status: decision?.status || null,
      final_price: decision?.final_price || null,
      comment: decision?.comment || null,
    };
  });

  return { solicitations: enriched };
}

export default async function SolicitationsPage() {
  const { solicitations } = await getData();

  const unbid = solicitations.filter((s) => !s.decision_status);
  const withHistory = solicitations.filter((s) => s.has_history);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Solicitations</h1>
        <p className="text-muted mt-1">
          {solicitations.length} solicitations loaded — {unbid.length} pending
          review, {withHistory.length} with pricing history
        </p>
      </div>

      <SolicitationsList initialData={solicitations} />
    </div>
  );
}
