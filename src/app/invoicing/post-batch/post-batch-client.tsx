"use client";

import { useEffect, useState, useTransition } from "react";

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
  const [rows, setRows] = useState<QueueRow[]>(initialRows);
  const [importing, startImport] = useTransition();
  const [posting, startPost] = useTransition();
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    startImport(async () => {
      try {
        const r = await fetch("/api/invoicing/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        setImportStatus(`Queued (rescue id ${j.id}). Polling...`);
        for (let i = 0; i < 40; i++) {
          await new Promise((res) => setTimeout(res, 3000));
          const pr = await fetch(`/api/invoicing/import?id=${j.id}`);
          const pd = await pr.json();
          if (pd.status === "done") {
            const result = pd.result || {};
            setImportStatus(`✓ AX returned ${result.ax_total ?? "?"} invoices, enqueued ${result.enqueued ?? "?"} new ones.`);
            const refresh = await fetch(`/api/invoicing/queue-rows?date=${date}`);
            if (refresh.ok) setRows(((await refresh.json()).rows) || []);
            return;
          }
          if (pd.status === "error") throw new Error(pd.error_message || "import errored");
        }
        setImportStatus("Timed out — check rescue actions log.");
      } catch (e: any) {
        setError(`Import: ${e.message}`);
        setImportStatus(null);
      }
    });
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

  return (
    <>
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
          {importStatus && <div className="text-[11px] text-blue-800">{importStatus}</div>}
        </div>

        <div className="rounded-xl border-2 border-green-400 bg-green-50/30 p-4">
          <div className="text-xs font-bold text-green-900 mb-2">STEP 2: Post to LamLinks</div>
          <button
            onClick={onPostFirst}
            disabled={posting || pending === 0}
            className="w-full rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-2 mb-2 text-sm"
          >
            {posting ? "Posting..." : pending === 0 ? "(no pending)" : `🧪 Test-post 1st invoice only`}
          </button>
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
          <div className="text-xs font-bold text-muted mb-2">Today&apos;s batch</div>
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
          <div className="text-muted">No DD219 invoices in queue for {date} yet. Click <strong>Import</strong> to pull today&apos;s from AX.</div>
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
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const lines = Array.isArray(r.ax_lines) ? r.ax_lines : [];
                return (
                  <tr key={r.id} className="border-b border-card-border/40">
                    <td className="px-3 py-1.5 font-mono">{r.ax_invoice_number}</td>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
