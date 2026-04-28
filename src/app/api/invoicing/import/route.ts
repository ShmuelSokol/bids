import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/invoicing/import
 * body: { date?: "YYYY-MM-DD" }   // defaults to today
 *
 * Enqueues a refresh_dd219_invoices rescue action; the daemon worker
 * runs scripts/enqueue-ax-invoices-for-ll.ts which pulls from AX and
 * inserts rows into lamlinks_invoice_queue. Caller polls via GET ?id=.
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
      action: "import_dd219_invoices",
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
