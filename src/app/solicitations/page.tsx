import { createServiceClient } from "@/lib/supabase-server";
import { SolicitationsList } from "./solicitations-list";

async function getData() {
  const supabase = createServiceClient();

  // Load all solicitations (paginate past Supabase 1K default)
  const allSolicitations: any[] = [];
  let solPage = 0;
  while (true) {
    const { data } = await supabase
      .from("dibbs_solicitations")
      .select("*")
      .order("scraped_at", { ascending: false })
      .range(solPage * 1000, (solPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allSolicitations.push(...data);
    if (data.length < 1000) break;
    solPage++;
  }
  const solicitations = allSolicitations;

  const { data: decisions } = await supabase
    .from("bid_decisions")
    .select("*");

  // Award history — paginate past Supabase 1K default
  const allAwards: any[] = [];
  let awardPage = 0;
  while (true) {
    const { data } = await supabase
      .from("awards")
      .select("fsc, niin, unit_price, quantity, description, award_date, contract_number, cage")
      .order("award_date", { ascending: false })
      .range(awardPage * 1000, (awardPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allAwards.push(...data);
    if (data.length < 1000) break;
    awardPage++;
  }
  const awards = allAwards;

  // Abe's bid history — paginate
  const allAbeBids: any[] = [];
  let bidPage = 0;
  while (true) {
    const { data } = await supabase
      .from("abe_bids")
      .select("nsn, bid_price, lead_time_days, bid_qty, bid_date, fob")
      .order("bid_date", { ascending: false })
      .range(bidPage * 1000, (bidPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allAbeBids.push(...data);
    if (data.length < 1000) break;
    bidPage++;
  }
  // Also load today's live bids
  const { data: liveBids } = await supabase
    .from("abe_bids_live")
    .select("nsn, bid_price, lead_days, bid_qty, bid_time, fob, solicitation_number, bid_status, item_desc")
    .order("bid_time", { ascending: false });

  // Merge live bids into abe_bids format
  for (const lb of liveBids || []) {
    allAbeBids.push({
      nsn: lb.nsn,
      bid_price: lb.bid_price,
      lead_time_days: lb.lead_days,
      bid_qty: lb.bid_qty,
      bid_date: lb.bid_time,
      fob: lb.fob,
    });
  }
  const abeBids = allAbeBids;

  // Build live bid lookup by solicitation number for already_bid detection
  const liveBidsBySol = new Set<string>();
  for (const lb of liveBids || []) {
    if (lb.solicitation_number) liveBidsBySol.add(lb.solicitation_number.trim());
  }

  const decisionMap: Record<string, any> = {};
  for (const d of decisions || []) {
    decisionMap[`${d.solicitation_number}_${d.nsn}`] = d;
  }

  // Build last award price lookup for unsourced items
  const lastAwardByNsn = new Map<string, number>();
  for (const a of awards || []) {
    const nsn = `${a.fsc}-${a.niin}`;
    if (!lastAwardByNsn.has(nsn) && a.unit_price > 0) {
      lastAwardByNsn.set(nsn, a.unit_price);
    }
  }

  const enriched = (solicitations || []).map((s) => {
    const decision = decisionMap[`${s.solicitation_number}_${s.nsn}`];
    // For unsourced items: estimate value from last award price × qty
    const lastAward = lastAwardByNsn.get(s.nsn);
    const estValue = s.potential_value || (s.suggested_price ? s.suggested_price * (s.quantity || 1) : null) || (lastAward ? lastAward * (s.quantity || 1) : null);
    // Check if Abe bid on this today (live bids)
    const bidToday = liveBidsBySol.has(s.solicitation_number?.trim());
    return {
      ...s,
      bid_status: decision?.status || null,
      final_price: decision?.final_price || null,
      bid_comment: decision?.comment || null,
      decided_by: decision?.decided_by || null,
      already_bid: s.already_bid || bidToday,
      est_value: estValue,
      last_award_price: lastAward || null,
    };
  });

  const counts = {
    total: enriched.length,
    sourceable: enriched.filter((s) => s.is_sourceable && !s.bid_status).length,
    quoted: enriched.filter((s) => s.bid_status === "quoted").length,
    submitted: enriched.filter((s) => s.bid_status === "submitted").length,
    skipped: enriched.filter((s) => s.bid_status === "skipped").length,
  };

  // Last sync time
  const { data: lastSync } = await supabase
    .from("sync_log")
    .select("action, details, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return {
    solicitations: enriched,
    counts,
    awards: awards || [],
    abeBids: abeBids || [],
    lastSync: lastSync || null,
  };
}

export default async function SolicitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sort?: string }>;
}) {
  const { solicitations, counts, awards, abeBids, lastSync } = await getData();
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
        abeBidHistory={abeBids}
        initialFilter={params.filter}
        initialSort={params.sort}
        lastSync={lastSync}
      />
    </div>
  );
}
