import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("supplier_followup_rules")
    .select("vendor, sla_days, email_template, updated_at")
    .order("vendor");
  return NextResponse.json({ rules: data || [] });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const supabase = createServiceClient();
  const { vendor, sla_days, email_template } = await req.json();
  if (!vendor || typeof sla_days !== "number") {
    return NextResponse.json({ error: "vendor + sla_days required" }, { status: 400 });
  }
  const { error } = await supabase
    .from("supplier_followup_rules")
    .upsert({
      vendor,
      sla_days,
      email_template: email_template ?? null,
      last_edited_by: user.profile?.full_name || user.user.email || "unknown",
      updated_at: new Date().toISOString(),
    });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const supabase = createServiceClient();
  const { vendor } = await req.json();
  if (!vendor) return NextResponse.json({ error: "vendor required" }, { status: 400 });
  const { error } = await supabase.from("supplier_followup_rules").delete().eq("vendor", vendor);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
