import { createServiceClient } from "@/lib/supabase-server";
import { SolicitationsList } from "./solicitations-list";

async function paginateAll(supabase: any, table: string, select: string, options?: { order?: string; eq?: [string, any] }) {
  const all: any[] = [];
  let page = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (options?.order) q = q.order(options.order, { ascending: false });
    if (options?.eq) q = q.eq(options.eq[0], options.eq[1]);
    const { data } = await q;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

async function getData() {
  const supabase = createServiceClient();

  // Run queries in parallel — but DON'T load awards/bids upfront (lazy loaded)
  const [solicitations, decisions, liveBids, lastSync] = await Promise.all([
    // Solicitations — all 14K (minimal columns for speed)
    paginateAll(supabase, "dibbs_solicitations",
      "id, nsn, nomenclature, solicitation_number, quantity, issue_date, return_by_date, fsc, set_aside, procurement_type, is_sourceable, source, source_item, suggested_price, our_cost, margin_pct, cost_source, price_source, channel, fob, est_shipping, potential_value, already_bid, last_bid_price, last_bid_date, est_value, data_source, competitor_cage, award_count",
      { order: "scraped_at" }
    ),
    // Decisions
    supabase.from("bid_decisions").select("*").then((r: any) => r.data || []),
    // Live bids — today only (small)
    supabase.from("abe_bids_live").select("nsn, bid_price, lead_days, bid_qty, bid_time, fob, solicitation_number").order("bid_time", { ascending: false }).then((r: any) => r.data || []),
    // Last sync
    supabase.from("sync_log").select("action, details, created_at").order("created_at", { ascending: false }).limit(1).single().then((r: any) => r.data),
  ]);

  // Build lookups from live bids
  const liveBidsBySol = new Set(liveBids.map((lb: any) => lb.solicitation_number?.trim()).filter(Boolean));
  const decisionMap: Record<string, any> = {};
  for (const d of decisions) decisionMap[`${d.solicitation_number}_${d.nsn}`] = d;

  // Enrich (without awards — those are lazy loaded now)
  const enriched = solicitations.map((s: any) => {
    const decision = decisionMap[`${s.solicitation_number}_${s.nsn}`];
    const bidToday = liveBidsBySol.has(s.solicitation_number?.trim());
    return {
      ...s,
      bid_status: decision?.status || null,
      final_price: decision?.final_price || null,
      bid_comment: decision?.comment || null,
      decided_by: decision?.decided_by || null,
      already_bid: s.already_bid || bidToday,
    };
  });

  const counts = {
    total: enriched.length,
    sourceable: enriched.filter((s: any) => s.is_sourceable && !s.bid_status).length,
    quoted: enriched.filter((s: any) => s.bid_status === "quoted").length,
    submitted: enriched.filter((s: any) => s.bid_status === "submitted").length,
    skipped: enriched.filter((s: any) => s.bid_status === "skipped").length,
  };

  return { solicitations: enriched, counts, lastSync };
}

export default async function SolicitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sort?: string }>;
}) {
  const { solicitations, counts, lastSync } = await getData();
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
        awardHistory={[]}
        abeBidHistory={[]}
        initialFilter={params.filter}
        initialSort={params.sort}
        lastSync={lastSync}
      />
    </div>
  );
}
