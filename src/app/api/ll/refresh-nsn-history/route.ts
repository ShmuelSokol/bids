import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/ll/refresh-nsn-history
 * body: { nsn: "6665-12-193-2113" }
 *
 * Enqueues a rescue action that the Windows worker picks up, runs
 * refresh-ll-history-for-nsn.ts, and reports back. Caller polls via
 * GET with ?id= or re-reads the modal after a few seconds.
 *
 * Why async? Railway can't reach llk_db1 directly (no msnodesqlv8 on
 * linux). The worker on the daemon host handles the LL-side query and
 * writes results back to Supabase awards + abe_bids.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const nsn = String(body.nsn || "").trim();
  if (!/^\d{4}-\d{2}-\d{3}-\d{4}$/.test(nsn)) {
    return NextResponse.json({ error: "nsn must be XXXX-XX-XXX-XXXX" }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("lamlinks_rescue_actions")
    .insert({
      action: "refresh_nsn_history",
      params: { nsn },
      requested_by: "solicitations-modal",
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, nsn, status: "pending" });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("lamlinks_rescue_actions")
    .select("id, status, result, error, processed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || { error: "not found" });
}
