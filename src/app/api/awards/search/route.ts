import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const nsn = req.nextUrl.searchParams.get("nsn");
  if (!nsn) return NextResponse.json({ error: "nsn required" }, { status: 400 });

  const [fsc, ...niinParts] = nsn.split("-");
  const niin = niinParts.join("-");
  const supabase = createServiceClient();

  const [awardsRes, bidsRes, liveBidsRes, specRes, matchRes, catalogRes, vendorPartsRes, vendorPricesRes, receiptsRes, costRes] = await Promise.all([
    supabase.from("awards").select("id, fsc, niin, unit_price, quantity, description, award_date, contract_number, cage").eq("fsc", fsc).eq("niin", niin).order("award_date", { ascending: false }).limit(200),
    supabase.from("abe_bids").select("id, nsn, bid_price, lead_time_days, bid_qty, bid_date, fob, solicitation_number").eq("nsn", nsn).order("bid_date", { ascending: false }).limit(200),
    supabase.from("abe_bids_live").select("id, nsn, bid_price, lead_days, bid_qty, bid_time, fob, solicitation_number").eq("nsn", nsn).order("bid_time", { ascending: false }).limit(50),
    supabase.from("publog_nsns").select("item_name, unit_price, unit_of_issue, cage_code, part_number").eq("nsn", nsn).limit(1),
    supabase.from("nsn_matches").select("match_type, confidence, matched_part_number, matched_description, matched_source").eq("nsn", nsn).limit(5),
    supabase.from("nsn_catalog").select("nsn, source, description").eq("nsn", nsn).maybeSingle(),
    supabase.from("vendor_parts").select("vendor_account, vendor_part_number, vendor_description, item_number").eq("nsn", nsn),
    supabase.from("nsn_vendor_prices").select("vendor, price, price_source, unit_of_measure, item_number").eq("nsn", nsn).order("price", { ascending: true }),
    supabase.from("po_receipt_history").select("vendor, purchase_price, quantity, uom, po_number, delivery_date, line_status").eq("nsn", nsn).order("delivery_date", { ascending: false }).limit(20),
    supabase.from("nsn_costs").select("nsn, cost, cost_source, vendor, unit_of_measure, item_number").eq("nsn", nsn).maybeSingle(),
  ]);

  const allAwards = awardsRes.data || [];
  const ourAwards = allAwards.filter((a: any) => a.cage?.trim() === "0AG09");
  const competitorAwards = allAwards.filter((a: any) => a.cage?.trim() && a.cage.trim() !== "0AG09");
  // Union historical + live bids, keyed by (solicitation_number, bid time)
  // so we don't double-count the same bid after the nightly import runs.
  const liveBids = (liveBidsRes.data || []).map((b: any) => ({
    id: -((b.id ?? 0) + 1000000), // negative ids so they don't collide with historical
    nsn: b.nsn,
    bid_price: b.bid_price,
    lead_time_days: b.lead_days,
    bid_qty: b.bid_qty,
    bid_date: b.bid_time,
    fob: b.fob,
    solicitation_number: b.solicitation_number,
  }));
  const histBids = bidsRes.data || [];
  const histKeys = new Set(
    histBids.map((b: any) => `${(b.solicitation_number || "").trim()}|${b.bid_date}`)
  );
  const ourBids = [
    ...histBids,
    ...liveBids.filter((b) => !histKeys.has(`${(b.solicitation_number || "").trim()}|${b.bid_date}`)),
  ];

  // Build a unified timeline: one row per event, sorted by date desc.
  // For each competitor-won award, attach the closest bid we made on
  // the same NSN within 90 days BEFORE the award_date — so we can see
  // "we bid $X, they won at $Y".
  type TimelineEvent = {
    date: string | null;
    kind: "our_win" | "competitor_win" | "our_bid";
    identifier: string;
    cage: string | null;
    price: number | null;
    qty: number | null;
    fob: string | null;
    lead_days: number | null;
    description: string | null;
    our_bid_for_this?: {
      price: number | null;
      date: string | null;
      lead_days: number | null;
      sol_no: string | null;
    } | null;
  };

  const linkedBidIds = new Set<number>();
  const timeline: TimelineEvent[] = [];

  for (const a of ourAwards) {
    timeline.push({
      date: a.award_date,
      kind: "our_win",
      identifier: a.contract_number || "",
      cage: a.cage,
      price: a.unit_price,
      qty: a.quantity,
      fob: null,
      lead_days: null,
      description: a.description || null,
    });
  }

  for (const a of competitorAwards) {
    let linked: TimelineEvent["our_bid_for_this"] = null;
    if (a.award_date) {
      const awardMs = new Date(a.award_date).getTime();
      let best: any = null;
      let bestDist = Infinity;
      for (const b of ourBids) {
        if (!b.bid_date) continue;
        const bMs = new Date(b.bid_date).getTime();
        const dist = awardMs - bMs;
        if (dist >= 0 && dist <= 90 * 86_400_000 && dist < bestDist) {
          bestDist = dist;
          best = b;
        }
      }
      if (best) {
        linked = {
          price: best.bid_price,
          date: best.bid_date,
          lead_days: best.lead_time_days,
          sol_no: best.solicitation_number || null,
        };
        if (best.id) linkedBidIds.add(best.id);
      }
    }
    timeline.push({
      date: a.award_date,
      kind: "competitor_win",
      identifier: a.contract_number || "",
      cage: a.cage,
      price: a.unit_price,
      qty: a.quantity,
      fob: null,
      lead_days: null,
      description: a.description || null,
      our_bid_for_this: linked,
    });
  }

  // Bids that aren't already linked to a competitor-award row
  for (const b of ourBids) {
    if (b.id && linkedBidIds.has(b.id)) continue;
    timeline.push({
      date: b.bid_date,
      kind: "our_bid",
      identifier: b.solicitation_number || "",
      cage: null,
      price: b.bid_price,
      qty: b.bid_qty,
      fob: b.fob,
      lead_days: b.lead_time_days,
      description: null,
    });
  }

  // Sort by date descending; nulls last
  timeline.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const catalog = catalogRes.data;
  const axItemNumber = catalog?.source?.replace("AX:", "") || costRes.data?.item_number || null;

  const response = NextResponse.json({
    awards: ourAwards,
    competitor_awards: competitorAwards,
    bids: ourBids,
    timeline,
    itemSpec: specRes.data?.[0] || null,
    matches: matchRes.data || [],
    ax: {
      item_number: axItemNumber,
      description: catalog?.description || null,
      waterfall_cost: costRes.data ? { cost: costRes.data.cost, source: costRes.data.cost_source, vendor: costRes.data.vendor, uom: costRes.data.unit_of_measure } : null,
      suppliers: (vendorPartsRes.data || []).map((vp: any) => {
        const price = (vendorPricesRes.data || []).find((p: any) => p.vendor === vp.vendor_account);
        return {
          vendor: vp.vendor_account,
          vendor_part_number: vp.vendor_part_number,
          vendor_description: vp.vendor_description,
          ax_item: vp.item_number,
          price: price?.price || null,
          price_source: price?.price_source || null,
          uom: price?.unit_of_measure || null,
        };
      }),
      receipts: receiptsRes.data || [],
    },
  });
  response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
  return response;
}
