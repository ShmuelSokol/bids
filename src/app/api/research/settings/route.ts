import { NextResponse } from "next/server";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const sb = createServiceClient();
  const { data } = await sb.from("research_settings").select("*").order("key");
  const today = new Date().toISOString().slice(0, 10);
  const { data: spend } = await sb
    .from("research_spend_ledger")
    .select("*")
    .eq("date", today)
    .maybeSingle();
  const { data: queue } = await sb
    .from("nsn_research_status")
    .select("queue_status")
    .in("queue_status", ["queued", "running"]);

  return NextResponse.json({
    settings: data || [],
    today_spend: spend || { date: today, total_usd: 0, call_count: 0 },
    queue_depth: (queue || []).length,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !hasAdminAccess(user.profile?.role)) {
    return NextResponse.json({ error: "admin required" }, { status: 403 });
  }

  const { key, value } = await req.json();
  if (!key || value == null) return NextResponse.json({ error: "key+value required" }, { status: 400 });

  const sb = createServiceClient();
  const { error } = await sb
    .from("research_settings")
    .update({ value: String(value), updated_at: new Date().toISOString(), updated_by: user.user.email || "unknown" })
    .eq("key", key);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
