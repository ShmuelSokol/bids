"use client";

import { useEffect, useState } from "react";
import { X, RefreshCw, ExternalLink, Check, Star, Loader2, AlertCircle, FileText, Building2 } from "lucide-react";
import { formatDateShort, formatDateTime } from "@/lib/dates";

interface Finding {
  id: number;
  supplier_name: string;
  supplier_cage: string | null;
  supplier_url: string | null;
  product_url: string | null;
  list_price: number | null;
  moq: number | null;
  lead_time_days: number | null;
  is_manufacturer: boolean;
  erg_has_account: boolean;
  erg_has_past_po: boolean;
  past_po_count: number;
  last_po_date: string | null;
  confidence: number;
  source: string;
  rationale: string;
}

interface Status {
  nsn: string;
  last_researched_at: string | null;
  candidate_count: number;
  top_supplier_cage: string | null;
  top_supplier_name: string | null;
  abe_verified_cage: string | null;
  abe_verified_at: string | null;
  abe_notes: string | null;
  queue_status: string;
}

interface Props {
  nsn: string;
  solicitationNumber?: string;
  onClose: () => void;
}

function stars(confidence: number): number {
  return Math.max(1, Math.min(5, Math.round(confidence * 5)));
}

export function ResearchDrawer({ nsn, solicitationNumber, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [picks, setPicks] = useState<any[]>([]);
  const [overrideUrl, setOverrideUrl] = useState("");
  const [overrideSupplier, setOverrideSupplier] = useState("");
  const [overridePrice, setOverridePrice] = useState("");
  const [notes, setNotes] = useState("");
  const [savingPick, setSavingPick] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/research/${encodeURIComponent(nsn)}`);
      const data = await r.json();
      setStatus(data.status);
      setFindings(data.findings || []);
      setPicks(data.picks || []);
      const verified = data.picks?.[0];
      if (verified) {
        setOverrideSupplier(verified.chosen_supplier_name || "");
        setOverridePrice(String(verified.chosen_price || ""));
        setOverrideUrl(verified.chosen_url || "");
        setNotes(verified.reason || "");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [nsn]);

  async function saveFindingPick(f: Finding) {
    setSavingPick(true);
    await fetch("/api/research/pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nsn,
        solicitation_number: solicitationNumber || null,
        chosen_supplier_name: f.supplier_name,
        chosen_supplier_cage: f.supplier_cage,
        chosen_price: f.list_price,
        chosen_url: f.product_url,
        reason: `Picked from auto-research (confidence ${(f.confidence * 100).toFixed(0)}%)`,
      }),
    });
    setSavingPick(false);
    await load();
  }

  async function saveOverridePick() {
    if (!overrideSupplier.trim()) return;
    setSavingPick(true);
    await fetch("/api/research/pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nsn,
        solicitation_number: solicitationNumber || null,
        chosen_supplier_name: overrideSupplier.trim(),
        chosen_supplier_cage: null,
        chosen_price: overridePrice ? Number(overridePrice) : null,
        chosen_url: overrideUrl.trim() || null,
        reason: notes.trim() || "Manual override",
      }),
    });
    setSavingPick(false);
    await load();
  }

  async function reresearch() {
    setRefreshing(true);
    await fetch("/api/research/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nsn }),
    });
    setRefreshing(false);
    await load();
  }

  const verifiedCage = status?.abe_verified_cage;
  const ageDays = status?.last_researched_at
    ? Math.floor((Date.now() - new Date(status.last_researched_at).getTime()) / 86_400_000)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-card-border px-4 py-3 flex items-center justify-between z-10">
          <div>
            <div className="text-xs text-muted uppercase tracking-wide">Auto-Research</div>
            <div className="text-sm font-mono font-semibold">{nsn}</div>
            {solicitationNumber && (
              <div className="text-[10px] text-muted font-mono">sol: {solicitationNumber}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reresearch}
              disabled={refreshing}
              className="text-xs inline-flex items-center gap-1 rounded border border-card-border px-2 py-1 hover:bg-gray-50"
            >
              {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Re-research
            </button>
            <button onClick={onClose} className="text-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !status ? (
            <div className="text-sm text-muted">
              Never researched. Click "Re-research" to queue it.
            </div>
          ) : status.queue_status === "queued" || status.queue_status === "running" ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
              {status.queue_status === "running" ? "Research running now…" : "Queued — will process on next worker pass."}
              <div className="text-[10px] text-blue-700 mt-1">Usually ready within 1–2 minutes.</div>
            </div>
          ) : findings.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="inline h-4 w-4 mr-2" />
              No candidates found. This item may be custom / legacy DoD, or the NSN description wasn't specific enough.
              Try the manual override below.
            </div>
          ) : (
            <>
              <div className="text-[10px] text-muted mb-3">
                {findings.length} candidates · last researched {ageDays != null ? `${ageDays}d ago` : "never"}
                {status.last_researched_at && ` (${formatDateTime(status.last_researched_at)})`}
              </div>
              <div className="space-y-2">
                {findings.map((f) => {
                  const isPicked = verifiedCage && f.supplier_cage === verifiedCage;
                  return (
                    <div
                      key={f.id}
                      className={`rounded-lg border p-3 ${
                        isPicked
                          ? "border-green-400 bg-green-50"
                          : f.erg_has_account
                          ? "border-blue-300 bg-blue-50/50"
                          : "border-card-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-semibold text-sm">{f.supplier_name}</div>
                            {f.supplier_cage && (
                              <span className="font-mono text-[10px] bg-gray-100 px-1 rounded">{f.supplier_cage}</span>
                            )}
                            {f.erg_has_account && (
                              <span className="text-[10px] rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 inline-flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> ERG account
                              </span>
                            )}
                            {f.is_manufacturer && (
                              <span className="text-[10px] rounded-full bg-purple-100 text-purple-700 px-2 py-0.5">
                                mfr
                              </span>
                            )}
                            {isPicked && (
                              <span className="text-[10px] rounded-full bg-green-100 text-green-700 px-2 py-0.5 inline-flex items-center gap-1">
                                <Check className="h-3 w-3" /> Abe's pick
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted">
                            <span title={`confidence ${(f.confidence * 100).toFixed(0)}%`}>
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`inline h-3 w-3 ${i < stars(f.confidence) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
                                />
                              ))}
                            </span>
                            {f.list_price != null && (
                              <span className="font-mono text-green-700">${Number(f.list_price).toFixed(2)}</span>
                            )}
                            {f.moq != null && <span>MOQ {f.moq}</span>}
                            {f.lead_time_days != null && <span>{f.lead_time_days}d lead</span>}
                          </div>
                          {f.rationale && <p className="text-[11px] text-muted mt-1 italic">"{f.rationale}"</p>}
                          <div className="flex items-center gap-2 mt-1 text-[10px]">
                            {f.product_url && (
                              <a
                                href={f.product_url}
                                target="_blank"
                                rel="noopener"
                                className="text-accent hover:underline inline-flex items-center gap-0.5"
                              >
                                product <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                            {f.supplier_url && (
                              <a
                                href={f.supplier_url}
                                target="_blank"
                                rel="noopener"
                                className="text-accent hover:underline inline-flex items-center gap-0.5"
                              >
                                website <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => saveFindingPick(f)}
                          disabled={savingPick || !!isPicked}
                          className={`text-xs rounded px-2 py-1 font-medium whitespace-nowrap ${
                            isPicked
                              ? "bg-green-600 text-white cursor-default"
                              : "bg-accent text-white hover:opacity-90"
                          }`}
                        >
                          {isPicked ? "Picked" : "Use this"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Manual override */}
          <div className="mt-6 rounded-lg border-2 border-dashed border-card-border p-3">
            <div className="text-xs font-semibold text-muted mb-2 uppercase">Your pick (override)</div>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Supplier name (e.g. Medline, or a CAGE)"
                value={overrideSupplier}
                onChange={(e) => setOverrideSupplier(e.target.value)}
                className="w-full text-sm rounded border border-card-border px-2 py-1"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="URL (optional)"
                  value={overrideUrl}
                  onChange={(e) => setOverrideUrl(e.target.value)}
                  className="flex-1 text-xs rounded border border-card-border px-2 py-1"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="$/unit"
                  value={overridePrice}
                  onChange={(e) => setOverridePrice(e.target.value)}
                  className="w-24 text-xs rounded border border-card-border px-2 py-1"
                />
              </div>
              <textarea
                placeholder="Notes (why this supplier)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full text-xs rounded border border-card-border px-2 py-1"
              />
              <button
                onClick={saveOverridePick}
                disabled={!overrideSupplier.trim() || savingPick}
                className="text-xs rounded bg-accent text-white px-3 py-1 disabled:opacity-50"
              >
                {savingPick ? "Saving…" : "Save my pick"}
              </button>
            </div>
          </div>

          {picks.length > 0 && (
            <div className="mt-6">
              <div className="text-xs font-semibold text-muted mb-2 uppercase">Previous picks for this NSN</div>
              <div className="space-y-1 text-[11px]">
                {picks.slice(0, 5).map((p) => (
                  <div key={p.id} className="rounded border border-card-border px-2 py-1 text-muted">
                    <span className="font-medium text-foreground">{p.chosen_supplier_name}</span>
                    {p.chosen_price != null && <span> @ ${Number(p.chosen_price).toFixed(2)}</span>}
                    {p.solicitation_number && <span> · {p.solicitation_number}</span>}
                    <span className="ml-2">{formatDateShort(p.picked_at)}</span>
                    {p.reason && <div className="italic mt-0.5">"{p.reason}"</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
