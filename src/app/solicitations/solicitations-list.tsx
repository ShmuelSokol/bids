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
  has_history: boolean;
  last_award_price: number | null;
  avg_award_price: number | null;
  award_count: number;
  suggested_price: number | null;
  decision_status: string | null;
  final_price: number | null;
  comment: string | null;
}

export function SolicitationsList({
  initialData,
}: {
  initialData: Solicitation[];
}) {
  const [solicitations, setSolicitations] = useState(initialData);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<string | null>(null);
  const [filter, setFilter] = useState("all"); // all, unbid, with_history
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editComment, setEditComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleScrapeNow() {
    setScraping(true);
    setScrapeResult(null);
    try {
      const res = await fetch("/api/dibbs/scrape-now", { method: "POST" });
      const data = await res.json();
      setScrapeResult(
        `Scraped ${data.count} solicitations from ${data.fscs_scraped} FSCs in ${data.elapsed_seconds}s`
      );
      // Refresh the page to load new data
      window.location.reload();
    } catch {
      setScrapeResult("Scrape failed — check connection");
    } finally {
      setScraping(false);
    }
  }

  async function handleBidDecision(
    sol: Solicitation,
    status: "approved" | "skipped"
  ) {
    setSaving(true);
    const price =
      status === "approved"
        ? parseFloat(editPrice) || sol.suggested_price
        : null;

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
          comment: editComment || null,
          status,
        }),
      });

      // Update local state
      setSolicitations((prev) =>
        prev.map((s) =>
          s.id === sol.id
            ? {
                ...s,
                decision_status: status,
                final_price: price,
                comment: editComment || null,
              }
            : s
        )
      );
      setEditingId(null);
      setEditPrice("");
      setEditComment("");
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  }

  const filtered = solicitations.filter((s) => {
    if (filter === "unbid") return !s.decision_status;
    if (filter === "with_history") return s.has_history && !s.decision_status;
    return true;
  });

  return (
    <>
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === "all" ? "bg-accent text-white" : "bg-card-bg border border-card-border"}`}
          >
            All ({solicitations.length})
          </button>
          <button
            onClick={() => setFilter("unbid")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === "unbid" ? "bg-accent text-white" : "bg-card-bg border border-card-border"}`}
          >
            Pending ({solicitations.filter((s) => !s.decision_status).length})
          </button>
          <button
            onClick={() => setFilter("with_history")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === "with_history" ? "bg-accent text-white" : "bg-card-bg border border-card-border"}`}
          >
            Has Pricing History (
            {
              solicitations.filter(
                (s) => s.has_history && !s.decision_status
              ).length
            }
            )
          </button>
        </div>

        <button
          onClick={handleScrapeNow}
          disabled={scraping}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {scraping ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {scraping ? "Scraping DIBBS..." : "Scrape Now"}
        </button>
      </div>

      {scrapeResult && (
        <div className="mb-4 rounded-lg bg-blue-50 text-blue-700 px-4 py-2 text-sm">
          {scrapeResult}
        </div>
      )}

      {/* Solicitation List */}
      <div className="space-y-2">
        {filtered.map((s) => {
          const isEditing = editingId === s.id;
          const margin =
            s.suggested_price && s.last_award_price
              ? (
                  ((s.suggested_price - (s.last_award_price * 0.6)) /
                    s.suggested_price) *
                  100
                ).toFixed(0)
              : null;

          return (
            <div
              key={s.id}
              className={`rounded-xl border bg-card-bg shadow-sm overflow-hidden ${
                s.decision_status === "approved"
                  ? "border-green-300 bg-green-50/30"
                  : s.decision_status === "skipped"
                    ? "border-gray-300 opacity-60"
                    : s.has_history
                      ? "border-accent/30"
                      : "border-card-border"
              }`}
            >
              <div className="px-6 py-4">
                <div className="flex items-start justify-between">
                  {/* Left: Item Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {s.decision_status && (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.decision_status === "approved"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {s.decision_status.toUpperCase()}
                        </span>
                      )}
                      {s.has_history && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700">
                          <TrendingUp className="h-3 w-3" />
                          {s.award_count} prior awards
                        </span>
                      )}
                      <span className="text-xs text-muted">
                        {s.set_aside !== "None" ? s.set_aside : ""}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold truncate">
                      {s.nomenclature || "Unknown Item"}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted flex-wrap">
                      <span className="font-mono text-accent">{s.nsn}</span>
                      <span className="font-mono">
                        {s.solicitation_number}
                      </span>
                      <span>Qty: {s.quantity}</span>
                      <span>Due: {s.return_by_date}</span>
                      <span>Posted: {s.issue_date}</span>
                    </div>

                    {/* Comment display */}
                    {s.comment && (
                      <div className="mt-2 text-xs bg-yellow-50 text-yellow-800 px-2 py-1 rounded inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {s.comment}
                      </div>
                    )}
                  </div>

                  {/* Right: Pricing + Actions */}
                  <div className="text-right ml-4 min-w-[280px]">
                    {s.has_history ? (
                      <div className="flex items-center justify-end gap-4 text-xs text-muted mb-2">
                        <div>
                          Last award:{" "}
                          <span className="font-mono font-medium text-foreground">
                            ${s.last_award_price?.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          Avg:{" "}
                          <span className="font-mono font-medium text-foreground">
                            ${s.avg_award_price?.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted mb-2">
                        No pricing history
                      </div>
                    )}

                    {!s.decision_status && (
                      <>
                        {s.suggested_price && (
                          <div className="flex items-center justify-end gap-2 mb-2">
                            <div>
                              <div className="text-xs text-muted">
                                Suggested (+2%)
                              </div>
                              <div className="text-lg font-bold font-mono text-accent">
                                ${s.suggested_price.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        )}

                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                placeholder={
                                  s.suggested_price?.toFixed(2) || "Price"
                                }
                                step="0.01"
                                className="w-28 rounded border border-card-border px-2 py-1.5 text-sm font-mono text-right"
                              />
                              <button
                                onClick={() =>
                                  handleBidDecision(s, "approved")
                                }
                                disabled={saving}
                                className="flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-green-700"
                              >
                                <Check className="h-3 w-3" />
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  handleBidDecision(s, "skipped")
                                }
                                disabled={saving}
                                className="flex items-center gap-1 rounded bg-gray-400 px-3 py-1.5 text-xs text-white font-medium hover:bg-gray-500"
                              >
                                <X className="h-3 w-3" />
                                Skip
                              </button>
                            </div>
                            <input
                              type="text"
                              value={editComment}
                              onChange={(e) => setEditComment(e.target.value)}
                              placeholder="Reason for price change (optional)"
                              className="w-full rounded border border-card-border px-2 py-1.5 text-xs"
                            />
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditComment("");
                                setEditPrice("");
                              }}
                              className="text-xs text-muted hover:text-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingId(s.id);
                              setEditPrice(
                                s.suggested_price?.toFixed(2) || ""
                              );
                            }}
                            className="flex items-center gap-1 rounded-lg border border-card-border px-3 py-1.5 text-xs font-medium hover:bg-gray-50 ml-auto"
                          >
                            <DollarSign className="h-3 w-3" />
                            Review & Bid
                          </button>
                        )}
                      </>
                    )}

                    {s.decision_status === "approved" && s.final_price && (
                      <div className="text-sm font-mono font-bold text-green-600">
                        Bid: ${s.final_price.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted">
            <p className="text-lg font-medium">No solicitations found</p>
            <p className="text-sm mt-1">
              Click "Scrape Now" to pull today's solicitations from DIBBS
            </p>
          </div>
        )}
      </div>
    </>
  );
}
