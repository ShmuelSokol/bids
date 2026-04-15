import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * GET /api/so/dodaacs — list all known DODAAC→address_id maps
 *
 * POST /api/so/dodaacs — bulk add. Body: { rows: [{dodaac, address_id,
 *   address_description?, city?, state?, zip?}, ...] }
 *
 * DELETE /api/so/dodaacs — remove. Body: { dodaac }
 */

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const sb = createServiceClient();
  const { data } = await sb.from("dodaac_map").select("*").order("dodaac");
  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const sb = createServiceClient();
  const body = await req.json();
  const rows = Array.isArray(body.rows) ? body.rows : [body];
  const added = (user.profile?.full_name || user.user.email || "unknown").slice(0, 80);
  const inserts = rows
    .filter((r: any) => r.dodaac && r.address_id)
    .map((r: any) => ({
      dodaac: String(r.dodaac).trim().toUpperCase(),
      address_id: String(r.address_id).trim(),
      address_description: r.address_description?.trim() || null,
      city: r.city?.trim() || null,
      state: r.state?.trim() || null,
      zip: r.zip?.trim() || null,
      added_by: added,
    }));
  if (inserts.length === 0) return NextResponse.json({ error: "rows need {dodaac, address_id}" }, { status: 400 });
  const { error } = await sb.from("dodaac_map").upsert(inserts, { onConflict: "dodaac" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: inserts.length });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const sb = createServiceClient();
  const { dodaac } = await req.json();
  if (!dodaac) return NextResponse.json({ error: "dodaac required" }, { status: 400 });
  await sb.from("dodaac_map").delete().eq("dodaac", String(dodaac).trim().toUpperCase());
  return NextResponse.json({ success: true });
}
