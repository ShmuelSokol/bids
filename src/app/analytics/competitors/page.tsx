import { createServiceClient } from "@/lib/supabase-server";
import { CompetitorDashboard } from "./competitor-dashboard";

export const dynamic = "force-dynamic";

async function getData() {
  const sb = createServiceClient();
  const since = new Date(Date.now() - 365 * 86_400_000).toISOString();

  // Paginate the awards table (~5K+ rows; Supabase default cap is 1K per call)
  const awards: any[] = [];
  for (let page = 0; page < 20; page++) {
    const { data } = await sb
      .from("awards")
      .select("id, contract_number, fsc, niin, cage, unit_price, quantity, award_date, description")
      .gte("award_date", since)
      .order("award_date", { ascending: false })
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    awards.push(...data);
    if (data.length < 1000) break;
  }

  return { awards };
}

export default async function CompetitorsPage() {
  const { awards } = await getData();
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <CompetitorDashboard awards={awards} />
    </div>
  );
}
