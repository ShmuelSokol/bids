"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface QueueRow {
  id: number;
  ax_invoice_number: string;
  ax_sales_order: string | null;
  ax_customer_order_reference: string | null;
  ax_invoice_date: string;
  ax_total_amount: number;
  ax_lines: any[];
  state: "pending" | "approved" | "processing" | "draft" | "posted" | "error";
  ll_idnkad: number | null;
  ll_cin_no: string | null;
  ll_kae_ids: number[] | null;
  worker_host: string | null;
  error_message: string | null;
  enqueued_at: string;
}

const STATE_PILL: Record<string, string> = {
  pending: "bg-blue-100 text-blue-800 border-blue-300",
  approved: "bg-amber-100 text-amber-800 border-amber-300",
  processing: "bg-purple-100 text-purple-800 border-purple-300",
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  posted: "bg-green-100 text-green-800 border-green-300",
  error: "bg-red-100 text-red-800 border-red-300",
};

export function PostBatchClient({ date, initialRows }: { date: string; initialRows: QueueRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<QueueRow[]>(initialRows);
  const [importing, startImport] = useTransition();
  const [posting, startPost] = useTransition();
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cancel signal for the import poll loop. Set true to break the poll early.
  const cancelImportRef = useRef(false);

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.state] = (acc[r.state] || 0) + 1;
    return acc;
  }, {});
  const total = rows.length;
  const pending = counts.pending || 0;
  const approved = counts.approved || 0;
  const processing = counts.processing || 0;
  const posted = counts.posted || 0;
  const errored = counts.error || 0;
  const totalDollars = rows.reduce((s, r) => s + (Number(r.ax_total_amount) || 0), 0);

  // Auto-refresh while anything is in-flight (pending/approved/processing).
  // Stops once everything is terminal (posted/error).
  useEffect(() => {
    const inFlight = pending + approved + processing > 0;
    if (!inFlight) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/invoicing/queue-rows?date=${date}`);
      if (r.ok) {
        const j = await r.json();
        setRows(j.rows || []);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [date, pending, approved, processing]);

  const onImport = () => {
    setError(null);
    setImportStatus("Queueing AX pull...");
    cancelImportRef.current = false;
    startImport(async () => {
      try {
        const r = await fetch("/api/invoicing/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        const startTs = Date.now();
        // Poll every 1.5s for up to 60s. Each iteration checks the cancel ref.
        for (let i = 0; i < 40; i++) {
          if (cancelImportRef.current) {
            setImportStatus(`Cancelled — rescue id ${j.id} may still complete in the background. Refresh in a few seconds to see if invoices arrived.`);
            return;
          }
          await new Promise((res) => setTimeout(res, 1500));
          const elapsed = Math.round((Date.now() - startTs) / 1000);
          setImportStatus(`Queued (rescue id ${j.id}). Polling… ${elapsed}s`);
          const pr = await fetch(`/api/invoicing/import?id=${j.id}`);
          if (!pr.ok) continue; // transient — keep polling
          const pd = await pr.json();
          if (pd.status === "done") {
            const result = pd.result || {};
            setImportStatus(`✓ AX returned ${result.ax_total ?? "?"} invoices, enqueued ${result.enqueued ?? "?"} new ones.`);
            const refresh = await fetch(`/api/invoicing/queue-rows?date=${date}`);
            if (refresh.ok) setRows(((await refresh.json()).rows) || []);
            return;
          }
          if (pd.status === "error") throw new Error(pd.error_message || pd.error || "import errored");
        }
        setImportStatus(`Timed out after 60s. Daemon may be stalled — refresh in 30s to check, or click Import again.`);
      } catch (e: any) {
        setError(`Import: ${e.message}`);
        setImportStatus(null);
      }
    });
  };

  const onCancelImport = () => {
    cancelImportRef.current = true;
  };

  const submitIds = async (ids: number[] | null, label: string) => {
    setError(null);
    setPostStatus(`Approving ${ids ? ids.length : "all pending"} invoice(s) for the worker...`);
    try {
      const r = await fetch("/api/invoicing/post-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : {}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setPostStatus(`✓ ${label}: ${j.approved} approved. Worker processes in ~30s. Watch below.`);
      const refresh = await fetch(`/api/invoicing/queue-rows?date=${date}`);
      if (refresh.ok) setRows(((await refresh.json()).rows) || []);
    } catch (e: any) {
      setError(`${label}: ${e.message}`);
      setPostStatus(null);
    }
  };

  const onPostFirst = () => {
    if (pending === 0) { setError("No pending invoices."); return; }
    const firstPending = rows.find((r) => r.state === "pending");
    if (!firstPending) return;
    if (!confirm(`Test-post invoice ${firstPending.ax_invoice_number} ($${firstPending.ax_total_amount}) to LamLinks?\n\nThis fires WAWF 810 + 856 to DLA — real bid money. Use this first to verify the writeback shape matches Abe's manual flow.`)) return;
    startPost(async () => { await submitIds([firstPending.id], `Test-post ${firstPending.ax_invoice_number}`); });
  };

  const onPostAll = () => {
    if (pending === 0) { setError("No pending invoices to post."); return; }
    if (!confirm(`Post ALL ${pending} pending invoices to LamLinks? This fires WAWF 810 + 856 to DLA per invoice. Cannot be un-done. Verify the test invoice landed correctly first.`)) return;
    startPost(async () => { await submitIds(null, "Post all"); });
  };

  // Date picker helpers — invoice batches are filtered by ax_invoice_date.
  // Default is today, but Abe often needs to catch up yesterday's shipments.
  const today = new Date().toISOString().slice(0, 10);
  const yest = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
  const navTo = (d: string) => router.push(`/invoicing/post-batch?date=${d}`);

  return (
    <>
      <div className="mb-4 rounded-xl border border-card-border bg-white p-3 flex items-center gap-3 flex-wrap">
        <div className="text-sm font-semibold text-muted">Invoice date:</div>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && navTo(e.target.value)}
          className="rounded-md border border-card-border px-2 py-1 text-sm font-mono"
        />
        <button
          onClick={() => navTo(today)}
          disabled={date === today}
          className={`rounded-md border px-3 py-1 text-xs font-medium ${date === today ? "bg-blue-100 border-blue-300 text-blue-800" : "bg-white border-card-border hover:bg-gray-50"}`}
        >
          Today ({today})
        </button>
        <button
          onClick={() => navTo(yest)}
          disabled={date === yest}
          className={`rounded-md border px-3 py-1 text-xs font-medium ${date === yest ? "bg-blue-100 border-blue-300 text-blue-800" : "bg-white border-card-border hover:bg-gray-50"}`}
        >
          Yesterday ({yest})
        </button>
        <div className="text-xs text-muted ml-auto">
          Filters by AX <code className="font-mono bg-gray-100 px-1 rounded">ax_invoice_date</code>. Import + queue both respect this date.
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border-2 border-blue-300 bg-blue-50/30 p-4">
          <div className="text-xs font-bold text-blue-900 mb-2">STEP 1: Import from AX</div>
          <button
            onClick={onImport}
            disabled={importing}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 mb-2"
          >
            {importing ? "Importing..." : `⟳ Import DD219 invoices for ${date}`}
          </button>
          {importing && (
            <button
              onClick={onCancelImport}
              className="w-full rounded-lg border border-gray-400 bg-white hover:bg-gray-50 text-xs text-gray-700 py-1.5 mb-2"
            >
              ✕ Cancel poll (rescue may still finish in background)
            </button>
          )}
          <button
            onClick={async () => {
              const r = await fetch("/api/invoicing/refresh-from-ll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date }),
              });
              const j = await r.json();
              if (!r.ok) { setError(`Refresh: ${j.error || r.status}`); return; }
              setImportStatus("⟳ Syncing posted state from LL...");
              for (let i = 0; i < 20; i++) {
                await new Promise((res) => setTimeout(res, 1500));
                const pr = await fetch(`/api/invoicing/refresh-from-ll?id=${j.id}`);
                if (!pr.ok) continue;
                const pd = await pr.json();
                if (pd.status === "done") {
                  const result = pd.result || {};
                  setImportStatus(`✓ LL has ${result.ll_posted_today ?? "?"} posted today; ${result.updated ?? 0} synced.`);
                  const refresh = await fetch(`/api/invoicing/queue-rows?date=${date}`);
                  if (refresh.ok) setRows(((await refresh.json()).rows) || []);
                  return;
                }
                if (pd.status === "error") { setError(`Refresh: ${pd.error_message || pd.error}`); return; }
              }
              setError("Refresh timed out.");
            }}
            disabled={importing}
            className="w-full rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 text-xs text-blue-700 border border-blue-300 py-1.5 mb-2"
            title="Sync posted-state from LamLinks (after Abe posts manually). Doesn't re-pull AX."
          >
            ↻ Refresh posted state from LL
          </button>
          {importStatus && <div className="text-[11px] text-blue-800">{importStatus}</div>}
        </div>

        <div className="rounded-xl border-2 border-green-400 bg-green-50/30 p-4">
          <div className="text-xs font-bold text-green-900 mb-2">STEP 2: Post to LamLinks</div>
          {(() => {
            const firstPending = rows.find((r) => r.state === "pending");
            return (
              <button
                onClick={onPostFirst}
                disabled={posting || pending === 0}
                className="w-full rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2 mb-2 text-sm"
                title={firstPending ? `Will test: ${firstPending.ax_invoice_number} ($${firstPending.ax_total_amount}) — ${firstPending.ax_customer_order_reference || "no ref"}` : ""}
              >
                {posting ? "Posting..." : pending === 0 ? "(no pending)" :
                  firstPending ? <>🧪 Test-post <span className="font-mono">{firstPending.ax_invoice_number}</span> (${Number(firstPending.ax_total_amount).toLocaleString()}) only</> :
                  "🧪 Test-post 1st invoice only"}
              </button>
            );
          })()}
          <button
            onClick={onPostAll}
            disabled={posting || pending === 0}
            className="w-full rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2 mb-2"
          >
            {posting ? "Posting..." : pending === 0 ? "(no pending)" : `▶ Post all ${pending} to LamLinks`}
          </button>
          {postStatus && <div className="text-[11px] text-green-800">{postStatus}</div>}
        </div>

        <div className="rounded-xl border border-card-border bg-white p-4 text-sm">
          <div className="text-xs font-bold text-muted mb-2">{date === today ? "Today's batch" : `Batch for ${date}`}</div>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div><span className="text-muted">Total:</span> <span className="font-semibold">{total}</span> invoices</div>
            <div><span className="text-muted">$:</span> <span className="font-semibold">${totalDollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
            <div><span className="text-blue-700">Pending:</span> {pending}</div>
            <div><span className="text-amber-700">Queued:</span> {approved + processing}</div>
            <div><span className="text-green-700">Posted:</span> {posted}</div>
            <div><span className="text-red-700">Errors:</span> {errored}</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center">
          <div className="text-muted">No DD219 invoices in queue for {date} yet. Click <strong>Import</strong> to pull {date === today ? "today's" : `${date}'s`} from AX.</div>
        </div>
      ) : (
        <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-card-border">
              <tr>
                <th className="px-3 py-2 text-left">AX Invoice</th>
                <th className="px-3 py-2 text-left">Contract / Order Ref</th>
                <th className="px-3 py-2 text-left">SO</th>
                <th className="px-3 py-2 text-right">Lines</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-left">State</th>
                <th className="px-3 py-2 text-left">LL kad / cin_no</th>
                <th className="px-3 py-2 text-left">Note</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const firstPendingId = rows.find((x) => x.state === "pending")?.id;
                return rows.map((r) => {
                const lines = Array.isArray(r.ax_lines) ? r.ax_lines : [];
                const isFirstPending = r.id === firstPendingId;
                return (
                  <tr key={r.id} className={`border-b border-card-border/40 ${isFirstPending ? "bg-amber-50 ring-2 ring-amber-300" : ""}`}>
                    <td className="px-3 py-1.5 font-mono">{r.ax_invoice_number}{isFirstPending && <span className="ml-2 text-[10px] text-amber-800 font-semibold">← will test-post</span>}</td>
                    <td className="px-3 py-1.5">{r.ax_customer_order_reference || "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-[10px]">{r.ax_sales_order || "—"}</td>
                    <td className="px-3 py-1.5 text-right">{lines.length}</td>
                    <td className="px-3 py-1.5 text-right font-mono">${Number(r.ax_total_amount).toLocaleString()}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 text-[10px] rounded border ${STATE_PILL[r.state] || "bg-gray-100"}`}>{r.state}</span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[10px]">
                      {r.ll_idnkad ? `kad=${r.ll_idnkad} / ${r.ll_cin_no}` : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-[10px] text-red-700 max-w-[300px] truncate" title={r.error_message || ""}>
                      {r.error_message || (r.worker_host ? `via ${r.worker_host}` : "")}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.state === "pending" && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              if (!confirm(`Test-post just THIS invoice (${r.ax_invoice_number}, $${r.ax_total_amount})? Fires WAWF 810+856 to DLA.`)) return;
                              startPost(async () => { await submitIds([r.id], `Test-post ${r.ax_invoice_number}`); });
                            }}
                            disabled={posting}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 font-semibold"
                            title="Approve only this row for the worker"
                          >
                            🧪 Test this
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Skip ${r.ax_invoice_number} from this batch?`)) return;
                              await fetch(`/api/invoicing/skip-row`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: r.id }),
                              });
                              const refresh = await fetch(`/api/invoicing/queue-rows?date=${date}`);
                              if (refresh.ok) setRows(((await refresh.json()).rows) || []);
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300"
                            title="Remove this row from the queue"
                          >
                            ✕ Skip
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              });
              })()}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
