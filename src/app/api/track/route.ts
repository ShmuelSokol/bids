import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { trackEvent, requestContext } from "@/lib/track";

/**
 * POST /api/track — client-side event tracking endpoint
 * Accepts: { event_type, event_action, page, details, session_id }
 */
export async function POST(req: NextRequest) {
  const { ip, userAgent } = requestContext(req);
  const user = await getCurrentUser().catch(() => null);

  const body = await req.json();

  await trackEvent({
    userId: user?.user?.id,
    userName: user?.profile?.full_name || user?.user?.email || null,
    eventType: body.event_type || "page_view",
    eventAction: body.event_action || "view",
    page: body.page || null,
    details: body.details || {},
    ip,
    userAgent,
    sessionId: body.session_id || null,
  });

  return NextResponse.json({ ok: true });
}
