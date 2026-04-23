import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * GET /api/lamlinks-rescue/status?id=X         — single action
 * GET /api/lamlinks-rescue/status              — latest 30
 *
 * Superadmin-only. UI polls while waiting for the worker to pick up + run.
 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (me.profile?.role !== "superadmin") {
    return NextResponse.json({ error: "superadmin only" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  const supabase = createServiceClient();

  if (id) {
    const { data, error } = await supabase
      .from("lamlinks_rescue_actions")
      .select("id, action, params, status, result, error, requested_by, created_at, picked_up_at, processed_at")
      .eq("id", Number(id))
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from("lamlinks_rescue_actions")
    .select("id, action, params, status, result, error, requested_by, created_at, picked_up_at, processed_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ actions: data || [] });
}
