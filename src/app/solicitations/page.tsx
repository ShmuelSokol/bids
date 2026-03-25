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

  // Build decision lookup
  const decisionMap: Record<string, any> = {};
  for (const d of decisions || []) {
    decisionMap[`${d.solicitation_number}_${d.nsn}`] = d;
  }

  // Merge decisions into solicitations
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

  return { solicitations: enriched, counts };
}

export default async function SolicitationsPage() {
  const { solicitations, counts } = await getData();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Solicitations</h1>
        <p className="text-muted mt-1">
          {counts.total} loaded — {counts.sourceable} sourceable,{" "}
          {counts.quoted} quoted, {counts.submitted} submitted
        </p>
      </div>
      <SolicitationsList initialData={solicitations} counts={counts} />
    </div>
  );
}
