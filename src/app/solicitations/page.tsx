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

  // Run ALL queries in parallel for speed
  const [solicitations, decisions, awards, abeBidsHist, liveBids, lastSync] = await Promise.all([
    // Solicitations — all 14K
    paginateAll(supabase, "dibbs_solicitations", "*", { order: "scraped_at" }),
    // Decisions
    supabase.from("bid_decisions").select("*").then((r: any) => r.data || []),
    // Awards — only last 6 months + limit fields for speed
    paginateAll(supabase, "awards", "fsc, niin, unit_price, quantity, description, award_date, contract_number, cage", { order: "award_date" }),
    // Abe bids — historical
    paginateAll(supabase, "abe_bids", "nsn, bid_price, lead_time_days, bid_qty, bid_date, fob", { order: "bid_date" }),
    // Live bids — today
    supabase.from("abe_bids_live").select("nsn, bid_price, lead_days, bid_qty, bid_time, fob, solicitation_number").order("bid_time", { ascending: false }).then((r: any) => r.data || []),
    // Last sync
    supabase.from("sync_log").select("action, details, created_at").order("created_at", { ascending: false }).limit(1).single().then((r: any) => r.data),
  ]);

  // Merge live bids into abe_bids
  const abeBids = [...abeBidsHist];
  for (const lb of liveBids) {
    abeBids.push({ nsn: lb.nsn, bid_price: lb.bid_price, lead_time_days: lb.lead_days, bid_qty: lb.bid_qty, bid_date: lb.bid_time, fob: lb.fob });
  }

  // Build lookups
  const liveBidsBySol = new Set(liveBids.map((lb: any) => lb.solicitation_number?.trim()).filter(Boolean));
  const decisionMap: Record<string, any> = {};
  for (const d of decisions) decisionMap[`${d.solicitation_number}_${d.nsn}`] = d;
  const lastAwardByNsn = new Map<string, number>();
  for (const a of awards) {
    const nsn = `${a.fsc}-${a.niin}`;
    if (!lastAwardByNsn.has(nsn) && a.unit_price > 0) lastAwardByNsn.set(nsn, a.unit_price);
  }

  // Enrich
  const enriched = solicitations.map((s: any) => {
    const decision = decisionMap[`${s.solicitation_number}_${s.nsn}`];
    const lastAward = lastAwardByNsn.get(s.nsn);
    const estValue = s.potential_value || (s.suggested_price ? s.suggested_price * (s.quantity || 1) : null) || (lastAward ? lastAward * (s.quantity || 1) : null);
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
    sourceable: enriched.filter((s: any) => s.is_sourceable && !s.bid_status).length,
    quoted: enriched.filter((s: any) => s.bid_status === "quoted").length,
    submitted: enriched.filter((s: any) => s.bid_status === "submitted").length,
    skipped: enriched.filter((s: any) => s.bid_status === "skipped").length,
  };

  return { solicitations: enriched, counts, awards, abeBids, lastSync };
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
