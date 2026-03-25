import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  // Supabase sends the reset email automatically
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${req.nextUrl.origin}/login/reset-password`,
  });

  // Always return success to prevent email enumeration
  if (error) {
    console.error("Password reset error:", error.message);
  }

  return NextResponse.json({
    success: true,
    message:
      "If an account with that email exists, we've sent a password reset link.",
  });
}
