import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { computeMarginPct } from "@/lib/margin";

/**
 * POST /api/orders/switch-supplier
 * Move a PO line from one PO to another (different supplier).
 * If target supplier PO doesn't exist, creates it.
 *
 * When the line is moved we also re-cost it using the new supplier's price
 * from nsn_vendor_prices (cheapest available for that NSN/vendor). Keeping
 * the old cost produces misleading margin numbers.
 *
 * If the old PO becomes empty after the move, the awards that were linked
 * to it are restored to po_generated=false so they reappear in the
 * "New only (no PO yet)" filter.
 */
export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const { line_id, new_supplier } = await req.json();

  if (!line_id || !new_supplier) {
    return NextResponse.json(
      { error: "line_id and new_supplier required" },
      { status: 400 }
    );
  }

  // Get the PO line (with nsn for cost lookup)
  const { data: line } = await supabase
    .from("po_lines")
    .select("*, purchase_orders(*)")
    .eq("id", line_id)
    .single();

  if (!line) {
    return NextResponse.json({ error: "Line not found" }, { status: 404 });
  }

  const oldPoId = line.po_id;

  // Look up the new supplier's cost for this NSN so we can re-cost the line.
  // If nothing found, keep the existing cost and surface a warning.
  let newUnitCost: number = line.unit_cost;
  let costWarning: string | null = null;
  if (line.nsn) {
    const { data: vendorPrice } = await supabase
      .from("nsn_vendor_prices")
      .select("price")
      .eq("nsn", line.nsn)
      .eq("vendor", new_supplier)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (vendorPrice?.price && vendorPrice.price > 0) {
      newUnitCost = vendorPrice.price;
    } else {
      costWarning = `No vendor price found for ${line.nsn} at ${new_supplier}; keeping previous unit_cost of ${line.unit_cost}`;
    }
  }

  const quantity = line.quantity || 0;
  const sellPrice = line.sell_price || 0;
  const newTotalCost = newUnitCost * quantity;
  const newMarginPct = computeMarginPct(sellPrice, newUnitCost) ?? 0;

  // Find or create PO for new supplier
  let { data: targetPo } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("supplier", new_supplier)
    .eq("status", "draft")
    .single();

  if (!targetPo) {
    const poNumber = `PO-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-SW-${Date.now().toString(36).toUpperCase()}`;
    const { data: newPo } = await supabase
      .from("purchase_orders")
      .insert({
        po_number: poNumber,
        supplier: new_supplier,
        status: "draft",
        total_cost: 0,
        line_count: 0,
      })
      .select()
      .single();
    targetPo = newPo;
  }

  if (!targetPo) {
    return NextResponse.json(
      { error: "Failed to create target PO" },
      { status: 500 }
    );
  }

  // Move the line and re-cost it with the new supplier's price
  await supabase
    .from("po_lines")
    .update({
      po_id: targetPo.id,
      supplier: new_supplier,
      unit_cost: newUnitCost,
      total_cost: newTotalCost,
      margin_pct: newMarginPct,
    })
    .eq("id", line_id);

  // Update line counts and totals on both POs
  for (const poId of [oldPoId, targetPo.id]) {
    const { data: lines } = await supabase
      .from("po_lines")
      .select("total_cost")
      .eq("po_id", poId);
    const total = (lines || []).reduce(
      (s: number, l: any) => s + (l.total_cost || 0),
      0
    );
    await supabase
      .from("purchase_orders")
      .update({
        line_count: (lines || []).length,
        total_cost: total,
      })
      .eq("id", poId);
  }

  // If the old PO is now empty, reset its awards' po_generated flag so they
  // re-appear in "New only" filter, then delete the empty PO.
  const { data: oldLines } = await supabase
    .from("po_lines")
    .select("id")
    .eq("po_id", oldPoId);
  if (!oldLines || oldLines.length === 0) {
    await supabase
      .from("awards")
      .update({ po_generated: false, po_id: null })
      .eq("po_id", oldPoId);
    await supabase.from("purchase_orders").delete().eq("id", oldPoId);
  }

  return NextResponse.json({
    success: true,
    new_po_id: targetPo.id,
    new_unit_cost: newUnitCost,
    new_margin_pct: newMarginPct,
    warning: costWarning,
  });
}
