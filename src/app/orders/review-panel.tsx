"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ChevronLeft, ChevronRight, Check, RefreshCw, AlertTriangle, CircleCheck } from "lucide-react";

type ReviewLine = {
  id: number;
  po_id: number;
  po_number: string;
  nsn: string;
  description: string;
  quantity: number;
  unit_cost: number;
  unit_of_measure: string | null;
  sell_price: number;
  margin_pct: number | null;
  supplier: string;
  cost_source: string;
  vendor_item_number: string | null;
  ax_item_number: string | null;
  contract_number: string | null;
  reasons: string[];
  existing_override: {
    unit_of_measure: string | null;
    unit_cost: number | null;
    notes: string | null;
    reviewed_by: string;
    reviewed_at: string;
  } | null;
};

const UOM_OPTIONS = ["EA", "PG", "PK", "BX", "CS", "CA", "DZ", "BT", "CN", "HD", "RO", "TU", "GAL", "QT", "PT", "LB", "OZ", "FT"];

export function ReviewPanel() {
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  const [draftUom, setDraftUom] = useState<string>("");
  const [draftCost, setDraftCost] = useState<string>("");
  const [draftNotes, setDraftNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders/review-lines", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setLines(data.lines || []);
      setIdx(0);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // When the current line changes, reset the draft form.
  const current = lines[idx];
  useEffect(() => {
    if (!current) {
      setDraftUom(""); setDraftCost(""); setDraftNotes("");
      return;
    }
    setDraftUom(current.unit_of_measure || "");
    setDraftCost(current.unit_cost ? String(current.unit_cost) : "");
    setDraftNotes("");
    setSaveMsg(null);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveAndNext(opts: { persist: boolean }) {
    if (!current) return;
    const body: any = { line_id: current.id };
    const uomTrimmed = draftUom.trim().toUpperCase();
    const costNum = draftCost.trim() ? Number(draftCost) : undefined;
    if (uomTrimmed && uomTrimmed !== (current.unit_of_measure || "").toUpperCase()) {
      body.unit_of_measure = uomTrimmed;
    }
    if (costNum !== undefined && !Number.isNaN(costNum) && Math.abs(costNum - Number(current.unit_cost || 0)) > 0.001) {
      body.unit_cost = costNum;
    }
    if (Object.keys(body).length === 1) {
      // nothing to save — just advance
      advance();
      return;
    }
    if (opts.persist) {
      body.persist_override = true;
      if (draftNotes.trim()) body.override_notes = draftNotes.trim();
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/orders/po-lines/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      // Remove this line from the queue and advance
      setLines((prev) => prev.filter((l) => l.id !== current.id));
      setIdx((prev) => Math.min(prev, Math.max(0, lines.length - 2)));
      setSaveMsg(opts.persist ? "Saved + override stored for this NSN+vendor" : "Saved (no override)");
    } catch (e: any) {
      setSaveMsg(`Error: ${e.message || String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  function advance() {
    setIdx((prev) => Math.min(prev + 1, lines.length - 1));
    setSaveMsg(null);
  }
  function back() {
    setIdx((prev) => Math.max(0, prev - 1));
    setSaveMsg(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading review queue...
      </div>
    );
  }
  if (error) {
    return <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>;
  }
  if (lines.length === 0) {
    return (
      <div className="rounded-lg border border-card-border bg-card-bg p-8 text-center">
        <CircleCheck className="h-10 w-10 text-green-500 mx-auto mb-3" />
        <div className="font-medium">Nothing to review</div>
        <div className="text-sm text-muted mt-1">All draft PO lines have clean margins and verified UoM.</div>
        <button
          onClick={load}
          className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>
    );
  }

  const hasMargin = current.margin_pct !== null && current.margin_pct !== undefined;
  const marginColor =
    !hasMargin ? "text-muted" :
    Number(current.margin_pct) < 0 ? "text-red-500" :
    Number(current.margin_pct) < 10 ? "text-amber-500" :
    Number(current.margin_pct) > 50 ? "text-amber-500" :
    "text-green-500";

  return (
    <div>
      {/* Header + progress */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={back}
            disabled={idx === 0}
            className="p-1.5 rounded border border-card-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-card-bg"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm text-muted">
            <span className="font-medium text-foreground">{idx + 1}</span> of <span className="font-medium text-foreground">{lines.length}</span> to review
          </div>
          <button
            onClick={advance}
            disabled={idx >= lines.length - 1}
            className="p-1.5 rounded border border-card-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-card-bg"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent"
        >
          <RefreshCw className="h-3 w-3" /> Refresh queue
        </button>
      </div>

      {/* The card */}
      <div className="rounded-lg border border-card-border bg-card-bg p-6">
        {/* Flags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {current.reasons.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-xs text-amber-400">
              <AlertTriangle className="h-3 w-3" /> {r}
            </span>
          ))}
        </div>

        {/* Identity */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs text-muted">NSN</div>
            <div className="font-mono font-medium">{current.nsn}</div>
          </div>
          <div>
            <div className="text-xs text-muted">PO / Supplier</div>
            <div className="font-medium">
              {current.po_number} <span className="text-muted">·</span> {current.supplier}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-muted">Description</div>
            <div className="text-sm">{current.description}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Contract</div>
            <div className="font-mono text-sm">{current.contract_number || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted">AX Item# / Vendor P/N</div>
            <div className="font-mono text-sm">
              {current.ax_item_number || "—"} <span className="text-muted">/</span> {current.vendor_item_number || "—"}
            </div>
          </div>
        </div>

        {/* Numbers */}
        <div className="grid grid-cols-4 gap-4 mb-4 rounded-md border border-card-border bg-background p-3">
          <div>
            <div className="text-xs text-muted">Qty</div>
            <div className="font-medium">{current.quantity}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Sell price</div>
            <div className="font-medium">${Number(current.sell_price || 0).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Unit cost</div>
            <div className="font-medium">${Number(current.unit_cost || 0).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Margin</div>
            <div className={`font-medium ${marginColor}`}>
              {hasMargin ? `${Number(current.margin_pct).toFixed(1)}%` : "—"}
            </div>
          </div>
        </div>

        {/* cost_source trail */}
        <div className="text-xs text-muted mb-4">
          <span className="font-medium">Cost source:</span> {current.cost_source || "—"}
        </div>

        {/* Existing override badge */}
        {current.existing_override && (
          <div className="mb-4 rounded-md border border-sky-500/30 bg-sky-500/10 p-3 text-sm">
            <div className="font-medium text-sky-400">Existing review on file for this NSN+vendor</div>
            <div className="text-xs text-muted mt-1">
              {current.existing_override.unit_of_measure || "—"} @ ${Number(current.existing_override.unit_cost || 0).toFixed(2)}
              {" · reviewed by "}{current.existing_override.reviewed_by}
              {" · "}{new Date(current.existing_override.reviewed_at).toISOString().slice(0, 10)}
              {current.existing_override.notes ? ` · "${current.existing_override.notes}"` : ""}
            </div>
          </div>
        )}

        {/* Edit form */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-muted block mb-1">Unit of measure</label>
            <select
              value={draftUom}
              onChange={(e) => setDraftUom(e.target.value)}
              className="w-full rounded border border-card-border px-2 py-1.5 text-sm bg-background"
            >
              <option value="">—</option>
              {UOM_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              {draftUom && !UOM_OPTIONS.includes(draftUom) && (
                <option value={draftUom}>{draftUom}</option>
              )}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Unit cost ($)</label>
            <input
              type="number"
              step="0.01"
              value={draftCost}
              onChange={(e) => setDraftCost(e.target.value)}
              className="w-full rounded border border-card-border px-2 py-1.5 text-sm bg-background font-mono"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted block mb-1">Note (optional — saved on the override)</label>
            <input
              type="text"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              placeholder="e.g. vendor confirmed pack of 10"
              className="w-full rounded border border-card-border px-2 py-1.5 text-sm bg-background"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => saveAndNext({ persist: true })}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded bg-accent text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save + remember for this NSN
          </button>
          <button
            onClick={() => saveAndNext({ persist: false })}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded border border-card-border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-background"
          >
            Save this line only
          </button>
          <button
            onClick={advance}
            disabled={saving || idx >= lines.length - 1}
            className="inline-flex items-center gap-1 rounded border border-card-border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-background"
          >
            Skip <ChevronRight className="h-4 w-4" />
          </button>
          <div className="flex-1" />
          <a
            href={`/orders#po-${current.po_id}`}
            className="text-xs text-accent hover:underline"
          >
            Open PO → switch supplier
          </a>
        </div>

        {saveMsg && (
          <div className={`mt-3 text-sm ${saveMsg.startsWith("Error") ? "text-red-400" : "text-green-500"}`}>
            {saveMsg}
          </div>
        )}
      </div>
    </div>
  );
}
