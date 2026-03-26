import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/orders/switch-supplier
 * Move a PO line from one PO to another (different supplier).
 * If target supplier PO doesn't exist, creates it.
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

  // Get the PO line
  const { data: line } = await supabase
    .from("po_lines")
    .select("*, purchase_orders(*)")
    .eq("id", line_id)
    .single();

  if (!line) {
    return NextResponse.json({ error: "Line not found" }, { status: 404 });
  }

  const oldPoId = line.po_id;

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

  // Move the line
  await supabase
    .from("po_lines")
    .update({ po_id: targetPo.id, supplier: new_supplier })
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

  // Delete empty POs
  const { data: oldLines } = await supabase
    .from("po_lines")
    .select("id")
    .eq("po_id", oldPoId);
  if (!oldLines || oldLines.length === 0) {
    await supabase.from("purchase_orders").delete().eq("id", oldPoId);
  }

  return NextResponse.json({ success: true, new_po_id: targetPo.id });
}
