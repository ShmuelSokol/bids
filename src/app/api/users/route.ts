import { NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * GET /api/users
 *
 * Superadmin-only. Lists every profile with its role, creation date, and
 * the latest `user_activity.created_at` value (derived "last seen"). The
 * Users admin page polls this to keep its relative timestamps fresh.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (user.profile?.role !== "superadmin") {
    return NextResponse.json({ error: "superadmin only" }, { status: 403 });
  }

  const supabase = createServiceClient();

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at, must_reset_password")
    .order("created_at", { ascending: true });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // Derive last_seen_at = MAX(user_activity.created_at) per user_id.
  // Paginate because user_activity can be big; we only need the latest
  // per user, so group in Postgres via a direct SQL call.
  // PostgREST doesn't expose GROUP BY, so we query a handful of recent
  // rows per user instead — sufficient for this scale.
  const userIds = (profiles || []).map((p) => p.id);
  const lastSeen = new Map<string, string>();
  if (userIds.length > 0) {
    // Single query, top 5K events, reduce client-side.
    const { data: acts } = await supabase
      .from("user_activity")
      .select("user_id, created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(5000);
    for (const a of acts || []) {
      if (!a.user_id) continue;
      if (!lastSeen.has(a.user_id)) lastSeen.set(a.user_id, a.created_at);
    }
  }

  const users = (profiles || []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    role: p.role,
    created_at: p.created_at,
    must_reset_password: p.must_reset_password,
    last_seen_at: lastSeen.get(p.id) || null,
  }));

  return NextResponse.json({ users, current_user_id: user.user.id });
}
