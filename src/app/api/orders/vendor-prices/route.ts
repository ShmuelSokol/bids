import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * GET /api/orders/vendor-prices?nsn=6515-01-234-5678
 * Returns all vendors + their prices + last PO date for an NSN
 */
export async function GET(req: NextRequest) {
  const nsn = req.nextUrl.searchParams.get("nsn");
  if (!nsn) {
    return NextResponse.json({ error: "nsn required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: prices } = await supabase
    .from("nsn_vendor_prices")
    .select("vendor, price, price_source, item_number, updated_at")
    .eq("nsn", nsn)
    .order("price", { ascending: true });

  // Also get last PO dates from abe_bids for this NSN (bid_date as proxy for PO activity)
  const { data: bids } = await supabase
    .from("abe_bids")
    .select("bid_date")
    .eq("nsn", nsn)
    .order("bid_date", { ascending: false })
    .limit(1);

  if (!prices || prices.length === 0) {
    return NextResponse.json({ vendors: [] });
  }

  // Group by vendor
  const byVendor = new Map<
    string,
    {
      vendor: string;
      sources: { source: string; price: number; item: string; date: string | null }[];
      cheapest: number;
      lastPoDate: string | null;
    }
  >();

  for (const p of prices) {
    if (!byVendor.has(p.vendor)) {
      byVendor.set(p.vendor, {
        vendor: p.vendor,
        sources: [],
        cheapest: p.price,
        lastPoDate: null,
      });
    }
    const v = byVendor.get(p.vendor)!;
    v.sources.push({
      source: p.price_source,
      price: p.price,
      item: p.item_number,
      date: p.updated_at,
    });
    if (p.price < v.cheapest) v.cheapest = p.price;
    // Track most recent date for "recent_po" entries as last PO date
    if (p.price_source === "recent_po" && p.updated_at) {
      if (!v.lastPoDate || p.updated_at > v.lastPoDate) {
        v.lastPoDate = p.updated_at;
      }
    }
  }

  const vendors = Array.from(byVendor.values()).sort(
    (a, b) => a.cheapest - b.cheapest
  );

  return NextResponse.json({
    vendors,
    lastBidDate: bids?.[0]?.bid_date || null,
  });
}
