import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * GET /api/orders/vendor-prices?nsn=6515-01-234-5678
 * Returns all vendors + their prices for an NSN (from price agreements + PO history)
 */
export async function GET(req: NextRequest) {
  const nsn = req.nextUrl.searchParams.get("nsn");
  if (!nsn) {
    return NextResponse.json({ error: "nsn required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: prices } = await supabase
    .from("nsn_vendor_prices")
    .select("vendor, price, price_source, item_number")
    .eq("nsn", nsn)
    .order("price", { ascending: true });

  if (!prices || prices.length === 0) {
    return NextResponse.json({ vendors: [] });
  }

  // Group by vendor, show each price source
  const byVendor = new Map<
    string,
    { vendor: string; sources: { source: string; price: number; item: string }[]; cheapest: number }
  >();

  for (const p of prices) {
    if (!byVendor.has(p.vendor)) {
      byVendor.set(p.vendor, {
        vendor: p.vendor,
        sources: [],
        cheapest: p.price,
      });
    }
    const v = byVendor.get(p.vendor)!;
    v.sources.push({
      source: p.price_source,
      price: p.price,
      item: p.item_number,
    });
    if (p.price < v.cheapest) v.cheapest = p.price;
  }

  // Sort by cheapest price
  const vendors = Array.from(byVendor.values()).sort(
    (a, b) => a.cheapest - b.cheapest
  );

  return NextResponse.json({ vendors });
}
