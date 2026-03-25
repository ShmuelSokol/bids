"use client";

import { useState } from "react";
import {
  RefreshCw,
  TrendingUp,
  DollarSign,
  MessageSquare,
  Check,
  X,
  Loader2,
  Send,
  Zap,
  Package,
} from "lucide-react";

interface Solicitation {
  id: number;
  nsn: string;
  nomenclature: string;
  solicitation_number: string;
  quantity: number;
  issue_date: string;
  return_by_date: string;
  fsc: string;
  set_aside: string;
  is_sourceable: boolean;
  source: string | null;
  source_item: string | null;
  suggested_price: number | null;
  our_cost: number | null;
  margin_pct: number | null;
  bid_status: string | null;
  final_price: number | null;
  bid_comment: string | null;
  decided_by: string | null;
}

interface Counts {
  total: number;
  sourceable: number;
  quoted: number;
  submitted: number;
  skipped: number;
}

export function SolicitationsList({
  initialData,
  counts: initialCounts,
}: {
  initialData: Solicitation[];
  counts: Counts;
}) {
  const [solicitations, setSolicitations] = useState(initialData);
  const [counts, setCounts] = useState(initialCounts);
  const [filter, setFilter] = useState<string>("sourceable");
  const [scraping, setScraping] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editDays, setEditDays] = useState("45");
  const [editComment, setEditComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedQuoted, setSelectedQuoted] = useState<Set<number>>(new Set());

  async function handleScrapeNow() {
    setScraping(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dibbs/scrape-now", { method: "POST" });
      const data = await res.json();
      setMessage(`Scraped ${data.count} solicitations. Enriching...`);
      // Auto-enrich after scrape
      await handleEnrich();
      window.location.reload();
    } catch {
      setMessage("Scrape failed");
    } finally {
      setScraping(false);
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    try {
      const res = await fetch("/api/dibbs/enrich", { method: "POST" });
      const data = await res.json();
      setMessage(
        `Enriched: ${data.sourceable} sourceable (${data.ax_matches} from AX, ${data.masterdb_matches} from Master DB)`
      );
      window.location.reload();
    } catch {
      setMessage("Enrichment failed");
    } finally {
      setEnriching(false);
    }
  }

  async function handleApprove(sol: Solicitation) {
    setSaving(true);
    const price = parseFloat(editPrice) || sol.suggested_price;
    try {
      await fetch("/api/bids/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitation_number: sol.solicitation_number,
          nsn: sol.nsn,
          nomenclature: sol.nomenclature,
          quantity: sol.quantity,
          suggested_price: sol.suggested_price,
          final_price: price,
          lead_time_days: parseInt(editDays) || 45,
          comment: editComment || null,
          status: "quoted",
          source: sol.source,
          source_item: sol.source_item,
        }),
      });
      setSolicitations((prev) =>
        prev.map((s) =>
          s.id === sol.id
            ? { ...s, bid_status: "quoted", final_price: price, bid_comment: editComment || null }
            : s
        )
      );
      setCounts((c) => ({ ...c, sourceable: c.sourceable - 1, quoted: c.quoted + 1 }));
      setEditingId(null);
      setEditPrice("");
      setEditDays("45");
      setEditComment("");
    } catch {} finally {
      setSaving(false);
    }
  }

  async function handleSkip(sol: Solicitation) {
    setSaving(true);
    try {
      await fetch("/api/bids/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitation_number: sol.solicitation_number,
          nsn: sol.nsn,
          nomenclature: sol.nomenclature,
          quantity: sol.quantity,
          suggested_price: sol.suggested_price,
          final_price: null,
          comment: editComment || null,
          status: "skipped",
        }),
      });
      setSolicitations((prev) =>
        prev.map((s) =>
          s.id === sol.id ? { ...s, bid_status: "skipped" } : s
        )
      );
      setCounts((c) => ({ ...c, sourceable: c.sourceable - 1, skipped: c.skipped + 1 }));
      setEditingId(null);
      setEditComment("");
    } catch {} finally {
      setSaving(false);
    }
  }

  async function handleSubmitAll() {
    if (selectedQuoted.size === 0) return;
    setSubmitting(true);
    try {
      const toSubmit = solicitations.filter(
        (s) => s.bid_status === "quoted" && selectedQuoted.has(s.id)
      );
      for (const sol of toSubmit) {
        await fetch("/api/bids/decide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            solicitation_number: sol.solicitation_number,
            nsn: sol.nsn,
            nomenclature: sol.nomenclature,
            quantity: sol.quantity,
            suggested_price: sol.suggested_price,
            final_price: sol.final_price,
            status: "submitted",
          }),
        });
      }
      setSolicitations((prev) =>
        prev.map((s) =>
          selectedQuoted.has(s.id) && s.bid_status === "quoted"
            ? { ...s, bid_status: "submitted" }
            : s
        )
      );
      setCounts((c) => ({
        ...c,
        quoted: c.quoted - selectedQuoted.size,
        submitted: c.submitted + selectedQuoted.size,
      }));
      setSelectedQuoted(new Set());
      setMessage(`${toSubmit.length} bids submitted!`);
    } catch {
      setMessage("Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSelectAll() {
    const quotedIds = filtered.filter((s) => s.bid_status === "quoted").map((s) => s.id);
    if (selectedQuoted.size === quotedIds.length) {
      setSelectedQuoted(new Set());
    } else {
      setSelectedQuoted(new Set(quotedIds));
    }
  }

  const filtered = solicitations.filter((s) => {
    if (filter === "sourceable") return s.is_sourceable && !s.bid_status;
    if (filter === "quoted") return s.bid_status === "quoted";
    if (filter === "submitted") return s.bid_status === "submitted";
    if (filter === "skipped") return s.bid_status === "skipped";
    if (filter === "all_unsourced") return !s.is_sourceable;
    return true;
  });

  return (
    <>
      {/* Pipeline Stats */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {[
          { key: "sourceable", label: "Sourceable", count: counts.sourceable, color: "border-green-300 bg-green-50", icon: Zap },
          { key: "quoted", label: "Quoted", count: counts.quoted, color: "border-blue-300 bg-blue-50", icon: DollarSign },
          { key: "submitted", label: "Submitted", count: counts.submitted, color: "border-purple-300 bg-purple-50", icon: Send },
          { key: "skipped", label: "Skipped", count: counts.skipped, color: "border-gray-300 bg-gray-50", icon: X },
          { key: "all", label: "All", count: counts.total, color: "border-card-border bg-card-bg", icon: Package },
        ].map((step) => (
          <button
            key={step.key}
            onClick={() => setFilter(step.key)}
            className={`rounded-lg border-2 p-3 text-center transition-all ${step.color} ${filter === step.key ? "ring-2 ring-accent" : ""}`}
          >
            <step.icon className="h-4 w-4 mx-auto mb-1 opacity-60" />
            <div className="text-2xl font-bold">{step.count}</div>
            <div className="text-xs font-medium">{step.label}</div>
          </button>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {filter === "quoted" && filtered.length > 0 && (
            <>
              <button
                onClick={toggleSelectAll}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-card-border bg-card-bg hover:bg-gray-50"
              >
                {selectedQuoted.size === filtered.filter((s) => s.bid_status === "quoted").length
                  ? "Deselect All"
                  : "Select All"}
              </button>
              {selectedQuoted.size > 0 && (
                <button
                  onClick={handleSubmitAll}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Submit {selectedQuoted.size} Bids
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Match NSNs
          </button>
          <button
            onClick={handleScrapeNow}
            disabled={scraping}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {scraping ? "Scraping..." : "Scrape Now"}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-blue-50 text-blue-700 px-4 py-2 text-sm">
          {message}
        </div>
      )}

      {/* Solicitation List */}
      <div className="space-y-2">
        {filtered.map((s) => {
          const isEditing = editingId === s.id;

          return (
            <div
              key={s.id}
              className={`rounded-xl border bg-card-bg shadow-sm overflow-hidden ${
                s.bid_status === "submitted"
                  ? "border-purple-300 bg-purple-50/20"
                  : s.bid_status === "quoted"
                    ? "border-blue-300 bg-blue-50/20"
                    : s.bid_status === "skipped"
                      ? "border-gray-300 opacity-50"
                      : s.is_sourceable
                        ? "border-green-300"
                        : "border-card-border"
              }`}
            >
              <div className="px-6 py-3">
                <div className="flex items-start justify-between gap-4">
                  {/* Checkbox for quoted items */}
                  {s.bid_status === "quoted" && filter === "quoted" && (
                    <input
                      type="checkbox"
                      checked={selectedQuoted.has(s.id)}
                      onChange={(e) => {
                        const next = new Set(selectedQuoted);
                        if (e.target.checked) next.add(s.id);
                        else next.delete(s.id);
                        setSelectedQuoted(next);
                      }}
                      className="mt-1 rounded"
                    />
                  )}

                  {/* Left: Item Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      {s.is_sourceable && !s.bid_status && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                          <Zap className="h-3 w-3" /> Sourceable
                        </span>
                      )}
                      {s.bid_status === "quoted" && (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">QUOTED</span>
                      )}
                      {s.bid_status === "submitted" && (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">SUBMITTED</span>
                      )}
                      {s.bid_status === "skipped" && (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">SKIPPED</span>
                      )}
                      {s.source && (
                        <span className="text-xs text-muted">
                          via {s.source === "ax" ? "AX" : "Master DB"}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold truncate">
                      {s.nomenclature || "Unknown Item"}
                    </h3>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted flex-wrap">
                      <span className="font-mono text-accent">{s.nsn}</span>
                      <span className="font-mono">{s.solicitation_number}</span>
                      <span>Qty: {s.quantity}</span>
                      <span>Due: {s.return_by_date}</span>
                    </div>

                    {s.bid_comment && (
                      <div className="mt-1 text-xs bg-yellow-50 text-yellow-800 px-2 py-1 rounded inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {s.bid_comment}
                        {s.decided_by && <span className="text-yellow-600 ml-1">— {s.decided_by}</span>}
                      </div>
                    )}
                  </div>

                  {/* Right: Pricing + Actions */}
                  <div className="text-right min-w-[260px]">
                    {s.bid_status === "quoted" && (
                      <div className="text-lg font-bold font-mono text-blue-600">
                        ${s.final_price?.toFixed(2)}
                      </div>
                    )}
                    {s.bid_status === "submitted" && (
                      <div className="text-lg font-bold font-mono text-purple-600">
                        ${s.final_price?.toFixed(2)}
                        <span className="text-xs font-normal text-muted ml-1">submitted</span>
                      </div>
                    )}

                    {s.is_sourceable && !s.bid_status && (
                      <>
                        {s.suggested_price && (
                          <div className="mb-2">
                            {s.our_cost ? (
                              <div className="flex items-center gap-3 justify-end text-xs text-muted mb-1">
                                <span>Cost: <span className="font-mono font-medium text-foreground">${s.our_cost.toFixed(2)}</span></span>
                                {s.margin_pct !== null && (
                                  <span className={`font-medium ${s.margin_pct >= 20 ? "text-green-600" : s.margin_pct >= 10 ? "text-yellow-600" : "text-red-600"}`}>
                                    {s.margin_pct}% margin
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-muted mb-1">Based on last award</div>
                            )}
                            <div className="text-lg font-bold font-mono text-green-600">
                              ${s.suggested_price.toFixed(2)}
                            </div>
                          </div>
                        )}

                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="flex gap-2 justify-end">
                              <div>
                                <div className="text-xs text-muted mb-0.5">Price</div>
                                <input
                                  type="number"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  placeholder={s.suggested_price?.toFixed(2) || "0.00"}
                                  step="0.01"
                                  className="w-24 rounded border border-card-border px-2 py-1.5 text-sm font-mono text-right"
                                  autoFocus
                                />
                              </div>
                              <div>
                                <div className="text-xs text-muted mb-0.5">Days</div>
                                <input
                                  type="number"
                                  value={editDays}
                                  onChange={(e) => setEditDays(e.target.value)}
                                  className="w-16 rounded border border-card-border px-2 py-1.5 text-sm font-mono text-right"
                                />
                              </div>
                            </div>
                            <input
                              type="text"
                              value={editComment}
                              onChange={(e) => setEditComment(e.target.value)}
                              placeholder="Reason for change (optional)"
                              className="w-full rounded border border-card-border px-2 py-1.5 text-xs"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleApprove(s)}
                                disabled={saving}
                                className="flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-green-700 disabled:opacity-50"
                              >
                                <Check className="h-3 w-3" /> Approve
                              </button>
                              <button
                                onClick={() => handleSkip(s)}
                                disabled={saving}
                                className="flex items-center gap-1 rounded bg-gray-400 px-3 py-1.5 text-xs text-white font-medium hover:bg-gray-500 disabled:opacity-50"
                              >
                                <X className="h-3 w-3" /> Skip
                              </button>
                              <button
                                onClick={() => { setEditingId(null); setEditComment(""); setEditPrice(""); }}
                                className="text-xs text-muted hover:text-foreground px-2"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(s.id); setEditPrice(s.suggested_price?.toFixed(2) || ""); }}
                            className="flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 ml-auto"
                          >
                            <DollarSign className="h-3 w-3" /> Review & Bid
                          </button>
                        )}
                      </>
                    )}

                    {!s.is_sourceable && !s.bid_status && (
                      <span className="text-xs text-muted">Not sourceable</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted">
            <p className="text-lg font-medium">
              {filter === "sourceable" ? "No sourceable solicitations" :
               filter === "quoted" ? "No quoted bids yet" :
               filter === "submitted" ? "No submitted bids yet" :
               "No solicitations found"}
            </p>
            <p className="text-sm mt-1">
              {filter === "sourceable"
                ? 'Click "Scrape Now" to pull solicitations, then "Match NSNs" to find sourceable items'
                : 'Review sourceable items and approve bids to see them here'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
