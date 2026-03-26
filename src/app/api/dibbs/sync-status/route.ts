import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * GET /api/dibbs/sync-status — check if a sync is currently running
 * POST /api/dibbs/sync-status — mark sync as started or done
 *
 * Uses sync_log table: action="sync_started" marks beginning,
 * any newer "scrape" entry marks completion.
 */

export async function GET() {
  const supabase = createServiceClient();

  // Find the most recent sync_started entry
  const { data: started } = await supabase
    .from("sync_log")
    .select("created_at")
    .eq("action", "sync_started")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!started) {
    return NextResponse.json({ running: false });
  }

  // Check if there's a completion after it
  const { data: completed } = await supabase
    .from("sync_log")
    .select("created_at")
    .in("action", ["scrape", "sync_done"])
    .gt("created_at", started.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Also auto-expire after 10 minutes (safety valve)
  const startedAt = new Date(started.created_at);
  const elapsed = Date.now() - startedAt.getTime();
  const expired = elapsed > 10 * 60 * 1000;

  return NextResponse.json({
    running: !completed && !expired,
    started_at: started.created_at,
  });
}

export async function POST(req: NextRequest) {
  const { action } = await req.json();
  const supabase = createServiceClient();

  if (action === "start") {
    await supabase.from("sync_log").insert({
      action: "sync_started",
      details: { source: "manual" },
    });
  } else if (action === "done") {
    await supabase.from("sync_log").insert({
      action: "sync_done",
      details: { source: "manual" },
    });
  }

  return NextResponse.json({ ok: true });
}
