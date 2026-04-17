import { createServiceClient } from "@/lib/supabase-server";
import { isSourceableOpen, buildFilterContext } from "@/lib/solicitation-filters";
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

  // Helper: load all rows matching an is_sourceable filter, paginated.
  // Two hard-coded range calls (0-999 + 1000-1999) silently capped at 2K
  // rows — with 5,510 sourceable items in the DB the dashboard saw 253
  // open while this page only saw 46. Loop until empty, with a safety cap.
  // Only load OPEN (non-expired) solicitations using the normalized
  // return_by_date_iso column. Previous approach loaded 13,534 rows
  // (including 18,781 expired) and filtered client-side.
  const todayIso = new Date().toISOString().split("T")[0];

  async function loadOpenByFlag(flag: boolean, maxPages = 25) {
    const items: any[] = [];
    for (let page = 0; page < maxPages; page++) {
      const { data, error } = await supabase
        .from("dibbs_solicitations")
        .select(cols + ", return_by_date_iso")
        .eq("is_sourceable", flag)
        .gte("return_by_date_iso", todayIso)
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (error) {
        console.error(`Supabase ${flag ? "sourceable" : "unsourced"} page ${page} error:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;
      items.push(...data);
      if (data.length < 1000) break;
    }
    return items;
  }

  const [sourceableItems, recentItems, decisions, liveBids, lastSync, nsnMatches] = await Promise.all([
    loadOpenByFlag(true),
    loadOpenByFlag(false), // all open unsourced — no cap needed since we filter to non-expired

    paginateAll(supabase, "bid_decisions", "*"),
    // Pull last 30 days of bids (not just today) so yesterday's/
    // Monday's bids correctly dedup solicitations off the Sourceable
    // list. Paginated — ~50 bids/day × 30 = ~1500, can exceed 1000.
    (async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const all: any[] = [];
      for (let p = 0; p < 10; p++) {
        const { data } = await supabase
          .from("abe_bids_live")
          .select("nsn, bid_price, lead_days, bid_qty, bid_time, fob, solicitation_number")
          .order("bid_time", { ascending: false })
          .gte("bid_time", since)
          .range(p * 1000, (p + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < 1000) break;
      }
      return all;
    })(),
    supabase.from("sync_log").select("action, details, created_at").order("created_at", { ascending: false }).limit(1).single().then((r: any) => r.data),
    paginateAll(supabase, "nsn_matches", "nsn, match_type, confidence, matched_part_number, matched_description, matched_source"),
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

  // Per-NSN history counts: bids and wins
  // Bids: count from the 30d abe_bids_live already loaded (by NSN)
  const bidCountByNsn = new Map<string, number>();
  for (const b of liveBids) {
    if ((b as any).nsn) bidCountByNsn.set((b as any).nsn, (bidCountByNsn.get((b as any).nsn) || 0) + 1);
  }
  // Also count from abe_bids (historical) — paginate
  const abeBidsForCount = await paginateAll(supabase, "abe_bids", "nsn");
  for (const b of abeBidsForCount) {
    if (b.nsn && !bidCountByNsn.has(b.nsn)) bidCountByNsn.set(b.nsn, 0);
    if (b.nsn) bidCountByNsn.set(b.nsn, (bidCountByNsn.get(b.nsn) || 0) + 1);
  }
  // Wins: count our awards per NSN
  const winCountByNsn = new Map<string, number>();
  const allOurAwards: any[] = [];
  for (let p = 0; p < 50; p++) {
    const { data } = await supabase.from("awards").select("fsc, niin").eq("cage", "0AG09").range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allOurAwards.push(...data);
    if (data.length < 1000) break;
  }
  for (const a of allOurAwards) {
    const nsn = `${a.fsc}-${a.niin}`;
    winCountByNsn.set(nsn, (winCountByNsn.get(nsn) || 0) + 1);
  }
  // Attach to enriched items
  for (const s of enriched) {
    (s as any)._histCounts = {
      bids: bidCountByNsn.get(s.nsn) || 0,
      wins: winCountByNsn.get(s.nsn) || 0,
    };
  }

  const ctx = buildFilterContext(liveBids, decisions);
  const counts = {
    total: enriched.length,
    sourceable: enriched.filter((s: any) => isSourceableOpen(s, ctx)).length,
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
