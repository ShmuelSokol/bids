import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";

/**
 * POST /api/suppliers — add a manual supplier
 *
 * Body: { name, email, cage?, notes?, source? }
 * source defaults to 'manual'
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!hasAdminAccess(user.profile?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  if (!name || !email) return NextResponse.json({ error: "name and email required" }, { status: 400 });
  if (!email.includes("@")) return NextResponse.json({ error: "invalid email" }, { status: 400 });

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("dibs_suppliers")
    .insert({
      name,
      email,
      cage: body.cage?.trim() || null,
      notes: body.notes?.trim() || null,
      source: body.source || "manual",
      confidence: body.source === "manual" ? 1.0 : 0.5,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ supplier: data });
}
