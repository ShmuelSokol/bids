import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * POST /api/orders/add-supplier
 *
 * Adds a new vendor to nsn_vendor_prices for an NSN and optionally
 * switches a PO line to that vendor. Used when Abe gets a quote from
 * a new supplier (e.g. the manufacturer instead of a reseller) and
 * wants to use them for this order AND future orders.
 *
 * The vendor also needs a trade agreement created in AX manually —
 * this route handles the DIBS side so the cost data is available
 * for future PO generation and pricing.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { nsn, vendor, price, line_id } = await req.json();
  if (!nsn || !vendor) {
    return NextResponse.json({ error: "nsn and vendor are required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Upsert the vendor into nsn_vendor_prices
  const row: any = {
    nsn,
    vendor: vendor.trim().toUpperCase(),
    price_source: "manual (added via supplier switch)",
    updated_at: new Date().toISOString(),
  };
  if (price && price > 0) row.price = price;

  const { error: upsertErr } = await supabase
    .from("nsn_vendor_prices")
    .upsert(row, { onConflict: "nsn,vendor" });

  if (upsertErr) {
    return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 500 });
  }

  // Also update nsn_costs if this is cheaper than current best
  if (price && price > 0) {
    const { data: current } = await supabase
      .from("nsn_costs")
      .select("cost")
      .eq("nsn", nsn)
      .single();

    if (!current || !current.cost || price < current.cost) {
      await supabase.from("nsn_costs").upsert({
        nsn,
        cost: price,
        cost_source: `Manual add (${vendor.trim().toUpperCase()})`,
        vendor: vendor.trim().toUpperCase(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "nsn" });
    }
  }

  // Switch the PO line if requested
  if (line_id) {
    await supabase
      .from("po_lines")
      .update({
        supplier: vendor.trim().toUpperCase(),
        cost: price && price > 0 ? price : undefined,
      })
      .eq("id", line_id);
  }

  return NextResponse.json({ ok: true, vendor: vendor.trim().toUpperCase(), nsn });
}
