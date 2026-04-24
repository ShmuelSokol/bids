import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createServiceClient, getCurrentUser, hasAdminAccess } from "@/lib/supabase-server";
import { DibsPipelineDashboard } from "./dibs-pipeline-dashboard";

export const dynamic = "force-dynamic";

/**
 * /ops/dibs-pipeline — unified health view for the DIBS → LL → DLA chain.
 *
 * Three live data sources:
 *  (1) lamlinks_write_queue (Supabase, direct) — what DIBS has queued for LL
 *  (2) ll_pipeline_snapshots (Supabase, populated by worker every 5 min) —
 *      the LL-side view: stuck/unshipped envelopes that Railway can't see
 *  (3) sync_log (Supabase, direct) — to surface "snapshot stale, worker off"
 *
 * Every panel shows counts + sample rows + an age-to-latest-signal indicator.
 */

async function getData() {
  const sb = createServiceClient();

  // (1) Write queue — group by status, find oldest pending
  const { data: queueRows } = await sb
    .from("lamlinks_write_queue")
    .select("id, status, solicitation_number, nsn, bid_price, bid_qty, created_at, picked_up_at, processed_at, error_message, envelope_idnk33, line_idnk34")
    .order("created_at", { ascending: false })
    .limit(500);

  // (2) Latest snapshot
  const { data: latestSnapshot } = await sb
    .from("ll_pipeline_snapshots")
    .select("*")
    .order("snapshot_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  // (3) Worker heartbeat — so we can warn if the snapshot is stale
  const { data: heartbeat } = await sb
    .from("system_settings")
    .select("value")
    .eq("key", "lamlinks_worker_last_heartbeat")
    .maybeSingle();

  // (4) Writeback toggle — surface if it's off
  const { data: wbEnabled } = await sb
    .from("system_settings")
    .select("value, description")
    .eq("key", "lamlinks_writeback_enabled")
    .maybeSingle();

  return {
    queueRows: queueRows || [],
    latestSnapshot,
    workerHeartbeat: heartbeat?.value || null,
    writebackEnabled: wbEnabled?.value === "true",
    writebackNote: wbEnabled?.description || null,
  };
}

export default async function DibsPipelinePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasAdminAccess(user.profile?.role)) redirect("/settings");

  const data = await getData();
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/ops/lamlinks" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> LamLinks Ops
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">DIBS Pipeline</span>
      </div>
      <DibsPipelineDashboard {...data} />
    </div>
  );
}
