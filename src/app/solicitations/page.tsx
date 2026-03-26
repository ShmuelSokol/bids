import { createServiceClient } from "@/lib/supabase-server";
import { SolicitationsList } from "./solicitations-list";

async function getData() {
  const supabase = createServiceClient();

  const { data: solicitations } = await supabase
    .from("dibbs_solicitations")
    .select("*")
    .order("scraped_at", { ascending: false })
    .limit(500);

  const { data: decisions } = await supabase
    .from("bid_decisions")
    .select("*");

  // Award history for bid history display
  const { data: awards } = await supabase
    .from("awards")
    .select("fsc, niin, unit_price, quantity, description, award_date, contract_number, cage")
    .order("award_date", { ascending: false })
    .limit(5000);

  const decisionMap: Record<string, any> = {};
  for (const d of decisions || []) {
    decisionMap[`${d.solicitation_number}_${d.nsn}`] = d;
  }

  const enriched = (solicitations || []).map((s) => {
    const decision = decisionMap[`${s.solicitation_number}_${s.nsn}`];
    return {
      ...s,
      bid_status: decision?.status || null,
      final_price: decision?.final_price || null,
      bid_comment: decision?.comment || null,
      decided_by: decision?.decided_by || null,
    };
  });

  const counts = {
    total: enriched.length,
    sourceable: enriched.filter((s) => s.is_sourceable && !s.bid_status).length,
    quoted: enriched.filter((s) => s.bid_status === "quoted").length,
    submitted: enriched.filter((s) => s.bid_status === "submitted").length,
    skipped: enriched.filter((s) => s.bid_status === "skipped").length,
  };

  return { solicitations: enriched, counts, awards: awards || [] };
}

export default async function SolicitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sort?: string }>;
}) {
  const { solicitations, counts, awards } = await getData();
  const params = await searchParams;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Solicitations</h1>
        <p className="text-muted mt-1 text-sm">
          {counts.total} loaded — {counts.sourceable} sourceable,{" "}
          {counts.quoted} quoted, {counts.submitted} submitted
        </p>
      </div>
      <SolicitationsList
        initialData={solicitations}
        counts={counts}
        awardHistory={awards}
        initialFilter={params.filter}
        initialSort={params.sort}
      />
    </div>
  );
}
