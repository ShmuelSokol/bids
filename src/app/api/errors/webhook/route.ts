import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * POST /api/errors/webhook
 *
 * Called by Supabase Database Webhook when a new row is inserted into
 * client_errors. Dedupes, then triggers the GitHub Actions auto-fix
 * workflow + WhatsApp notification.
 *
 * Supabase webhook config (set in Dashboard → Database → Webhooks):
 *   Table: client_errors
 *   Events: INSERT
 *   Type: HTTP Request
 *   URL: https://dibs-gov-production.up.railway.app/api/errors/webhook
 *   Headers: X-Webhook-Secret: <same as INTERNAL_SECRET env var>
 */
export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get("x-webhook-secret") || req.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  // Supabase webhook sends { type: "INSERT", record: {...}, ... }
  const record = body.record || body;
  const errorId = record.id;
  const errorMessage = record.error_message || "Unknown";
  const errorStack = record.error_stack || "";
  const errorUrl = record.url || "";
  const errorType = record.error_type || "unknown";

  // Build a signature for deduplication
  const signature = `${errorMessage.slice(0, 100)}|${errorUrl}`.replace(/[^a-zA-Z0-9|/.-]/g, "_");

  // Check if we already have an active session for this signature (last 30 min)
  const supabase = createServiceClient();
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("auto_fix_sessions")
    .select("id, status")
    .eq("error_signature", signature)
    .gte("created_at", thirtyMinAgo)
    .in("status", ["pending", "investigating", "completed"])
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`[auto-fix] Deduped: session ${existing[0].id} already covers signature "${signature.slice(0, 60)}"`);
    return NextResponse.json({ ok: true, deduped: true, existing_session: existing[0].id });
  }

  // Create a pending session
  const { data: session } = await supabase
    .from("auto_fix_sessions")
    .insert({
      error_id: errorId,
      error_signature: signature,
      status: "pending",
    })
    .select("id")
    .single();

  // Trigger GitHub Actions workflow via repository_dispatch
  const ghToken = process.env.GITHUB_TOKEN;
  if (ghToken) {
    try {
      const resp = await fetch(
        "https://api.github.com/repos/ShmuelSokol/bids/dispatches",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event_type: "production-error",
            client_payload: {
              error_id: errorId,
              error_message: errorMessage.slice(0, 500),
              error_stack: errorStack.slice(0, 2000),
              url: errorUrl,
              error_type: errorType,
              error_signature: signature,
              session_id: session?.id,
            },
          }),
        }
      );
      if (!resp.ok) {
        console.error(`[auto-fix] GitHub dispatch failed: ${resp.status}`);
      }
    } catch (e: any) {
      console.error(`[auto-fix] GitHub dispatch error: ${e.message}`);
    }
  }

  // Send immediate WhatsApp notification
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "https://dibs-gov-production.up.railway.app"}/api/whatsapp/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": process.env.INTERNAL_SECRET || "",
      },
      body: JSON.stringify({
        message: `⚠ Production error on DIBS:\n${errorMessage.slice(0, 200)}\nPage: ${errorUrl}\nType: ${errorType}\n\nAuto-fix session #${session?.id || "?"} started.`,
      }),
    });
  } catch {
    // WhatsApp notification is best-effort
  }

  return NextResponse.json({ ok: true, session_id: session?.id });
}
