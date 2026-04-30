import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";
import { generateRfqDrafts } from "@/lib/rfq-draft-generator";

/**
 * GET /api/rfq?status=draft&limit=200 — list drafts
 *
 * POST /api/rfq — generate new drafts
 *   body: { needs: [{nsn, qty, partNumber?}], solId?, source? }
 */

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!hasAdminAccess(user.profile?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "200", 10);
  const sb = createServiceClient();
  let q = sb.from("rfq_drafts").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drafts: data || [] });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!hasAdminAccess(user.profile?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  if (!Array.isArray(body.needs) || body.needs.length === 0) {
    return NextResponse.json({ error: "needs[] required" }, { status: 400 });
  }
  const sb = createServiceClient();
  const result = await generateRfqDrafts(
    {
      needs: body.needs,
      solId: body.solId,
      source: body.source || "manual",
      createdBy: user.profile?.full_name || user.user.email || "unknown",
    },
    sb,
  );
  return NextResponse.json(result);
}
