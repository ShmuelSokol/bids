import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * POST /api/orders/delete-pos-batch
 *
 * Bulk-delete draft POs in one round-trip. For each requested id:
 *   - skip if already posted to AX (ax_po_number set or dmf_state != 'drafted')
 *   - release its awards back to po_generated=false
 *   - delete the po_lines + purchase_orders rows
 *
 * Body: { po_ids: number[] }
 *
 * Returns:
 *   { ok: true, deleted: N, skipped: [{ po_id, reason }], awards_reset: [...] }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const poIds: number[] = Array.isArray(body.po_ids) ? body.po_ids : [];
  if (poIds.length === 0) {
    return NextResponse.json({ error: "po_ids[] required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch all candidates in one query
  const { data: candidates, error: fetchErr } = await supabase
    .from("purchase_orders")
    .select("id, po_number, dmf_state, ax_po_number")
    .in("id", poIds);
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const deletable = [];
  const skipped: Array<{ po_id: number; reason: string }> = [];
  for (const p of candidates || []) {
    if (p.ax_po_number) {
      skipped.push({ po_id: p.id, reason: `already has AX PO #${p.ax_po_number}` });
      continue;
    }
    // Safe states for deletion: anything before AX has assigned a PO number.
    // 'awaiting_po_number' is a common stuck state when an upstream AX sync
    // failed; deleting locally is fine since AX never confirmed a number.
    const state = p.dmf_state || "drafted";
    if (state !== "drafted" && state !== "awaiting_po_number") {
      skipped.push({ po_id: p.id, reason: `state=${state}, AX may have it — not safe to delete locally` });
      continue;
    }
    deletable.push(p);
  }
  for (const id of poIds) {
    if (!candidates?.find((c) => c.id === id)) {
      skipped.push({ po_id: id, reason: "not found" });
    }
  }

  if (deletable.length === 0) {
    return NextResponse.json({
      ok: true,
      deleted: 0,
      skipped,
      awards_reset: [],
      message: "Nothing eligible to delete",
    });
  }

  const delIds = deletable.map((p) => p.id);

  // Collect all award ids from po_lines, reset them in one update
  const { data: lines } = await supabase.from("po_lines").select("award_id").in("po_id", delIds);
  const awardIds = [...new Set((lines || []).map((l: any) => l.award_id).filter(Boolean))];
  if (awardIds.length > 0) {
    await supabase.from("awards").update({ po_generated: false, po_id: null }).in("id", awardIds);
  }

  // Delete lines + headers
  await supabase.from("po_lines").delete().in("po_id", delIds);
  await supabase.from("purchase_orders").delete().in("id", delIds);

  // Audit log
  await supabase.from("sync_log").insert({
    action: "po_deleted_batch",
    details: {
      user: user.profile?.full_name || user.user.email,
      deleted: deletable.map((p) => ({ id: p.id, po_number: p.po_number })),
      skipped,
      awards_reset: awardIds.length,
    },
  });

  return NextResponse.json({
    ok: true,
    deleted: deletable.length,
    deleted_po_numbers: deletable.map((p) => p.po_number),
    deleted_po_ids: delIds,
    skipped,
    awards_reset: awardIds.length,
    award_ids: awardIds,
  });
}
