import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/dibbs/refresh-clins
 * body: { sol: "SPE2DS-26-T-021R" }
 *
 * Enqueues a refresh_dibbs_clins rescue action; the daemon worker on
 * GLOVE picks it up, runs scripts/scrape-dibbs-clins.ts, and writes
 * per-CLIN rows to dibbs_sol_clins.
 *
 * Why async? Playwright launches a Chromium process; that's heavier
 * than Railway's 30-second budget. Run it on the daemon host.
 *
 * Caller polls GET ?id=<rescue_action_id> for completion.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sol = String(body.sol || "").trim().toUpperCase();
  if (!/^SPE\w{3}-\d{2}-[A-Z]-\w{4}$/.test(sol)) {
    return NextResponse.json({ error: "sol must look like SPE2DS-26-T-021R" }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("lamlinks_rescue_actions")
    .insert({
      action: "refresh_dibbs_clins",
      params: { sol },
      requested_by: "solicitations-modal",
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, sol, status: "pending" });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("lamlinks_rescue_actions")
    .select("id, action, params, status, result, error_message, completed_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}
