import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * POST /api/lamlinks-rescue/enqueue
 *
 * Superadmin-only. Enqueues a rescue action for the Windows worker on
 * NYEVRVSQL001 to execute against LamLinks. Railway can't reach the
 * LL DB directly (no msnodesqlv8 driver), so UI actions round-trip via
 * the rescue queue. Worker polls, executes, writes result back.
 *
 * Body: {
 *   action: "inspect" | "list_staging" | "mark_sent" | "retire"
 *         | "remove_k34" | "move_k34" | "extract_to_temp" | "nuke",
 *   params: { ... },   // action-specific (see below)
 *   dry_run?: boolean  // when true, worker describes what it WOULD do
 * }
 *
 * Returns: { id } — rescue action id, poll /api/lamlinks-rescue/status?id=X
 *
 * Actions:
 *   inspect           { idnk33 }
 *   list_staging      { user?: string }
 *   mark_sent         { idnk33 }
 *   retire            { idnk33 }
 *   remove_k34        { idnk34 }
 *   move_k34          { from_idnk33, to_idnk33, k34_ids: number[] }
 *   extract_to_temp   { idnk33 }
 *   nuke              { idnk33 }
 */
const VALID_ACTIONS = new Set([
  "inspect", "list_staging", "mark_sent", "retire",
  "remove_k34", "move_k34", "extract_to_temp", "nuke",
]);

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (me.profile?.role !== "superadmin") {
    return NextResponse.json({ error: "superadmin only" }, { status: 403 });
  }

  const body = await req.json();
  const { action, params, dry_run } = body;
  if (typeof action !== "string" || !VALID_ACTIONS.has(action)) {
    return NextResponse.json({ error: `action must be one of ${[...VALID_ACTIONS].join(", ")}` }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("lamlinks_rescue_actions")
    .insert({
      action,
      params: { ...(params || {}), dry_run: dry_run === true },
      status: "pending",
      requested_by: me.profile?.full_name || me.user.email || "unknown",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id });
}
