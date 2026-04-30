import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";

/**
 * PATCH /api/suppliers/:id — update a supplier
 * Editable fields: name, email, cage, phone, notes, blocked, blocked_reason, last_verified
 *
 * DELETE /api/suppliers/:id — remove a supplier (only if source='manual'; AX/research
 * entries will get re-created on next sync, so don't allow deleting them — block instead)
 */

const EDITABLE = new Set([
  "name", "email", "cage", "phone", "notes",
  "blocked", "blocked_reason", "last_verified", "confidence",
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!hasAdminAccess(user.profile?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const body = await req.json();
  const update: any = {};
  for (const k of Object.keys(body)) {
    if (EDITABLE.has(k)) update[k] = body[k] === "" ? null : body[k];
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  // Normalize email to lowercase
  if (update.email) update.email = String(update.email).trim().toLowerCase();

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("dibs_suppliers")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ supplier: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!hasAdminAccess(user.profile?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const sb = createServiceClient();

  // Only allow deleting manual entries — AX/research will re-create
  const { data: existing } = await sb
    .from("dibs_suppliers")
    .select("source")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (existing.source !== "manual") {
    return NextResponse.json({ error: "Only manual suppliers can be deleted. Use 'block' for AX/research entries." }, { status: 400 });
  }

  await sb.from("dibs_suppliers").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
