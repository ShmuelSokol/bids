import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const nsn = req.nextUrl.searchParams.get("nsn");
  if (!nsn) return NextResponse.json({ error: "nsn required" }, { status: 400 });

  const [fsc, ...niinParts] = nsn.split("-");
  const niin = niinParts.join("-");
  const supabase = createServiceClient();

  const [awardsRes, bidsRes, specRes, matchRes] = await Promise.all([
    supabase.from("awards").select("fsc, niin, unit_price, quantity, description, award_date, contract_number, cage").eq("fsc", fsc).eq("niin", niin).order("award_date", { ascending: false }).limit(100),
    supabase.from("abe_bids").select("nsn, bid_price, lead_time_days, bid_qty, bid_date, fob").eq("nsn", nsn).order("bid_date", { ascending: false }).limit(50),
    // Item specs from LamLinks/PUB LOG
    supabase.from("publog_nsns").select("item_name, unit_price, unit_of_issue, cage_code, part_number").eq("nsn", nsn).limit(1),
    // Part number matches
    supabase.from("nsn_matches").select("match_type, confidence, matched_part_number, matched_description, matched_source").eq("nsn", nsn).limit(5),
  ]);

  // Split awards into ours (CAGE=0AG09) vs competitors. Competitor data
  // is sparse today — only populated when /api/dibbs/awards has been
  // run for this NSN. Empty list ≠ "no competitors", just "we haven't
  // scraped yet".
  const allAwards = awardsRes.data || [];
  const ourAwards = allAwards.filter((a: any) => a.cage?.trim() === "0AG09");
  const competitorAwards = allAwards.filter((a: any) => a.cage?.trim() && a.cage.trim() !== "0AG09");

  const response = NextResponse.json({
    awards: ourAwards,
    competitor_awards: competitorAwards,
    bids: bidsRes.data || [],
    itemSpec: specRes.data?.[0] || null,
    matches: matchRes.data || [],
  });
  // Short cache so freshly-imported competitor awards show up quickly
  // for users who already had the page open. 60s is enough to survive
  // a row-toggle storm but won't keep a stale shape around for long.
  response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
  return response;
}
