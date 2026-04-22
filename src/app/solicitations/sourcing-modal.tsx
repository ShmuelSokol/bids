"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Check, MessageSquare } from "lucide-react";

type Solicitation = {
  id: number;
  nsn: string;
  nomenclature?: string | null;
  solicitation_number: string;
  bid_vendor?: string | null;
  bid_cost?: number | null;
  bid_uom?: string | null;
  bid_item_number?: string | null;
};

type Override = {
  nsn: string;
  vendor: string;
  unit_of_measure: string | null;
  unit_cost: number | null;
  supplier_sku: string | null;
  reviewed_by: string;
  reviewed_at: string;
};

type Note = {
  id: number;
  note: string;
  vendor: string | null;
  author: string;
  created_at: string;
};

const UOM_OPTIONS = ["EA", "PG", "PK", "BX", "CS", "CA", "DZ", "BT", "CN", "HD", "RO", "TU", "GAL", "QT", "PT", "LB", "OZ", "FT"];

export function SourcingModal({
  solicitation,
  onClose,
  onSaved,
}: {
  solicitation: Solicitation;
  onClose: () => void;
  onSaved: (updates: { bid_vendor: string; bid_cost?: number; bid_uom?: string; bid_item_number?: string; draft_lines_updated: number }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  const [vendor, setVendor] = useState(solicitation.bid_vendor || "");
  const [uom, setUom] = useState(solicitation.bid_uom || "");
  const [cost, setCost] = useState(solicitation.bid_cost ? String(solicitation.bid_cost) : "");
  const [sku, setSku] = useState(solicitation.bid_item_number || "");
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/solicitations/set-sourcing?id=${solicitation.id}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Load failed");
        setOverrides(data.overrides || []);
        setNotes(data.notes || []);
      } catch (e: any) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [solicitation.id]);

  function prefillFromOverride(v: string) {
    const ov = overrides.find((o) => o.vendor.toUpperCase() === v.toUpperCase());
    if (!ov) return;
    if (ov.unit_of_measure) setUom(ov.unit_of_measure);
    if (ov.unit_cost !== null) setCost(String(ov.unit_cost));
    if (ov.supplier_sku) setSku(ov.supplier_sku);
  }

  async function save() {
    if (!vendor.trim()) { setErr("Vendor is required"); return; }
    setSaving(true); setErr(null);
    try {
      const body: any = {
        solicitation_id: solicitation.id,
        vendor: vendor.trim(),
      };
      if (uom.trim()) body.unit_of_measure = uom.trim();
      if (cost.trim()) {
        const n = Number(cost);
        if (Number.isNaN(n) || n <= 0) throw new Error("Cost must be a positive number");
        body.unit_cost = n;
      }
      if (sku.trim()) body.supplier_sku = sku.trim();
      if (newNote.trim()) body.new_note = newNote.trim();

      const res = await fetch("/api/solicitations/set-sourcing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      onSaved({
        bid_vendor: vendor.trim().toUpperCase(),
        bid_cost: body.unit_cost,
        bid_uom: body.unit_of_measure?.toUpperCase(),
        bid_item_number: body.supplier_sku,
        draft_lines_updated: data.draft_lines_updated || 0,
      });
      onClose();
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  // Preview the margin change with the typed cost, so Abe sees the impact
  // before clicking save. Uses the solicitation's suggested_price if known.
  const typedCost = Number(cost) || 0;
  // suggested_price not returned by the route payload — compute later via server
  // on save. Here we just show the cost itself.

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[640px] max-w-[95vw] max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-card-border flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-base">Pre-award sourcing</h3>
            <p className="text-xs text-muted mt-0.5">
              Lock vendor + cost + UoM + SKU now. Future awards for this NSN+vendor skip the review. Saving also updates any matching draft POs with the new cost.
            </p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-md border border-card-border bg-gray-50 p-3 text-xs">
            <div><span className="text-muted">NSN:</span> <span className="font-mono font-medium">{solicitation.nsn}</span></div>
            <div><span className="text-muted">Solicitation:</span> <span className="font-mono">{solicitation.solicitation_number}</span></div>
            {solicitation.nomenclature && (
              <div><span className="text-muted">Item:</span> {solicitation.nomenclature}</div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading sourcing history…</div>
          ) : (
            <>
              {/* Existing overrides — click to prefill */}
              {overrides.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted mb-1">Existing vendor setups for this NSN</div>
                  <div className="space-y-1">
                    {overrides.map((o) => (
                      <button
                        key={o.vendor}
                        type="button"
                        onClick={() => { setVendor(o.vendor); prefillFromOverride(o.vendor); }}
                        className={`w-full text-left rounded border px-2 py-1.5 text-xs flex items-center justify-between ${
                          vendor.toUpperCase() === o.vendor.toUpperCase()
                            ? "border-sky-400 bg-sky-100"
                            : "border-sky-200 bg-sky-50 hover:bg-sky-100"
                        }`}
                      >
                        <span>
                          <span className="font-medium">{o.vendor}</span>
                          <span className="text-muted">
                            {" · "}{o.unit_of_measure || "—"} @ ${Number(o.unit_cost || 0).toFixed(2)}
                            {o.supplier_sku ? ` · SKU ${o.supplier_sku}` : ""}
                          </span>
                        </span>
                        <span className="text-[10px] text-muted">
                          {o.reviewed_by} · {new Date(o.reviewed_at).toISOString().slice(0, 10)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Historical notes — append-only, across vendors */}
              {notes.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted mb-1 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Historical notes ({notes.length})
                  </div>
                  <div className="rounded border border-amber-200 bg-amber-50 max-h-36 overflow-y-auto">
                    {notes.map((n, i) => (
                      <div
                        key={n.id}
                        className={`px-2.5 py-1.5 text-xs ${i < notes.length - 1 ? "border-b border-amber-200/60" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            {n.vendor && (
                              <span className="inline-block text-[9px] font-medium uppercase rounded bg-white border border-amber-300 text-amber-800 px-1 mr-1">{n.vendor}</span>
                            )}
                            <span>{n.note}</span>
                          </div>
                          <div className="text-[10px] text-muted whitespace-nowrap">
                            {n.author} · {new Date(n.created_at).toISOString().slice(0, 10)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit form */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted block mb-1">Vendor (AX account) *</label>
                  <input
                    value={vendor}
                    onChange={(e) => { const v = e.target.value.toUpperCase(); setVendor(v); prefillFromOverride(v); }}
                    placeholder="e.g. AMERIB"
                    className="w-full rounded border border-card-border px-2 py-1.5 text-sm font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Unit of measure</label>
                  <select
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    className="w-full rounded border border-card-border px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="">—</option>
                    {UOM_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                    {uom && !UOM_OPTIONS.includes(uom) && <option value={uom}>{uom}</option>}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Unit cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full rounded border border-card-border px-2 py-1.5 text-sm font-mono"
                  />
                  {typedCost > 0 && solicitation.bid_cost && Math.abs(typedCost - Number(solicitation.bid_cost)) > 0.01 && (
                    <div className="text-[10px] text-muted mt-0.5">
                      Was ${Number(solicitation.bid_cost).toFixed(2)} → margin will recalc on save (solicitation + any matching draft POs).
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted block mb-1">Supplier SKU (vendor's part #)</label>
                  <input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. 12345678"
                    className="w-full rounded border border-card-border px-2 py-1.5 text-sm font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted block mb-1">Add a note (appends to history — won't overwrite past notes)</label>
                  <input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder='e.g. "vendor blocked" or "confirmed $4.25 with Sue 2026-05-15"'
                    className="w-full rounded border border-card-border px-2 py-1.5 text-sm"
                  />
                </div>
              </div>

              {err && <div className="text-sm text-red-500 rounded bg-red-50 border border-red-200 p-2">{err}</div>}

              <div className="flex items-center gap-2">
                <button
                  onClick={save}
                  disabled={saving || !vendor.trim()}
                  className="rounded bg-accent text-white px-3 py-1.5 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save sourcing
                </button>
                <button
                  onClick={onClose}
                  className="rounded border border-card-border px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <div className="flex-1" />
                <span className="text-[10px] text-muted">
                  Updates solicitation, (NSN, vendor) override, appends note, and cascades to matching draft POs.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
