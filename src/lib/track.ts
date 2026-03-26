/**
 * User Activity Tracking — server-side utility
 *
 * Event types:
 *   page_view  — user navigated to a page
 *   auth       — login, logout, password_reset
 *   bid        — quoted, skipped, submitted
 *   sync       — scrape, enrich
 *   order      — po_created, supplier_switched
 *   search     — solicitation_search, supplier_search
 *   export     — quotes_exported
 *   settings   — profile_updated, fsc_changed
 *   bug_report — submitted
 */

import { createServiceClient } from "./supabase-server";

interface TrackEvent {
  userId?: string | null;
  userName?: string | null;
  eventType: string;
  eventAction: string;
  page?: string;
  details?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
}

export async function trackEvent(event: TrackEvent) {
  try {
    const supabase = createServiceClient();
    await supabase.from("user_activity").insert({
      user_id: event.userId || null,
      user_name: event.userName || null,
      event_type: event.eventType,
      event_action: event.eventAction,
      page: event.page || null,
      details: event.details || {},
      ip_address: event.ip || null,
      user_agent: event.userAgent || null,
      session_id: event.sessionId || null,
    });
  } catch {
    // Never let tracking break the app
  }
}

/**
 * Helper to extract user info + request context for tracking
 */
export function requestContext(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;
  return { ip, userAgent };
}
