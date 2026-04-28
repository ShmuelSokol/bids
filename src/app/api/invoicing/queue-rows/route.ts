import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * GET /api/invoicing/queue-rows?date=YYYY-MM-DD
 * Returns today's lamlinks_invoice_queue rows for the post-batch UI.
 */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("lamlinks_invoice_queue")
    .select("*")
    .eq("ax_invoice_date", date)
    .order("ax_invoice_number", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}
