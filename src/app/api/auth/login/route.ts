import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { trackEvent, requestContext } from "@/lib/track";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const { ip, userAgent } = requestContext(req);
    trackEvent({ eventType: "auth", eventAction: "login_failed", details: { email, error: error.message }, ip, userAgent });
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // Track successful login
  const { ip, userAgent } = requestContext(req);
  trackEvent({
    userId: data.user.id,
    userName: data.user.email,
    eventType: "auth",
    eventAction: "login",
    details: { email },
    ip,
    userAgent,
  });

  const response = NextResponse.json({ success: true, user: data.user });

  response.cookies.set("sb-access-token", data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  response.cookies.set("sb-refresh-token", data.session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return response;
}
