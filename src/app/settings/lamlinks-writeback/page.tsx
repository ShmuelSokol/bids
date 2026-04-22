import { isLamlinksWritebackLive, getLamlinksWorkerHealth } from "@/lib/system-settings";
import { createServiceClient } from "@/lib/supabase-server";
import { Toggle } from "./toggle";

async function getQueueStats() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("lamlinks_write_queue")
    .select("status, created_at, processed_at, error_message")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data || [];
  const byStatus = rows.reduce((acc: Record<string, number>, r: any) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  return { byStatus, recent: rows.slice(0, 10) };
}

export default async function LamLinksWritebackSettingsPage() {
  const live = await isLamlinksWritebackLive();
  const health = await getLamlinksWorkerHealth();
  const { byStatus, recent } = await getQueueStats();

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <div className="text-xs text-muted mb-1">
          <a href="/settings" className="hover:underline">← Settings</a>
        </div>
        <h1 className="text-2xl font-bold">LamLinks Bid Write-Back</h1>
        <p className="text-muted mt-1 text-sm">
          Controls whether DIBS Submit actions transmit bids into LamLinks (k33/k34/k35). See{" "}
          <a href="/wiki/lamlinks-writeback" className="underline">the wiki</a> for the full technical reference.
        </p>
      </div>

      <div className={`rounded-xl border-2 ${live ? "border-green-400 bg-green-50/50" : "border-gray-300 bg-gray-50/50"} p-6 mb-6`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-bold mb-1">
              {live ? (
                <span className="text-green-700">🟢 LIVE — bids transmit to LamLinks</span>
              ) : (
                <span className="text-gray-600">⚪ SIMULATED — DIBS-local only</span>
              )}
            </div>
            <div className="text-xs text-muted leading-relaxed">
              When LIVE, clicking Submit on a Quoted row enqueues a write to the LamLinks <code className="font-mono">k33/k34/k35</code>{" "}
              chain. A Windows worker on <code className="font-mono">NYEVRVSQL001</code> processes the queue (Railway can&apos;t run{" "}
              <code className="font-mono">msnodesqlv8</code>, so the work has to happen on the LamLinks host).
              <br />
              When SIMULATED, Submit only flips <code className="font-mono">bid_decisions.status</code> in Supabase — nothing reaches LamLinks or DLA.
            </div>
          </div>
          <Toggle initialValue={live} />
        </div>
      </div>

      <div className={`rounded-xl border-2 ${health.online ? "border-green-400 bg-green-50/30" : "border-red-400 bg-red-50/30"} p-6 mb-6`}>
        <h2 className="text-lg font-semibold mb-2">Worker Health</h2>
        <div className="text-sm mb-2">
          {health.online ? (
            <span className="text-green-800 font-medium">🟢 Worker ONLINE — last heartbeat {health.ageSeconds}s ago</span>
          ) : (
            <span className="text-red-800 font-medium">🔴 Worker OFFLINE — {health.lastHeartbeat ? `last heartbeat ${Math.floor((health.ageSeconds || 0) / 60)} min ago (${new Date(health.lastHeartbeat).toLocaleString()})` : "never checked in"}</span>
          )}
        </div>
        <div className="text-xs text-muted">
          Healthy threshold: under 2 min. The daemon writes a heartbeat on every poll (~every 30s). If this stays stale while the toggle is LIVE, Abe&apos;s submits will queue but not transmit.
        </div>
        {!health.online && (
          <div className="text-xs mt-2 text-red-700">
            Fix: on NYEVRVSQL001, run <code className="font-mono">schtasks /run /tn &quot;DIBS - Recurring Daemon&quot;</code>, or sign out and back in to fire the auto-start trigger.
          </div>
        )}
      </div>

      <div className="rounded-xl border border-card-border bg-card-bg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">Write Queue</h2>
        <div className="flex gap-4 text-sm mb-4">
          <div>
            <div className="text-xs text-muted">Pending</div>
            <div className="text-2xl font-bold text-blue-700">{byStatus.pending || 0}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Processing</div>
            <div className="text-2xl font-bold text-amber-700">{byStatus.processing || 0}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Done</div>
            <div className="text-2xl font-bold text-green-700">{byStatus.done || 0}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Failed</div>
            <div className="text-2xl font-bold text-red-700">{byStatus.failed || 0}</div>
          </div>
        </div>

        {recent.length > 0 && (
          <div className="text-xs">
            <div className="font-medium mb-1">Last 10 queue entries</div>
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] text-muted border-b border-card-border">
                  <th className="py-1 pr-2">Created</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1 pr-2">Processed</th>
                  <th className="py-1">Error</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-card-border/40">
                    <td className="py-1 pr-2 font-mono text-[10px]">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-1 pr-2">
                      <span className={`px-1 rounded text-[10px] ${
                        r.status === "done" ? "bg-green-100 text-green-700" :
                        r.status === "failed" ? "bg-red-100 text-red-700" :
                        r.status === "processing" ? "bg-amber-100 text-amber-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>{r.status}</span>
                    </td>
                    <td className="py-1 pr-2 font-mono text-[10px]">{r.processed_at ? new Date(r.processed_at).toLocaleString() : "—"}</td>
                    <td className="py-1 text-[10px] text-red-700 truncate max-w-[300px]">{r.error_message || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-card-border bg-card-bg p-6 text-sm">
        <h2 className="text-lg font-semibold mb-2">Preflight before going LIVE</h2>
        <ul className="space-y-1 text-xs text-muted">
          <li>✅ Write-back pattern proven end-to-end (2 bids transmitted to DLA on 2026-04-21).</li>
          <li>✅ Status reconciler (<code className="font-mono">scripts/sync-dibs-status.ts</code>) available for manual runs.</li>
          <li>⏳ Windows worker (<code className="font-mono">scripts/lamlinks-writeback-worker.ts</code>) needs to be running on <code className="font-mono">NYEVRVSQL001</code> before queued rows will drain. Until it&apos;s registered as a scheduled task, queued rows sit as <em>pending</em>.</li>
          <li>✅ Seed-bid NOT required — worker auto-creates a fresh k33 envelope if none is staged. Abe can start his day with DIBS-prepared bids already in LamLinks.</li>
          <li>⚠ Toggling OFF mid-flight is safe — pending rows stay in the queue and resume when toggled back ON.</li>
        </ul>
      </div>
    </div>
  );
}
