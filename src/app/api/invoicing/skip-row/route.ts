import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/invoicing/skip-row
 * body: { id: number }
 *
 * Removes a queue row by id. Use the per-row "✕ Skip" button to drop a
 * specific invoice from today's batch (Abe will do it manually).
 * Only deletes 'pending' rows — refuses for processing/posted/error to
 * preserve audit trail.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("lamlinks_invoice_queue")
    .delete()
    .eq("id", id)
    .eq("state", "pending")
    .select("id, ax_invoice_number");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "row not pending or not found" }, { status: 404 });
  return NextResponse.json({ skipped: data[0].ax_invoice_number });
}
