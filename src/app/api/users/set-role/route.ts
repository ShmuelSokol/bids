import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import { trackEvent, requestContext } from "@/lib/track";

const ALLOWED_ROLES = ["superadmin", "admin", "manager", "viewer"] as const;

/**
 * POST /api/users/set-role
 *
 * Superadmin-only. Changes a user's role. Cannot demote the last
 * superadmin (safety) and cannot change your own role (use a second
 * superadmin account to demote).
 *
 * Body: { user_id: string, role: "superadmin" | "admin" | "manager" | "viewer" }
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (me.profile?.role !== "superadmin") {
    return NextResponse.json({ error: "superadmin only" }, { status: 403 });
  }

  const { user_id, role } = await req.json();
  if (typeof user_id !== "string" || !user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: `role must be one of ${ALLOWED_ROLES.join(", ")}` }, { status: 400 });
  }

  if (user_id === me.user.id) {
    return NextResponse.json({ error: "Use another superadmin to change your own role" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Guard against removing the last superadmin.
  const { data: target } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", user_id)
    .single();
  if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });

  if (target.role === "superadmin" && role !== "superadmin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "superadmin");
    if ((count || 0) <= 1) {
      return NextResponse.json({ error: "cannot demote the last superadmin — promote another user first" }, { status: 400 });
    }
  }

  const { error: updErr } = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", user_id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  const { ip, userAgent } = requestContext(req);
  trackEvent({
    userId: me.user.id,
    userName: me.profile?.full_name || me.user.email,
    eventType: "settings",
    eventAction: "user_role_changed",
    page: "/settings/users",
    details: { target_user_id: user_id, target_name: target.full_name, old_role: target.role, new_role: role },
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true, user_id, old_role: target.role, new_role: role });
}
