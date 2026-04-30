import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";

/**
 * POST /api/rfq/send — queue draft(s) for sending
 *   body: { ids: number[] }  — array of rfq_drafts.id values
 *
 * Marks each row's status: draft → pending_send. The daemon-side
 * worker (scripts/send-rfq-drafts.ts) polls for pending_send rows,
 * fires the actual EWS sendMail, and flips status to sent (or
 * send_failed on error).
 *
 * This API can't send directly because Railway can't reach the
 * internal Exchange server.
 */

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!hasAdminAccess(user.profile?.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const ids: number[] = Array.isArray(body.ids) ? body.ids.filter((n: any) => Number.isFinite(n)) : [];
  if (ids.length === 0) return NextResponse.json({ error: "ids[] required" }, { status: 400 });

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("rfq_drafts")
    .update({ status: "pending_send" })
    .in("id", ids)
    .eq("status", "draft")  // only flip from draft (not from sent/cancelled)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    queued: data?.length || 0,
    requested: ids.length,
    note: data?.length === ids.length
      ? `${data.length} drafts queued for send. Daemon will pick them up within ~1 min.`
      : `${data?.length || 0} of ${ids.length} queued; rest were not in 'draft' status.`,
  });
}
