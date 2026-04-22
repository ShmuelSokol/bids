import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * POST /api/orders/delete-po
 *
 * Deletes a draft PO and resets its awards back to po_generated=false
 * so they reappear in the "new awards" list. Only works on POs that
 * haven't been posted to AX yet (dmf_state is null or "drafted").
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { po_id } = await req.json();
  if (!po_id) return NextResponse.json({ error: "po_id required" }, { status: 400 });

  const supabase = createServiceClient();

  // Check PO exists and is still a draft
  const { data: po } = await supabase.from("purchase_orders").select("id, po_number, dmf_state, ax_po_number").eq("id", po_id).single();
  if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

  if (po.ax_po_number || (po.dmf_state && po.dmf_state !== "drafted")) {
    return NextResponse.json({ error: `Cannot delete — PO is already in AX (state: ${po.dmf_state}, AX PO: ${po.ax_po_number})` }, { status: 400 });
  }

  // Reset awards back to po_generated=false
  const { data: lines } = await supabase.from("po_lines").select("award_id").eq("po_id", po_id);
  const awardIds = (lines || []).map(l => l.award_id).filter(Boolean);
  if (awardIds.length > 0) {
    await supabase.from("awards").update({ po_generated: false, po_id: null }).in("id", awardIds);
  }

  // Delete PO lines then PO
  await supabase.from("po_lines").delete().eq("po_id", po_id);
  await supabase.from("purchase_orders").delete().eq("id", po_id);

  return NextResponse.json({
    ok: true,
    awards_reset: awardIds.length,
    award_ids: awardIds,
    po_number: po.po_number,
  });
}
