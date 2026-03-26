import { createServiceClient } from "@/lib/supabase-server";
import { SolicitationsList } from "./solicitations-list";

async function paginateAll(supabase: any, table: string, select: string, options?: { order?: string }) {
  const all: any[] = [];
  let page = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    if (options?.order) q = q.order(options.order, { ascending: false });
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

  const cols = "id, nsn, nomenclature, solicitation_number, quantity, issue_date, return_by_date, fsc, set_aside, procurement_type, is_sourceable, source, source_item, suggested_price, our_cost, margin_pct, cost_source, price_source, channel, fob, est_shipping, potential_value, already_bid, last_bid_price, last_bid_date, data_source, competitor_cage, award_count";

  // Two fast queries instead of paginating 14K rows
  const [sourceableItems, recentItems, decisions, liveBids, lastSync, nsnMatches] = await Promise.all([
    // Sourceable items — 2 parallel range queries
    Promise.all([
      supabase.from("dibbs_solicitations").select(cols).eq("is_sourceable", true).range(0, 999),
      supabase.from("dibbs_solicitations").select(cols).eq("is_sourceable", true).range(1000, 1999),
    ]).then(([a, b]) => {
      const items = [...(a.data || []), ...(b.data || [])];
      if (a.error) console.error("Supabase sourceable p1 error:", a.error.message);
      if (b.error) console.error("Supabase sourceable p2 error:", b.error.message);
      console.log(`Loaded ${items.length} sourceable items`);
      return items;
    }),
    // Recent unsourceable (last 30 days, for search)
    supabase.from("dibbs_solicitations").select(cols)
      .eq("is_sourceable", false)
      .gte("scraped_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .order("scraped_at", { ascending: false })
      .limit(1000)
      .then((r: any) => r.data || []),
    supabase.from("bid_decisions").select("*").then((r: any) => r.data || []),
    supabase.from("abe_bids_live").select("nsn, bid_price, lead_days, bid_qty, bid_time, fob, solicitation_number").order("bid_time", { ascending: false }).then((r: any) => r.data || []),
    supabase.from("sync_log").select("action, details, created_at").order("created_at", { ascending: false }).limit(1).single().then((r: any) => r.data),
    // NSN matches for unsourceable items
    supabase.from("nsn_matches").select("nsn, match_type, confidence, matched_part_number, matched_description, matched_source").limit(1000).then((r: any) => r.data || []),
  ]);

  // Merge sourceable + recent unsourceable
  const solicitations = [...sourceableItems, ...recentItems];

  // Build match lookup
  const matchByNsn = new Map<string, any>();
  for (const m of nsnMatches) {
    if (!matchByNsn.has(m.nsn) || m.confidence === "HIGH") matchByNsn.set(m.nsn, m);
  }

  const liveBidsBySol = new Set(liveBids.map((lb: any) => lb.solicitation_number?.trim()).filter(Boolean));
  const decisionMap: Record<string, any> = {};
  for (const d of decisions) decisionMap[`${d.solicitation_number}_${d.nsn}`] = d;

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
      nsn_match: matchByNsn.get(s.nsn) || null,
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
