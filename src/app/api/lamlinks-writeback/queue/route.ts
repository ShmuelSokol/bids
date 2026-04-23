import { NextResponse } from "next/server";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";

/**
 * GET /api/lamlinks-writeback/queue
 *
 * Returns the most recent lamlinks_write_queue rows + the latest worker
 * heartbeat + per-status counts. Admin/superadmin only.
 *
 * Polled by the monitor page every few seconds to show status transitions
 * (pending → claimed → done / error) in real time without a page refresh.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!hasAdminAccess(me.profile?.role)) return NextResponse.json({ error: "admin only" }, { status: 403 });

  const supabase = createServiceClient();

  const [rowsRes, heartbeatRes, flagRes] = await Promise.all([
    supabase
      .from("lamlinks_write_queue")
      .select("id, solicitation_number, nsn, bid_price, bid_qty, delivery_days, status, created_at, picked_up_at, processed_at, envelope_idnk33, line_idnk34, price_idnk35, error_message, created_by")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("system_settings")
      .select("value, updated_at")
      .eq("key", "lamlinks_worker_last_heartbeat")
      .maybeSingle(),
    supabase
      .from("system_settings")
      .select("value")
      .eq("key", "lamlinks_writeback_enabled")
      .maybeSingle(),
  ]);

  const rows = rowsRes.data || [];

  // Status histogram across the returned rows. Cheap — bounded by limit.
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;

  // For total queue pending we do a dedicated count query (may be >100).
  const { count: pendingCount } = await supabase
    .from("lamlinks_write_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return NextResponse.json({
    rows,
    counts,
    pending_total: pendingCount ?? 0,
    writeback_live: (flagRes.data?.value || "false") === "true",
    worker_last_heartbeat: heartbeatRes.data?.value || null,
  });
}
