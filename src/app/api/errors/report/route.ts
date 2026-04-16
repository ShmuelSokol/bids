import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createServiceClient();

    const { error } = await supabase.from("client_errors").insert({
      error_message: String(body.error_message || "Unknown error").slice(0, 2000),
      error_stack: body.error_stack ? String(body.error_stack).slice(0, 5000) : null,
      component_stack: body.component_stack ? String(body.component_stack).slice(0, 3000) : null,
      url: body.url ? String(body.url).slice(0, 500) : null,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
      user_email: body.user_email || null,
      session_id: body.session_id || null,
      error_type: body.error_type || "client",
      metadata: body.metadata || {},
    });

    if (error) {
      console.error("[error-report] insert failed:", error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
