import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { trackEvent, requestContext } from "@/lib/track";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  const { ip, userAgent } = requestContext(req);

  trackEvent({
    userId: user?.user?.id,
    userName: user?.profile?.full_name || user?.user?.email,
    eventType: "auth",
    eventAction: "logout",
    ip,
    userAgent,
  });

  const response = NextResponse.json({ success: true });
  response.cookies.delete("sb-access-token");
  response.cookies.delete("sb-refresh-token");
  return response;
}
