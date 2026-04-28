import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/invoicing/post-all
 * body: { ids?: number[] }   // optional — defaults to all 'pending' rows
 *
 * Flips queue rows from 'pending' → 'approved'. The writeback worker
 * (running on the daemon host) drains 'approved' rows on its next pass.
 *
 * Two-click flow:
 *   1. Import → /api/invoicing/import (queue fills with state='pending')
 *   2. Post All → this route (state='pending' → 'approved')
 *
 * Caller polls the queue to see rows transition pending → processing → posted.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sb = createServiceClient();

  let q = sb.from("lamlinks_invoice_queue").update({ state: "approved" }).eq("state", "pending");
  if (Array.isArray(body.ids) && body.ids.length > 0) {
    q = q.in("id", body.ids);
  }
  const { data, error } = await q.select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ approved: (data || []).length, ids: (data || []).map((r: any) => r.id) });
}
