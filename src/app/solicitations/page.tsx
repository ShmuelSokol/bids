import { createServiceClient } from "@/lib/supabase-server";
import { isSourceableOpen, buildFilterContext } from "@/lib/solicitation-filters";
import { isLamlinksWritebackLive, getLamlinksWorkerHealth } from "@/lib/system-settings";
import { SolicitationsList } from "./solicitations-list";
import Link from "next/link";

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

  const cols = "id, nsn, nomenclature, solicitation_number, quantity, issue_date, return_by_date, fsc, set_aside, procurement_type, is_sourceable, source, source_item, suggested_price, our_cost, margin_pct, cost_source, price_source, channel, fob, est_shipping, potential_value, already_bid, last_bid_price, last_bid_date, data_source, competitor_cage, award_count, file_reference, file_reference_date, internal_edi_reference, ship_to_locations, buyer_name, buyer_email, buyer_phone, priority_code, posting_type, required_delivery_days";

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

  const [sourceableItems, recentItems, decisions, liveBids, lastSync] = await Promise.all([
    loadOpenByFlag(true),
    loadOpenByFlag(false),
    paginateAll(supabase, "bid_decisions", "*"),
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
  ]);

  const solicitations = [...sourceableItems, ...recentItems];

  // Only fetch nsn_matches for NSNs actually on the page (was loading 7K rows)
  const nsnsForMatches = [...new Set(solicitations.map((s: any) => s.nsn).filter(Boolean))];
  const nsnMatches: any[] = [];
  for (let i = 0; i < nsnsForMatches.length; i += 500) {
    const chunk = nsnsForMatches.slice(i, i + 500);
    const { data } = await supabase.from("nsn_matches")
      .select("nsn, match_type, confidence, matched_part_number, matched_description, matched_source")
      .in("nsn", chunk);
    nsnMatches.push(...(data || []));
  }

  // Build match lookup — separate authoritative from fuzzy.
  // TITLE_SIMILARITY_* matches can be wrong (e.g. NSN 6509-01-578-7887 title-matched
  // against a DIFFERENT NSN's item because nomenclature was identical). We must NOT
  // surface those as a part number Abe can bid with. They go in a separate warning panel.
  const isFuzzy = (m: any) => typeof m?.match_type === "string" && m.match_type.startsWith("TITLE_SIMILARITY");
  const matchByNsn = new Map<string, any>();
  const fuzzyByNsn = new Map<string, any[]>();
  for (const m of nsnMatches) {
    if (isFuzzy(m)) {
      const arr = fuzzyByNsn.get(m.nsn) || [];
      arr.push(m);
      fuzzyByNsn.set(m.nsn, arr);
    } else {
      if (!matchByNsn.has(m.nsn) || m.confidence === "HIGH") matchByNsn.set(m.nsn, m);
    }
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
      nsn_fuzzy_matches: fuzzyByNsn.get(s.nsn) || null,
    };
  });

  // Per-NSN history counts from materialized view (pre-computed nightly).
  // Was: loaded 44K awards + 12K bids server-side on every page load (~5s).
  // Now: single query against nsn_history_counts view (~50ms).
  const histCountsByNsn = new Map<string, { bids: number; wins: number }>();
  const uniqueNsns = [...new Set(enriched.map((s: any) => s.nsn).filter(Boolean))];
  for (let i = 0; i < uniqueNsns.length; i += 500) {
    const chunk = uniqueNsns.slice(i, i + 500);
    const { data } = await supabase.from("nsn_history_counts").select("nsn, bids, wins").in("nsn", chunk);
    for (const r of data || []) histCountsByNsn.set(r.nsn, { bids: r.bids || 0, wins: r.wins || 0 });
  }
  for (const s of enriched) {
    (s as any)._histCounts = histCountsByNsn.get(s.nsn) || { bids: 0, wins: 0 };
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
  const writebackLive = await isLamlinksWritebackLive();
  const workerHealth = await getLamlinksWorkerHealth();
  const params = await searchParams;

  // If toggle is ON but worker hasn't checked in within 2 min, submits will queue forever.
  // Abe would see "submitted X bids" without anything actually reaching DLA. Loud warning.
  const writebackStalled = writebackLive && !workerHealth.online;

  return (
    <div className="p-4 md:p-8">
      {writebackStalled && (
        <div className="mb-4 rounded-lg border-2 border-red-500 bg-red-50 px-4 py-3 flex items-center justify-between text-sm">
          <div>
            <div className="font-bold text-red-800">🔴 LamLinks worker is OFFLINE — submitted bids will queue but NOT transmit to DLA</div>
            <div className="text-red-700 mt-1 text-xs">
              Worker last heartbeat: {workerHealth.lastHeartbeat ? new Date(workerHealth.lastHeartbeat).toLocaleString() : "never"}
              {workerHealth.ageSeconds !== null && ` (${Math.floor(workerHealth.ageSeconds / 60)} min ago)`}.
              {" "}Start it on NYEVRVSQL001 — <code className="font-mono">schtasks /run /tn &quot;DIBS - Recurring Daemon&quot;</code> — or log into that box to fire the auto-start trigger.
              Until fixed, don&apos;t use the Submit button on Quoted bids; copy to LamLinks manually.
            </div>
          </div>
          <Link href="/settings/lamlinks-writeback" className="text-xs text-red-800 underline shrink-0 ml-4">manage</Link>
        </div>
      )}
      {writebackLive && !writebackStalled && (
        <div className="mb-4 rounded-lg border-2 border-green-400 bg-green-50 px-4 py-2 flex items-center justify-between text-sm">
          <div>
            <span className="font-bold text-green-800">🟢 LamLinks Write-Back is LIVE</span>
            <span className="text-green-700 ml-2">— clicking Submit on Quoted bids will transmit them to LamLinks for DLA.</span>
            {workerHealth.ageSeconds !== null && (
              <span className="text-green-600 text-xs ml-2">(worker: {workerHealth.ageSeconds}s ago)</span>
            )}
          </div>
          <Link href="/settings/lamlinks-writeback" className="text-xs text-green-800 underline">manage</Link>
        </div>
      )}
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
