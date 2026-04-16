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

  const [pricesRes, bidsRes, partsRes, receiptsRes] = await Promise.all([
    supabase.from("nsn_vendor_prices").select("vendor, price, price_source, item_number, updated_at").eq("nsn", nsn).order("price", { ascending: true }),
    supabase.from("abe_bids").select("bid_date").eq("nsn", nsn).order("bid_date", { ascending: false }).limit(1),
    supabase.from("vendor_parts").select("vendor_account, vendor_part_number, vendor_description, item_number").eq("nsn", nsn),
    supabase.from("po_receipt_history").select("vendor, purchase_price, quantity, uom, po_number, delivery_date, line_status").eq("nsn", nsn).order("delivery_date", { ascending: false }).limit(20),
  ]);
  const prices = pricesRes.data;
  const bids = bidsRes.data;
  const vendorParts = partsRes.data || [];
  const receipts = receiptsRes.data || [];

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

  // Enrich with vendor part numbers from AX VendorProductDescriptionsV2
  const partsByVendor = new Map<string, { partNumber: string | null; description: string | null; axItem: string | null }>();
  for (const vp of vendorParts) {
    partsByVendor.set(vp.vendor_account, {
      partNumber: vp.vendor_part_number,
      description: vp.vendor_description,
      axItem: vp.item_number,
    });
  }

  const vendors = Array.from(byVendor.values()).map(v => ({
    ...v,
    vendorPartNumber: partsByVendor.get(v.vendor)?.partNumber || null,
    vendorDescription: partsByVendor.get(v.vendor)?.description || null,
    axItemNumber: partsByVendor.get(v.vendor)?.axItem || v.sources[0]?.item || null,
  })).sort((a, b) => a.cheapest - b.cheapest);

  return NextResponse.json({
    vendors,
    receipts,
    lastBidDate: bids?.[0]?.bid_date || null,
  });
}
