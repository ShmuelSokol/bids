import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import { trackEvent, requestContext } from "@/lib/track";

/**
 * POST /api/users/reset-password
 *
 * Superadmin-only out-of-band password reset for when Supabase's email
 * reset link doesn't arrive (rate limit / spam filter / broken SMTP).
 *
 * Generates a temp password (or uses the one the caller supplies), writes
 * it to Supabase auth via the admin API, flips `must_reset_password=true`
 * so the target is forced through /login/set-password on their next sign-in.
 *
 * Returns the temp password so the superadmin can pass it to the user
 * over a secure channel (Signal / phone / in person). The temp is NOT
 * stored anywhere on the server — the response is the only record.
 *
 * Body: {
 *   user_id: string,
 *   new_password?: string,  // optional — if omitted, server generates
 * }
 *
 * Returns: { ok, user_id, email, temp_password, forced_reset_on_next_login }
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (me.profile?.role !== "superadmin") {
    return NextResponse.json({ error: "superadmin only" }, { status: 403 });
  }

  const { user_id, new_password } = await req.json();
  if (typeof user_id !== "string" || !user_id) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", user_id)
    .single();
  if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });

  // Use provided temp if given, else generate a human-readable 10-char
  // one. Avoids look-alikes (0/O, 1/l) so it's safe to dictate over phone.
  const temp = typeof new_password === "string" && new_password.length >= 8
    ? new_password
    : generateTempPassword();

  // Write to Supabase auth. This requires the SERVICE role key — which is
  // what createServiceClient uses — so no extra setup needed.
  const { error: authErr } = await supabase.auth.admin.updateUserById(user_id, {
    password: temp,
  });
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });

  // Force password change on next login.
  await supabase
    .from("profiles")
    .update({ must_reset_password: true, updated_at: new Date().toISOString() })
    .eq("id", user_id);

  const { ip, userAgent } = requestContext(req);
  trackEvent({
    userId: me.user.id,
    userName: me.profile?.full_name || me.user.email,
    eventType: "settings",
    eventAction: "user_password_reset_by_admin",
    page: "/settings/users",
    details: { target_user_id: user_id, target_email: target.email, target_name: target.full_name },
    ip,
    userAgent,
  });

  return NextResponse.json({
    ok: true,
    user_id,
    email: target.email,
    temp_password: temp,
    forced_reset_on_next_login: true,
  });
}

function generateTempPassword(): string {
  // Remove look-alike glyphs so it can be dictated unambiguously.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  // Use crypto.getRandomValues for unbiased bytes (node v18+ has it globally).
  const buf = new Uint8Array(10);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 10; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}
