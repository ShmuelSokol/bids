import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/invoicing/refresh-from-ll
 * Enqueues a 'refresh_invoice_queue_from_ll' rescue action. The daemon
 * worker on GLOVE runs scripts/_premark-already-invoiced.ts which scans
 * LL kad_tab for today's posted DD219 invoices and updates the queue
 * (matching rows → state='posted', new ones inserted as posted).
 *
 * Use when Abe posts manually and you want DIBS to reflect the truth
 * without doing a full Import (which also re-pulls from AX).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const date = String(body.date || new Date().toISOString().slice(0, 10)).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("lamlinks_rescue_actions")
    .insert({
      action: "refresh_invoice_queue_from_ll",
      params: { date },
      requested_by: "invoicing-post-batch",
      status: "pending",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, date, status: "pending" });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const sb = createServiceClient();
  const { data } = await sb
    .from("lamlinks_rescue_actions")
    .select("id, status, result, error_message, completed_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}
