import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const nsn = req.nextUrl.searchParams.get("nsn");
  if (!nsn) return NextResponse.json({ error: "nsn required" }, { status: 400 });

  const [fsc, ...niinParts] = nsn.split("-");
  const niin = niinParts.join("-");
  const supabase = createServiceClient();

  const [awardsRes, bidsRes] = await Promise.all([
    supabase.from("awards").select("fsc, niin, unit_price, quantity, description, award_date, contract_number, cage").eq("fsc", fsc).eq("niin", niin).order("award_date", { ascending: false }).limit(50),
    supabase.from("abe_bids").select("nsn, bid_price, lead_time_days, bid_qty, bid_date, fob").eq("nsn", nsn).order("bid_date", { ascending: false }).limit(50),
  ]);

  const response = NextResponse.json({ awards: awardsRes.data || [], bids: bidsRes.data || [] });
  response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  return response;
}
