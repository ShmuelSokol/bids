import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";

/**
 * PATCH /api/rfq/:id — edit draft body/subject/recipient before sending
 * DELETE /api/rfq/:id — cancel draft (status='cancelled')
 */

const EDITABLE = new Set(["subject", "body", "supplier_email", "supplier_name", "notes", "lines"]);

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
    if (EDITABLE.has(k)) update[k] = body[k];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }
  const sb = createServiceClient();

  // Don't allow editing once sent
  const { data: existing } = await sb.from("rfq_drafts").select("status").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (existing.status !== "draft") {
    return NextResponse.json({ error: `cannot edit a draft in status '${existing.status}'` }, { status: 400 });
  }

  const { data, error } = await sb.from("rfq_drafts").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!hasAdminAccess(user.profile?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const sb = createServiceClient();
  const { error } = await sb.from("rfq_drafts").update({ status: "cancelled" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
