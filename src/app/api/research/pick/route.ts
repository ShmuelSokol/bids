import { NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const body = await req.json();
  const { nsn, solicitation_number, chosen_supplier_name, chosen_supplier_cage, chosen_price, chosen_url, reason } = body;
  if (!nsn || !chosen_supplier_name) {
    return NextResponse.json({ error: "nsn + chosen_supplier_name required" }, { status: 400 });
  }

  const sb = createServiceClient();

  // Deactivate prior picks for this (nsn, solicitation_number) combo
  await sb
    .from("nsn_supplier_picks")
    .update({ active: false })
    .eq("nsn", nsn)
    .eq("active", true)
    .match(solicitation_number ? { solicitation_number } : { solicitation_number: null });

  // Insert the new pick
  const { data: newPick, error } = await sb
    .from("nsn_supplier_picks")
    .insert({
      nsn,
      solicitation_number: solicitation_number ?? null,
      chosen_supplier_name,
      chosen_supplier_cage: chosen_supplier_cage ?? null,
      chosen_price: chosen_price ?? null,
      chosen_url: chosen_url ?? null,
      reason: reason ?? null,
      picked_by: user.profile?.full_name || user.user.email || "unknown",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also mirror onto status for quick UI reads
  await sb
    .from("nsn_research_status")
    .update({
      abe_verified_cage: chosen_supplier_cage ?? null,
      abe_verified_at: new Date().toISOString(),
      abe_notes: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("nsn", nsn);

  return NextResponse.json({ ok: true, id: newPick?.id });
}
