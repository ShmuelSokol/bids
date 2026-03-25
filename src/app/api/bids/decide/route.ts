import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const {
    solicitation_number,
    nsn,
    nomenclature,
    quantity,
    suggested_price,
    final_price,
    lead_time_days,
    comment,
    status,
    source,
    source_item,
  } = body;

  if (!solicitation_number || !nsn || !status) {
    return NextResponse.json(
      { error: "solicitation_number, nsn, and status required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const record: Record<string, unknown> = {
    solicitation_number,
    nsn,
    nomenclature,
    quantity,
    suggested_price,
    final_price,
    lead_time_days: lead_time_days || 45,
    comment,
    status,
    source,
    source_item,
    decided_by: user.profile?.full_name || user.user.email,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("bid_decisions")
    .upsert(record, { onConflict: "solicitation_number,nsn" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
