"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Check } from "lucide-react";

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
  notes: string | null;
  reviewed_by: string;
  reviewed_at: string;
};

const UOM_OPTIONS = ["EA", "PG", "PK", "BX", "CS", "CA", "DZ", "BT", "CN", "HD", "RO", "TU", "GAL", "QT", "PT", "LB", "OZ", "FT"];

export function SourcingModal({
  solicitation,
  onClose,
  onSaved,
}: {
  solicitation: Solicitation;
  onClose: () => void;
  onSaved: (updates: { bid_vendor: string; bid_cost?: number; bid_uom?: string; bid_item_number?: string }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);

  const [vendor, setVendor] = useState(solicitation.bid_vendor || "");
  const [uom, setUom] = useState(solicitation.bid_uom || "");
  const [cost, setCost] = useState(solicitation.bid_cost ? String(solicitation.bid_cost) : "");
  const [sku, setSku] = useState(solicitation.bid_item_number || "");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/solicitations/set-sourcing?id=${solicitation.id}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Load failed");
        setOverrides(data.overrides || []);
      } catch (e: any) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [solicitation.id]);

  // When vendor picks up a known override, auto-fill the rest from it.
  function prefillFromOverride(v: string) {
    const ov = overrides.find((o) => o.vendor.toUpperCase() === v.toUpperCase());
    if (!ov) return;
    if (ov.unit_of_measure) setUom(ov.unit_of_measure);
    if (ov.unit_cost !== null) setCost(String(ov.unit_cost));
    if (ov.supplier_sku) setSku(ov.supplier_sku);
    if (ov.notes) setNotes(ov.notes);
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
      if (notes.trim()) body.notes = notes.trim();

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
      });
      onClose();
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[560px] max-w-[95vw] max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-card-border flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-base">Pre-award sourcing</h3>
            <p className="text-xs text-muted mt-0.5">
              Lock in vendor, cost, UoM, and SKU now so when the award arrives, DIBS skips the review.
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
            <div className="flex items-center text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading existing overrides…</div>
          ) : (
            <>
              {overrides.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted mb-1">Existing on file for this NSN</div>
                  <div className="space-y-1">
                    {overrides.map((o) => (
                      <button
                        key={o.vendor}
                        type="button"
                        onClick={() => { setVendor(o.vendor); prefillFromOverride(o.vendor); }}
                        className="w-full text-left rounded border border-sky-200 bg-sky-50 hover:bg-sky-100 px-2 py-1.5 text-xs flex items-center justify-between"
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
                  <div className="text-[10px] text-muted mt-1">Click a row to pre-fill the form below.</div>
                </div>
              )}

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
                  <label className="text-xs text-muted block mb-1">Note (optional)</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. confirmed with Sue at Medline"
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
                  Writes to `dibbs_solicitations` + `nsn_review_overrides`
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
