import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";

/**
 * POST /api/whatsapp/send
 * Send a WhatsApp message (text or media) via Twilio.
 *
 * Body: { to: string, message: string, mediaUrl?: string }
 *
 * Auth: requires either a logged-in user session OR the X-Internal-Secret
 * header matching INTERNAL_SHARED_SECRET (for cron/scripts). Without either
 * the endpoint refuses — sending SMS costs money per message.
 *
 * Requires env vars:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 *   INTERNAL_SHARED_SECRET (for unattended callers)
 */
export async function POST(req: NextRequest) {
  // Gate: must be authenticated OR carry the shared secret
  const internalSecret = req.headers.get("x-internal-secret");
  const isInternal = !!process.env.INTERNAL_SHARED_SECRET && internalSecret === process.env.INTERNAL_SHARED_SECRET;
  if (!isInternal) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    return NextResponse.json(
      { error: "Twilio WhatsApp not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { to, message, mediaUrl } = body;

  if (!to || !message) {
    return NextResponse.json({ error: "to and message required" }, { status: 400 });
  }

  // Format phone number for WhatsApp
  const toNumber = to.replace(/[^0-9+]/g, "");
  const whatsappTo = `whatsapp:${toNumber.startsWith("+") ? toNumber : `+1${toNumber}`}`;
  const whatsappFrom = TWILIO_WHATSAPP_FROM.startsWith("whatsapp:")
    ? TWILIO_WHATSAPP_FROM
    : `whatsapp:${TWILIO_WHATSAPP_FROM}`;

  try {
    // Use Twilio REST API directly (no SDK needed on Railway)
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams({
      To: whatsappTo,
      From: whatsappFrom,
      Body: message,
    });

    if (mediaUrl) {
      params.append("MediaUrl", mediaUrl);
    }

    const resp = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const result = await resp.json();

    if (!resp.ok) {
      return NextResponse.json(
        { error: result.message || "Twilio error", code: result.code, status: result.status },
        { status: resp.status }
      );
    }

    return NextResponse.json({
      success: true,
      sid: result.sid,
      to: whatsappTo,
      status: result.status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
