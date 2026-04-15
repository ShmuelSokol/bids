import { NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * GET /api/invoicing/states
 *
 * Returns recent LamLinks invoice state events for the /invoicing/monitor
 * page. Grouped + sorted by relevance:
 *   - Today's transitions first (appeared / state_change)
 *   - Running totals per state (how many Posted today, Not Posted open, etc.)
 *   - Last 7 days of state_change events for trend visibility
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // Events today (most recent 200)
  const { data: todayEvents } = await supabase
    .from("invoice_state_events")
    .select("*")
    .gte("detected_at", `${today}T00:00:00Z`)
    .order("detected_at", { ascending: false })
    .limit(200);

  // State-change events last 7 days (we care about transitions more than appearances)
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: weekChanges } = await supabase
    .from("invoice_state_events")
    .select("*")
    .eq("event_type", "state_change")
    .gte("detected_at", weekAgo)
    .order("detected_at", { ascending: false })
    .limit(500);

  // Current state tally: for each kad_id, the most recent to_state.
  // Paginate so we don't miss anything.
  const currentByKad = new Map<number, { state: string; invoice_number: string | null; total: number | null; last_at: string }>();
  for (let p = 0; p < 5; p++) {
    const { data } = await supabase
      .from("invoice_state_events")
      .select("kad_id, to_state, invoice_number, total, detected_at")
      .order("detected_at", { ascending: false })
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (!currentByKad.has(r.kad_id)) {
        currentByKad.set(r.kad_id, {
          state: r.to_state,
          invoice_number: r.invoice_number,
          total: r.total,
          last_at: r.detected_at,
        });
      }
    }
    if (data.length < 1000) break;
  }

  const tally: Record<string, { count: number; total: number }> = {};
  for (const v of currentByKad.values()) {
    if (!tally[v.state]) tally[v.state] = { count: 0, total: 0 };
    tally[v.state].count++;
    tally[v.state].total += v.total || 0;
  }

  // Last sync run details
  const { data: lastSync } = await supabase
    .from("sync_log")
    .select("created_at, details")
    .eq("action", "invoice_state_sync")
    .order("created_at", { ascending: false })
    .limit(1);

  return NextResponse.json({
    today_events: todayEvents || [],
    week_state_changes: weekChanges || [],
    tally,
    tracked_invoices: currentByKad.size,
    last_sync: lastSync?.[0] || null,
  });
}
