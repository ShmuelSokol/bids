"use client";

import { useState, useMemo, useEffect } from "react";
import {
  RefreshCw,
  DollarSign,
  MessageSquare,
  Check,
  X,
  Loader2,
  Send,
  Zap,
  Package,
  ArrowUpDown,
  ChevronLeft,
  History,
} from "lucide-react";
import Link from "next/link";
import { trackAction } from "@/components/activity-tracker";
import { calculateBidScore, type BidScore } from "@/lib/bid-score";
import { formatDateShort, formatDateTime, formatTime } from "@/lib/dates";
import { isOpenSolicitation } from "@/lib/solicitation-filters";
import { NsnHistoryDetail } from "@/components/nsn-history-detail";
import { LlPidPopover } from "@/components/ll-pid-popover";
import { ResearchDrawer } from "@/components/research-drawer";
import { SourceTip } from "@/components/source-tip";
import { SourcingModal } from "./sourcing-modal";
import { fscLabel } from "@/lib/fsc-names";
import { FscFilter } from "@/components/fsc-filter";

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
  procurement_type: string | null;
  is_sourceable: boolean;
  source: string | null;
  source_item: string | null;
  suggested_price: number | null;
  our_cost: number | null;
  margin_pct: number | null;
  cost_source: string | null;
  price_source: string | null;
  channel: string | null;
  fob: string | null;
  est_shipping: number | null;
  potential_value: number | null;
  already_bid: boolean;
  last_bid_price: number | null;
  last_bid_date: string | null;
  est_value: number | null;
  last_award_price: number | null;
  data_source: string | null;
  competitor_cage: string | null;
  last_award_winner: string | null;
  award_count: number | null;
  bid_status: string | null;
  final_price: number | null;
  bid_comment: string | null;
  decided_by: string | null;
  file_reference: string | null;
  file_reference_date: string | null;
  internal_edi_reference: string | null;
  ship_to_locations: { clin: string | null; destination: string | null; qty: number; delivery_date: string | null }[] | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  priority_code: string | null;
  posting_type: string | null;
  required_delivery_days: number | null;
  lamlinks_estimated_value: number | null;
}

interface AwardHistory {
  fsc: string;
  niin: string;
  unit_price: number;
  quantity: number;
  description: string;
  award_date: string;
  contract_number: string;
  cage: string;
}

interface AbeBid {
  nsn: string;
  bid_price: number;
  lead_time_days: number;
  bid_qty: number;
  bid_date: string;
  fob: string;
}

interface Counts {
  total: number;
  sourceable: number;
  quoted: number;
  submitted: number;
  skipped: number;
}

type SortField = "value" | "margin" | "due" | "posted" | "price" | "quantity" | "score";

export function SolicitationsList({
  initialData,
  counts: _initialCounts,
  awardHistory,
  abeBidHistory,
  initialFilter,
  initialSort,
  lastSync,
}: {
  initialData: Solicitation[];
  counts: Counts;
  awardHistory: AwardHistory[];
  abeBidHistory: AbeBid[];
  lastSync: { action: string; details: any; created_at: string } | null;
  initialFilter?: string;
  initialSort?: string;
}) {
  const [solicitations, setSolicitations] = useState(initialData);
  const [filter, setFilterRaw] = useState<string>(initialFilter || "sourceable");
  // Wrap setFilter so switching filters always resets the render limit —
  // otherwise clicking 'non-sourced' from 'sourceable' would inherit the
  // previous Show-all expansion and re-render 5K rows.
  const setFilter = (v: string | ((prev: string) => string)) => {
    setVisibleLimitReset();
    setFilterRaw(v as any);
  };
  const setVisibleLimitReset = () => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
    setVisibleLimit(200);
  };
  const [researchNsn, setResearchNsn] = useState<string | null>(null);
  const [researchSolNo, setResearchSolNo] = useState<string | null>(null);

  // Render-limit guard: large filters (non-sourceable especially) can exceed
  // 5K rows × ~400 lines of JSX each → browser stalls. Show first N, let
  // user "Show more" incrementally. Reset on filter change below.
  const [visibleLimit, setVisibleLimit] = useState(200);

  // (reviewModalId removed — modal now triggered directly by detailId,
  // which is already set when Abe clicks a row. One state, same modal
  // experience on sourceable + non-sourceable.)
  const [sortField, setSortField] = useState<SortField>((initialSort as SortField) || "score");
  const [sortAsc, setSortAsc] = useState(false);
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
  // Which solicitation is open in the pre-award sourcing modal.
  const [sourcingId, setSourcingId] = useState<number | null>(null);
  // File-reference filter — when set, the whole page scopes to this batch.
  // Works alongside the match-confidence (ax_matched / etc.) + status
  // filters; all filter predicates AND together.
  const [fileRefFilter, setFileRefFilter] = useState<string | null>(null);
  // FSC state already declared below — the existing dropdown uses "all" as
  // the no-filter sentinel. The new chip strip at the top reuses that
  // single source of truth so both UIs stay in sync.
  // Whether the File References grid is expanded. Collapsed by default once
  // Abe picks a batch — keeps the page tidy while he works through 642 lines.
  const [fileRefsExpanded, setFileRefsExpanded] = useState(true);
  const [expandedNsn, setExpandedNsn] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [fscFilter, setFscFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [fobFilter, setFobFilter] = useState<string>("all");
  const [marginFilter, setMarginFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [qtyFilter, setQtyFilter] = useState<string>("all");
  const [valueFilter, setValueFilter] = useState<string>("all");
  // Default to DIBBS-prefixed solicitations only. Per Abe 2026-04-16:
  // LamLinks pulls from multiple procurement systems. SPE* = DIBBS
  // (bidable through LamLinks). W* = Army DoD (not in DIBBS, can't
  // bid through this path). Without this filter Abe sees noise.
  // Toggle exposed in filter bar to show everything.
  const [dibbsOnly, setDibbsOnly] = useState<boolean>(true);
  const [valueMin, setValueMin] = useState<string>(""); // custom range, blank = no limit
  const [valueMax, setValueMax] = useState<string>("");
  const [selectedSourceable, setSelectedSourceable] = useState<Set<number>>(new Set());
  const [bulkQuoting, setBulkQuoting] = useState(false);
  const [supplierSearchId, setSupplierSearchId] = useState<number | null>(null);
  const [supplierResults, setSupplierResults] = useState<any>(null);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  // Lazy-load award + bid history per NSN (instead of loading 74K+10K upfront)
  const [historyCache, setHistoryCache] = useState<Map<string, { awards: AwardHistory[]; bids: AbeBid[]; itemSpec?: any; matches?: any[] }>>(new Map());
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);

  // Also keep any server-provided data as fallback
  const historyByNsn = useMemo(() => {
    const map = new Map<string, AwardHistory[]>();
    for (const a of awardHistory) {
      const nsn = `${a.fsc}-${a.niin}`;
      if (!map.has(nsn)) map.set(nsn, []);
      map.get(nsn)!.push(a);
    }
    return map;
  }, [awardHistory]);

  const abeBidsByNsn = useMemo(() => {
    const map = new Map<string, AbeBid[]>();
    for (const b of abeBidHistory) {
      if (!map.has(b.nsn)) map.set(b.nsn, []);
      map.get(b.nsn)!.push(b);
    }
    return map;
  }, [abeBidHistory]);

  // Fetch award + bid history for an NSN. Lazy-loaded on row click,
  // memoized in historyCache so reopening the same row is instant.
  // Logs failures to console so empty results aren't ambiguous.
  async function loadNsnHistory(nsn: string) {
    if (historyCache.has(nsn)) return;
    setLoadingHistory(nsn);
    try {
      const res = await fetch(`/api/awards/search?nsn=${encodeURIComponent(nsn)}`);
      if (!res.ok) {
        console.warn(`History fetch failed for ${nsn}: HTTP ${res.status}`);
        // Cache an empty result so we don't refetch forever
        setHistoryCache(prev => {
          const next = new Map(prev);
          next.set(nsn, { awards: [], bids: [], itemSpec: null, matches: [] });
          return next;
        });
        return;
      }
      const data = await res.json();
      setHistoryCache(prev => {
        const next = new Map(prev);
        next.set(nsn, {
          awards: data.awards || [],
          bids: data.bids || [],
          itemSpec: data.itemSpec || null,
          matches: data.matches || [],
          axVendorParts: data.ax?.vendor_parts || [],
        } as any);
        return next;
      });
    } catch (err) {
      console.warn(`History fetch error for ${nsn}:`, err);
    } finally {
      setLoadingHistory(null);
    }
  }

  // Compute counts client-side — uses the shared isOpenSolicitation() so
  // dashboard, server-side counts, and this client all agree on dates.
  const counts = useMemo(() => {
    let sourceable = 0, axMatched = 0, potentialMatched = 0, nonSourced = 0;
    let quoted = 0, submitted = 0, skipped = 0, alreadyBid = 0, llActive = 0, dibbsOnly = 0;
    for (const s of solicitations) {
      // Match-confidence counts rescope to the active file reference + FSC
      // so the big cards show "in THIS batch + THIS category, X are AX-matched."
      if (fileRefFilter && s.file_reference !== fileRefFilter) continue;
      if (fscFilter !== "all" && s.fsc !== fscFilter) continue;
      const open = isOpenSolicitation(s.return_by_date);
      if (s.data_source === "lamlinks" && open) llActive++;
      if (s.data_source !== "lamlinks" && open) dibbsOnly++;
      if (s.bid_status === "quoted") { quoted++; continue; }
      if (s.bid_status === "submitted") { submitted++; continue; }
      if (s.bid_status === "skipped") { skipped++; continue; }
      if (s.already_bid) { alreadyBid++; continue; }
      if (!open) continue;
      // Three-way match-confidence split:
      //   ax_matched     — source=='ax'       (ProductBarcodesV3, authoritative)
      //   potential      — sourceable via anything else (Master DB or P/N cross-ref)
      //   non_sourced    — not sourceable and not yet done business with this NSN
      if (s.is_sourceable && s.source === "ax") { axMatched++; sourceable++; continue; }
      if (s.is_sourceable) { potentialMatched++; sourceable++; continue; }
      nonSourced++;
    }
    return { total: solicitations.length, sourceable, axMatched, potentialMatched, nonSourced, quoted, submitted, skipped, alreadyBid, llActive, dibbsOnly };
  }, [solicitations, fileRefFilter, fscFilter]);

  // FSC rollup — one entry per FSC in the current file_reference scope.
  // Excludes closed / quoted / submitted / already-bid items so the
  // counts reflect "what's left to decide in this category". Sorted by
  // count DESC so Abe sees his biggest remaining categories first.
  const fscRollup = useMemo(() => {
    const byFsc = new Map<string, { fsc: string; total: number; ax: number; potential: number; nonsourced: number }>();
    for (const s of solicitations) {
      // Rescope to the active file_reference so FSCs shown are the ones
      // present in Abe's current batch. Do NOT rescope to fscFilter itself
      // (otherwise picking 6515 would leave only 6515 in the chip strip).
      if (fileRefFilter && s.file_reference !== fileRefFilter) continue;
      if (!isOpenSolicitation(s.return_by_date)) continue;
      if (s.bid_status || s.already_bid) continue;
      if (!s.fsc) continue;
      let b = byFsc.get(s.fsc);
      if (!b) { b = { fsc: s.fsc, total: 0, ax: 0, potential: 0, nonsourced: 0 }; byFsc.set(s.fsc, b); }
      b.total++;
      if (s.is_sourceable && s.source === "ax") b.ax++;
      else if (s.is_sourceable) b.potential++;
      else b.nonsourced++;
    }
    return [...byFsc.values()].sort((a, b) => b.total - a.total);
  }, [solicitations, fileRefFilter]);

  // File-reference rollup for the grid: one row per (file_reference, date)
  // with item totals and the sourcing breakdown within that batch. Sorted
  // by refdte DESC so today's batches bubble to the top.
  const fileReferences = useMemo(() => {
    type Bucket = {
      file_reference: string;
      file_reference_date: string | null;
      internal_edi_reference: string | null;
      items: number;
      ax: number;
      potential: number;
      nonsourced: number;
      quoted: number;
      submitted: number;
    };
    const byRef = new Map<string, Bucket>();
    for (const s of solicitations) {
      if (!s.file_reference) continue;
      let b = byRef.get(s.file_reference);
      if (!b) {
        b = {
          file_reference: s.file_reference,
          file_reference_date: s.file_reference_date,
          internal_edi_reference: s.internal_edi_reference,
          items: 0, ax: 0, potential: 0, nonsourced: 0, quoted: 0, submitted: 0,
        };
        byRef.set(s.file_reference, b);
      }
      b.items++;
      if (s.bid_status === "quoted") b.quoted++;
      else if (s.bid_status === "submitted") b.submitted++;
      if (s.is_sourceable && s.source === "ax") b.ax++;
      else if (s.is_sourceable) b.potential++;
      else b.nonsourced++;
    }
    return [...byRef.values()].sort((a, b) => {
      const ad = a.file_reference_date ? new Date(a.file_reference_date).getTime() : 0;
      const bd = b.file_reference_date ? new Date(b.file_reference_date).getTime() : 0;
      if (bd !== ad) return bd - ad;
      return b.items - a.items;
    });
  }, [solicitations]);

  async function handleFindSuppliers(sol: Solicitation) {
    if (supplierSearchId === sol.id) { setSupplierSearchId(null); return; }
    setSupplierSearchId(sol.id);
    setLoadingSuppliers(true);
    setSupplierResults(null);
    try {
      const res = await fetch(`/api/solicitations/find-suppliers?nsn=${encodeURIComponent(sol.nsn)}&description=${encodeURIComponent(sol.nomenclature || "")}`);
      const data = await res.json();
      setSupplierResults(data);
    } catch {
      setSupplierResults(null);
    } finally {
      setLoadingSuppliers(false);
    }
  }

  // Check if a sync is already running (survives page refresh)
  useEffect(() => {
    let pollId: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function checkSyncStatus() {
      try {
        const res = await fetch("/api/dibbs/sync-status");
        const data = await res.json();
        if (data.running && !cancelled) {
          setScraping(true);
          setMessage(`Sync in progress (started ${formatTime(data.started_at)})... Waiting for completion.`);
          pollId = setInterval(async () => {
            try {
              const r = await fetch("/api/dibbs/sync-status");
              const d = await r.json();
              if (!d.running) {
                if (pollId) clearInterval(pollId);
                if (!cancelled) {
                  setScraping(false);
                  setMessage("Sync complete! Refreshing...");
                  setTimeout(() => window.location.reload(), 1500);
                }
              }
            } catch {}
          }, 5000);
        }
      } catch {}
    }
    checkSyncStatus();

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
    };
  }, []);

  async function handleScrapeNow() {
    setScraping(true);
    setMessage("Step 1/3: Scraping DIBBS for new solicitations...");
    trackAction("sync", "scrape_started");
    try {
      // Mark sync as started (persists across refresh)
      await fetch("/api/dibbs/sync-status", {
        method: "POST",
        body: JSON.stringify({ action: "start" }),
        headers: { "Content-Type": "application/json" },
      });

      // Scrape in batches — API does 30 FSCs at a time, auto-continues.
      // Surface real HTTP failures so a silent 500 doesn't look like success.
      let totalScraped = 0;
      let batchNum = 0;
      let remaining = 999;

      while (remaining > 0 && batchNum < 10) {
        batchNum++;
        setMessage(`Step 1/3: Scraping DIBBS expansion FSCs (batch ${batchNum})...`);
        const scrapeRes = await fetch("/api/dibbs/scrape-now", { method: "POST" });
        if (!scrapeRes.ok) {
          const errText = await scrapeRes.text().catch(() => "");
          throw new Error(`Scrape HTTP ${scrapeRes.status}: ${errText.slice(0, 200)}`);
        }
        const scrapeData = await scrapeRes.json();
        totalScraped += scrapeData.count || 0;
        remaining = scrapeData.fscs_remaining || 0;

        if (remaining > 0) {
          setMessage(`Step 1/3: Found ${totalScraped} so far, ${remaining} FSCs remaining...`);
        }
      }

      setMessage(`Step 2/3: Found ${totalScraped} from ${batchNum} batches. Matching NSNs + pricing...`);
      setEnriching(true);
      const enrichRes = await fetch("/api/dibbs/enrich", { method: "POST" });
      if (!enrichRes.ok) {
        const errText = await enrichRes.text().catch(() => "");
        throw new Error(`Enrich HTTP ${enrichRes.status}: ${errText.slice(0, 200)}`);
      }
      const enrichData = await enrichRes.json();
      setEnriching(false);

      // Mark sync as done
      await fetch("/api/dibbs/sync-status", {
        method: "POST",
        body: JSON.stringify({ action: "done" }),
        headers: { "Content-Type": "application/json" },
      });

      const parts = [`${totalScraped} scraped from ${batchNum} batches`];
      if (enrichData.sourceable) parts.push(`${enrichData.sourceable} sourceable`);
      if (enrichData.with_cost_data) parts.push(`${enrichData.with_cost_data} with costs`);
      if (enrichData.already_bid) parts.push(`${enrichData.already_bid} already bid`);
      if (enrichData.warnings?.length) parts.push(`WARN: ${enrichData.warnings.join(", ")}`);

      setMessage(`Step 3/3: Sync complete! ${parts.join(" · ")}. Refreshing...`);
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      console.error("Sync failed:", err);
      await fetch("/api/dibbs/sync-status", {
        method: "POST",
        body: JSON.stringify({ action: "done" }),
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
      setMessage(`Sync failed: ${err?.message || "unknown error"}`);
    } finally {
      setScraping(false);
      setEnriching(false);
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    try {
      const res = await fetch("/api/dibbs/enrich", { method: "POST" });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = await res.json();
      const parts = [`${data.sourceable || 0} sourceable`];
      if (data.with_cost_data) parts.push(`${data.with_cost_data} with cost data`);
      if (data.warnings?.length) parts.push(`WARN: ${data.warnings.join(", ")}`);
      setMessage(`Found ${parts.join(" · ")}`);
      window.location.reload();
    } catch (err: any) {
      console.error("Enrichment failed:", err);
      setMessage(`Enrichment failed: ${err?.message || "unknown error"}`);
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
        }),
      });
      setSolicitations((prev) =>
        prev.map((s) =>
          s.id === sol.id
            ? { ...s, bid_status: "quoted", final_price: price, bid_comment: editComment || null }
            : s
        )
      );
      advanceDetail(sol.id);
      setEditingId(null);
      setEditPrice("");
      setEditDays("45");
      setEditComment("");
    } catch {} finally { setSaving(false); }
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
        prev.map((s) => (s.id === sol.id ? { ...s, bid_status: "skipped" } : s))
      );
      advanceDetail(sol.id);
      setEditingId(null);
      setEditComment("");
    } catch {} finally { setSaving(false); }
  }

  async function handleQuoteSelectedAtSuggested() {
    if (selectedSourceable.size === 0) return;
    setBulkQuoting(true);
    try {
      const toQuote = solicitations.filter(
        (s) => selectedSourceable.has(s.id) && s.is_sourceable && !s.bid_status && !s.already_bid
      );
      if (toQuote.length === 0) {
        setMessage("Nothing eligible to quote in the current selection");
        return;
      }
      const pairs = toQuote.map((s) => ({
        solicitation_number: s.solicitation_number,
        nsn: s.nsn,
        // No final_price → server uses each row's suggested_price
      }));
      const res = await fetch("/api/bids/quote-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairs }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const result = await res.json();
      const skippedKeys = new Set(
        (result.skipped || []).map((s: any) => `${s.solicitation_number}__${s.nsn}`)
      );
      // Mark locally
      setSolicitations((prev) =>
        prev.map((s) => {
          if (!selectedSourceable.has(s.id)) return s;
          const key = `${s.solicitation_number}__${s.nsn}`;
          if (skippedKeys.has(key)) return s;
          return { ...s, bid_status: "quoted", final_price: s.suggested_price };
        })
      );
      setSelectedSourceable(new Set());
      const parts = [`${result.quoted_count} quoted at suggested price`];
      if (result.skipped_count > 0) parts.push(`${result.skipped_count} skipped`);
      setMessage(parts.join(" · "));
    } catch (err: any) {
      console.error("Quote batch failed:", err);
      setMessage(`Quote failed: ${err?.message || "unknown error"}`);
    } finally {
      setBulkQuoting(false);
    }
  }

  async function handleSubmitAll() {
    if (selectedQuoted.size === 0) return;
    setSubmitting(true);
    try {
      const toSubmit = solicitations.filter(
        (s) => s.bid_status === "quoted" && selectedQuoted.has(s.id)
      );
      const pairs = toSubmit.map((s) => ({
        solicitation_number: s.solicitation_number,
        nsn: s.nsn,
      }));
      const res = await fetch("/api/bids/submit-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairs }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const result = await res.json();
      const submittedKeys = new Set(
        (result.skipped || []).map((s: any) => `${s.solicitation_number}__${s.nsn}`)
      );
      // Mark locally only rows that weren't skipped
      setSolicitations((prev) =>
        prev.map((s) => {
          if (!selectedQuoted.has(s.id) || s.bid_status !== "quoted") return s;
          const key = `${s.solicitation_number}__${s.nsn}`;
          if (submittedKeys.has(key)) return s; // skipped by server
          return { ...s, bid_status: "submitted" };
        })
      );
      setSelectedQuoted(new Set());
      const parts = [`${result.updated_count} bids submitted`];
      if (result.skipped_count > 0) parts.push(`${result.skipped_count} skipped`);
      setMessage(parts.join(" · "));
    } catch (err: any) {
      console.error("Submit batch failed:", err);
      setMessage(`Submit failed: ${err?.message || "unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnquoteSelected() {
    if (selectedQuoted.size === 0) return;
    const toUnquote = solicitations.filter(
      (s) => s.bid_status === "quoted" && selectedQuoted.has(s.id)
    );
    if (!confirm(`Undo ${toUnquote.length} quoted bids? They'll go back to Sourceable.`)) return;
    setSubmitting(true);
    try {
      const items = toUnquote.map((s) => ({ solicitation_number: s.solicitation_number, nsn: s.nsn }));
      const res = await fetch("/api/bids/decide", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setSolicitations((prev) =>
        prev.map((s) => {
          if (!selectedQuoted.has(s.id) || s.bid_status !== "quoted") return s;
          return { ...s, bid_status: null };
        })
      );
      setSelectedQuoted(new Set());
      setMessage(`${result.deleted} bids unquoted — moved back to Sourceable`);
    } catch (err: any) {
      setMessage(`Unquote failed: ${err?.message || "unknown"}`);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  // True for any filter that shows eligible-to-quote rows — the bulk-select
  // checkbox column, Quote-batch actions, and checkbox in each row all share
  // this gate so operator can select-all and quote from any of the three
  // match-confidence buckets.
  const isQuotableFilter = filter === "sourceable" || filter === "ax_matched" || filter === "potential_matched";

  const filtered = useMemo(() => {
    let items = solicitations.filter((s) => {
      // File-reference filter applies to every other filter predicate —
      // when Abe is working batch 8916-156-1626, everything else scopes to
      // it automatically (including AX/Potential/Non-Sourced counts).
      if (fileRefFilter && s.file_reference !== fileRefFilter) return false;

      // Single source of truth for "is this sol still open" — same helper
      // the dashboard and server-side counts use. Don't re-implement.
      const isOpen = isOpenSolicitation(s.return_by_date);

      if (filter === "sourceable") return s.is_sourceable && !s.bid_status && !s.already_bid && isOpen;
      if (filter === "new_only") return s.is_sourceable && !s.bid_status && !s.already_bid && isOpen;
      if (filter === "ax_matched") return s.is_sourceable && s.source === "ax" && !s.bid_status && !s.already_bid && isOpen;
      if (filter === "potential_matched") return s.is_sourceable && s.source !== "ax" && !s.bid_status && !s.already_bid && isOpen;
      if (filter === "non_sourced") return !s.is_sourceable && !s.bid_status && !s.already_bid && isOpen;
      if (filter === "already_bid") return s.already_bid;
      if (filter === "quoted") return s.bid_status === "quoted";
      if (filter === "submitted") return s.bid_status === "submitted";
      if (filter === "skipped") return s.bid_status === "skipped";
      if (filter === "all_unsourced") return !s.is_sourceable && isOpen;
      if (filter === "ll_active") return s.data_source === "lamlinks" && isOpen;
      if (filter === "dibbs_only") return s.data_source !== "lamlinks" && isOpen;
      if (filter === "expired") return !isOpen;
      return true;
    });

    // Date filter — uses normalized ISO dates from return_by_date_iso / issue_date_iso
    if (dateFilter !== "all") {
      const now = new Date();
      const todayIso = now.toISOString().split("T")[0];
      const yesterdayIso = new Date(now.getTime() - 86400000).toISOString().split("T")[0];
      const weekAgoIso = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
      const threeDaysIso = new Date(now.getTime() + 3 * 86400000).toISOString().split("T")[0];
      const weekFromNowIso = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];

      function toIso(d: string | null): string | null {
        if (!d) return null;
        const parts = d.split("-");
        if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
        return d;
      }

      items = items.filter((s) => {
        const posted = (s as any).return_by_date_iso || toIso(s.issue_date);
        const due = (s as any).return_by_date_iso || toIso(s.return_by_date);
        if (dateFilter === "posted_today") return posted === todayIso;
        if (dateFilter === "posted_2d") return posted && posted >= yesterdayIso;
        if (dateFilter === "posted_week") return posted && posted >= weekAgoIso;
        if (dateFilter === "due_soon") return due && due >= todayIso && due <= threeDaysIso;
        if (dateFilter === "due_week") return due && due >= todayIso && due <= weekFromNowIso;
        return true;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((s) =>
        s.nsn?.toLowerCase().includes(q) ||
        s.nomenclature?.toLowerCase().includes(q) ||
        s.solicitation_number?.toLowerCase().includes(q) ||
        s.fsc?.includes(q)
      );
    }

    // Column filters
    if (fscFilter !== "all") items = items.filter((s) => s.fsc === fscFilter);
    if (fobFilter !== "all") items = items.filter((s) => fobFilter === "D" ? s.fob === "D" : fobFilter === "O" ? s.fob === "O" : !s.fob);
    if (sourceFilter !== "all") items = items.filter((s) => s.source === sourceFilter);
    // DIBBS-only filter: solicitation numbers starting with SPE are
    // the ones we can actually quote through LamLinks. Other prefixes
    // (W* etc) come through the LamLinks feed but are Army/DoD
    // non-DIBBS solicitations we can't act on from DIBS.
    if (dibbsOnly) {
      items = items.filter((s) => s.solicitation_number?.trim().toUpperCase().startsWith("SPE"));
    }
    if (marginFilter === "high") items = items.filter((s) => (s.margin_pct || 0) >= 20);
    else if (marginFilter === "mid") items = items.filter((s) => (s.margin_pct || 0) >= 10 && (s.margin_pct || 0) < 20);
    else if (marginFilter === "low") items = items.filter((s) => (s.margin_pct || 0) > 0 && (s.margin_pct || 0) < 10);
    if (qtyFilter === "1") items = items.filter((s) => (s.quantity || 0) === 1);
    else if (qtyFilter === "2-10") items = items.filter((s) => (s.quantity || 0) >= 2 && (s.quantity || 0) <= 10);
    else if (qtyFilter === "11-100") items = items.filter((s) => (s.quantity || 0) >= 11 && (s.quantity || 0) <= 100);
    else if (qtyFilter === "100+") items = items.filter((s) => (s.quantity || 0) > 100);
    if (valueFilter === "5k+") items = items.filter((s) => (s.est_value || (s.suggested_price || 0) * (s.quantity || 1)) >= 5000);
    else if (valueFilter === "1k+") items = items.filter((s) => (s.est_value || (s.suggested_price || 0) * (s.quantity || 1)) >= 1000);
    else if (valueFilter === "500+") items = items.filter((s) => (s.est_value || (s.suggested_price || 0) * (s.quantity || 1)) >= 500);
    else if (valueFilter === "<500") items = items.filter((s) => (s.est_value || (s.suggested_price || 0) * (s.quantity || 1)) < 500);
    // Custom range overlays the preset (both apply)
    const minVal = parseFloat(valueMin);
    const maxVal = parseFloat(valueMax);
    if (!isNaN(minVal) && minVal > 0) {
      items = items.filter((s) => (s.est_value || (s.suggested_price || 0) * (s.quantity || 1)) >= minVal);
    }
    if (!isNaN(maxVal) && maxVal > 0) {
      items = items.filter((s) => (s.est_value || (s.suggested_price || 0) * (s.quantity || 1)) <= maxVal);
    }

    // Add potential_value + bid score
    const parseDaysUntilDue = (d: string | null) => {
      if (!d) return null;
      const parts = d.split("-");
      let dt: Date;
      if (parts.length === 3 && parts[2].length === 4) dt = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
      else dt = new Date(d);
      // Compare against today's UTC midnight (stable across server/client)
      // instead of Date.now() — Date.now() returns slightly different values
      // on server SSR vs client hydration, which would change the rendered
      // score/badge text and trip React #418 (text content mismatch).
      const todayMs = new Date(new Date().toISOString().split("T")[0]).getTime();
      return Math.ceil((dt.getTime() - todayMs) / 86400000);
    };

    // Count bids per FSC for win probability proxy
    const fscBidCounts = new Map<string, number>();
    for (const s of solicitations) {
      if (s.already_bid) fscBidCounts.set(s.fsc, (fscBidCounts.get(s.fsc) || 0) + 1);
    }

    items = items.map((s) => {
      const potVal = s.est_value || (s.suggested_price || s.final_price || 0) * (s.quantity || 1);
      const bidScore = calculateBidScore({
        suggestedPrice: s.suggested_price,
        ourCost: s.our_cost,
        marginPct: s.margin_pct,
        quantity: s.quantity || 1,
        estValue: potVal,
        isSourceable: s.is_sourceable,
        source: s.source,
        costSource: s.cost_source,
        priceSource: s.price_source,
        fscWinRate: null, // would need heatmap data
        fscBidVolume: fscBidCounts.get(s.fsc) || 0,
        alreadyBid: s.already_bid,
        awardCount: s.award_count || 0,
        daysUntilDue: parseDaysUntilDue(s.return_by_date),
        fob: s.fob,
      });
      return { ...s, _potentialValue: potVal, _bidScore: bidScore };
    });

    // Score filter (after scores computed)
    if (scoreFilter === "bid") items = items.filter((s: any) => s._bidScore?.score >= 65);
    else if (scoreFilter === "consider") items = items.filter((s: any) => { const sc = s._bidScore?.score; return sc >= 40 && sc < 65; });
    else if (scoreFilter === "skip") items = items.filter((s: any) => s._bidScore?.score < 40);

    // Sort
    const dir = sortAsc ? 1 : -1;
    items.sort((a, b) => {
      const av = a as any, bv = b as any;
      switch (sortField) {
        case "score": return ((av._bidScore?.score || 0) - (bv._bidScore?.score || 0)) * dir;
        case "value": return (av._potentialValue - bv._potentialValue) * dir;
        case "margin": return ((a.margin_pct || 0) - (b.margin_pct || 0)) * dir;
        case "due": return ((a.return_by_date || "").localeCompare(b.return_by_date || "")) * dir;
        case "posted": return ((a.issue_date || "").localeCompare(b.issue_date || "")) * dir;
        case "price": return ((a.suggested_price || 0) - (b.suggested_price || 0)) * dir;
        case "quantity": return ((a.quantity || 0) - (b.quantity || 0)) * dir;
        default: return 0;
      }
    });

    return items;
  }, [solicitations, filter, sortField, sortAsc, searchQuery, dateFilter, fscFilter, scoreFilter, fobFilter, marginFilter, sourceFilter, qtyFilter, valueFilter, valueMin, valueMax, dibbsOnly]);

  const filteredTotalValue = useMemo(() => {
    return filtered.reduce((sum, s) => sum + ((s as any)._potentialValue || s.est_value || 0), 0);
  }, [filtered]);

  // Auto-switch to "All" when search finds 0 results in current filter
  useEffect(() => {
    if (!searchQuery.trim() || filter === "all") return;
    if (filtered.length === 0) {
      // Check if there ARE results in "all"
      const q = searchQuery.toLowerCase();
      const allMatch = solicitations.some((s) =>
        s.nsn?.toLowerCase().includes(q) ||
        s.nomenclature?.toLowerCase().includes(q) ||
        s.solicitation_number?.toLowerCase().includes(q) ||
        s.fsc?.includes(q)
      );
      if (allMatch) setFilter("all");
    }
  }, [filtered.length, searchQuery, filter, solicitations]);

  // Advance detail panel to next item in filtered list
  function advanceDetail(currentId: number) {
    const idx = filtered.findIndex((s) => s.id === currentId);
    if (idx >= 0 && idx < filtered.length - 1) {
      setDetailId(filtered[idx + 1].id);
    } else {
      setDetailId(null);
    }
  }

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 font-medium ${sortField === field ? "text-accent" : "text-muted"}`}
    >
      {children}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  // Shared render helper for the full bid-detail content (header + pricing +
  // ship-to + buyer + AX vendor parts + P/N matches + history). Used both
  // for the inline expanded row and the fullscreen review modal so they
  // stay in sync with one source of truth.
  //
  // Options:
  //   hideInlineNext — when rendered inside the modal, skip the "Next →"
  //     button in the header since the modal has its own navigation.
  const renderSolDetail = (s: Solicitation, opts: { hideInlineNext?: boolean } = {}) => {
    const cached = historyCache.get(s.nsn);
    const potValue = (s as any)._potentialValue || s.est_value || (s.suggested_price || s.final_price || 0) * (s.quantity || 1);
    return (
      <div className="p-4 border-t-2 border-accent/30">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold">{s.nomenclature}</h3>
            <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
              <span className="font-mono text-accent">{s.nsn}</span>
              <span>{s.solicitation_number}</span>
              <span>Qty: {s.quantity}</span>
              <span>Due: {s.return_by_date}</span>
              {s.fob && <span>FOB: {s.fob === "D" ? "Dest" : "Origin"}</span>}
              {s.procurement_type && s.procurement_type !== "RFQ" && <span className="px-1 rounded bg-indigo-100 text-indigo-700">{s.procurement_type}</span>}
              {(() => {
                const bs = (s as any)._bidScore as BidScore | undefined;
                if (!bs) return null;
                const color = bs.recommendation === "BID" ? "bg-green-600" : bs.recommendation === "CONSIDER" ? "bg-yellow-500" : "bg-red-500";
                return (
                  <span className={`px-2 py-0.5 rounded text-white text-[10px] font-bold ${color}`} title={bs.reasons.join(" · ")}>
                    {bs.recommendation} ({bs.score}/100)
                  </span>
                );
              })()}
            </div>
            {(() => {
              const bs = (s as any)._bidScore as BidScore | undefined;
              if (!bs || !bs.reasons.length) return null;
              return (
                <div className="flex flex-wrap gap-1 mt-1">
                  {bs.reasons.map((r, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{r}</span>
                  ))}
                </div>
              );
            })()}
          </div>
          <div className="flex gap-2">
            <button onClick={(e) => { e.stopPropagation(); handleFindSuppliers(s); }}
              className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-medium">
              Find Suppliers
            </button>
            <button onClick={async (e) => {
              e.stopPropagation();
              const btn = e.currentTarget;
              btn.textContent = "Checking...";
              try {
                const res = await fetch(`/api/dibbs/check-open?sol=${encodeURIComponent(s.solicitation_number)}`);
                const data = await res.json();
                btn.textContent = data.is_open ? "Still Open" : "Closed/Not Found";
                btn.className = `text-xs px-2 py-1 rounded font-medium border ${data.is_open ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-600 border-red-200"}`;
              } catch { btn.textContent = "Check Failed"; }
            }}
              className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 font-medium">
              Check DIBBS
            </button>
            {!opts.hideInlineNext && filtered.indexOf(s) < filtered.length - 1 && (
              <button onClick={(e) => { e.stopPropagation(); setDetailId(filtered[filtered.indexOf(s) + 1].id); }}
                className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium">
                Next →
              </button>
            )}
          </div>
        </div>

        {/* Pricing + Bid Form */}
        <div className="grid md:grid-cols-3 gap-4 mb-3">
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <div className="text-[10px] text-green-700 font-medium mb-1">Suggested Bid</div>
            <div className="text-2xl font-bold font-mono text-green-700">{s.suggested_price ? `$${s.suggested_price.toFixed(2)}` : "—"}</div>
            {s.price_source && <div className="text-[10px] text-green-600 mt-1">{s.price_source}</div>}
            {s.our_cost && (
              <div className="text-xs text-green-600 mt-1">
                Cost: ${s.our_cost.toFixed(2)} · Margin: {s.margin_pct}%
                {s.est_shipping && ` · Ship: ~$${s.est_shipping}`}
              </div>
            )}
            <div className="text-xs font-medium text-green-700 mt-1">
              Potential: ${potValue > 0 ? potValue.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) : "—"}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 border border-card-border">
            <div className="text-[10px] text-muted font-medium mb-1">Your Bid</div>
            <div className="space-y-2">
              <input type="number" value={editingId === s.id ? editPrice : (s.suggested_price?.toFixed(2) || "")}
                onChange={(e) => { setEditingId(s.id); setEditPrice(e.target.value); }}
                onFocus={() => { if (editingId !== s.id) { setEditingId(s.id); setEditPrice(s.suggested_price?.toFixed(2) || ""); }}}
                step="0.01" placeholder="Price"
                className="w-full rounded border border-card-border px-3 py-2 text-sm font-mono" />
              <div className="flex gap-2">
                <input type="number" value={editingId === s.id ? editDays : "45"}
                  onChange={(e) => { setEditingId(s.id); setEditDays(e.target.value); }}
                  className="w-20 rounded border border-card-border px-2 py-1.5 text-xs font-mono" placeholder="Days" />
                <input type="text" value={editingId === s.id ? editComment : ""}
                  onChange={(e) => { setEditingId(s.id); setEditComment(e.target.value); }}
                  className="flex-1 rounded border border-card-border px-2 py-1.5 text-xs" placeholder="Reason for change (optional)" />
              </div>
              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); if (editingId !== s.id) { setEditingId(s.id); setEditPrice(s.suggested_price?.toFixed(2) || ""); } handleApprove(s); }}
                  disabled={saving} className="flex-1 flex items-center justify-center gap-1 rounded bg-green-600 px-3 py-2 text-xs text-white font-medium hover:bg-green-700 disabled:opacity-50">
                  <Check className="h-3 w-3" /> Approve &amp; Next
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleSkip(s); }}
                  disabled={saving} className="flex items-center gap-1 rounded bg-gray-300 px-3 py-2 text-xs text-gray-700 font-medium hover:bg-gray-400 disabled:opacity-50">
                  <X className="h-3 w-3" /> Skip
                </button>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <div className="text-[10px] text-blue-700 font-medium mb-1">Source Info</div>
            <div className="space-y-1 text-xs">
              <div>Data: <span className={`px-1 rounded font-medium ${s.data_source === "lamlinks" ? "bg-cyan-100 text-cyan-700" : "bg-gray-100 text-gray-600"}`}>{s.data_source === "lamlinks" ? "LamLinks Import" : "DIBBS Scrape"}</span></div>
              {s.source && <div>Matched: <span className={`px-1 rounded font-medium ${s.source === "ax" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{s.source === "ax" ? "via AX" : "via Master"}</span></div>}
              {s.cost_source && <div className="text-muted">Cost: {s.cost_source}</div>}
              {s.channel === "dibbs_only" && <div><span className="px-1 rounded bg-orange-100 text-orange-700 font-medium">DIBBS only — not in LamLinks</span></div>}
              {s.already_bid && <div className="text-purple-700 font-medium">Already bid in LamLinks @${s.last_bid_price?.toFixed(2)}</div>}
              {(s.award_count ?? 0) > 0 && (
                <div>Competitors: <span className="font-mono font-medium text-orange-700">{s.competitor_cage?.split(",").join(", ") || s.award_count}</span></div>
              )}
            </div>
          </div>
        </div>

        {/* Ship-to + buyer */}
        {((s.ship_to_locations?.length ?? 0) > 0 || s.buyer_name || s.priority_code) && (
          <div className="mb-3 rounded-lg border border-card-border bg-gray-50/50 p-3">
            <div className="grid md:grid-cols-2 gap-3">
              {(s.buyer_name || s.priority_code) && (
                <div className="text-xs">
                  <div className="text-[10px] font-bold text-muted mb-1">Buyer (LamLinks k10)</div>
                  {s.buyer_name && (
                    <div>👤 <span className="font-medium">{s.buyer_name}</span></div>
                  )}
                  {s.buyer_email && (
                    <div className="text-[11px] text-muted">
                      <a href={`mailto:${s.buyer_email}`} className="hover:underline">{s.buyer_email}</a>
                      {s.buyer_phone && <span> · {s.buyer_phone}</span>}
                    </div>
                  )}
                  {s.priority_code && (
                    <div className="text-[11px] text-muted mt-1">Priority: <span className="font-mono font-medium">{s.priority_code}</span></div>
                  )}
                  {s.required_delivery_days && (
                    <div className="text-[11px] mt-1 inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-900 px-1.5 py-0.5 font-medium">
                      📅 Buyer wants delivery in {s.required_delivery_days}d — suggested lead time will match
                    </div>
                  )}
                </div>
              )}
              {(s.ship_to_locations?.length ?? 0) > 0 && (
                <div className="text-xs">
                  <div className="text-[10px] font-bold text-muted mb-1">
                    Ship-to ({s.ship_to_locations!.length}) — LamLinks k32
                  </div>
                  <div className="rounded border border-card-border bg-white overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead className="bg-gray-50 text-muted">
                        <tr>
                          <th className="px-2 py-1 text-left">CLIN</th>
                          <th className="px-2 py-1 text-left">Destination</th>
                          <th className="px-2 py-1 text-right">Qty</th>
                          <th className="px-2 py-1 text-left">Deliver by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.ship_to_locations!.map((loc, i) => (
                          <tr key={i} className="border-t border-card-border/60">
                            <td className="px-2 py-1 font-mono">{loc.clin || "—"}</td>
                            <td className="px-2 py-1 truncate max-w-[260px]" title={loc.destination || ""}>
                              {loc.destination || "—"}
                            </td>
                            <td className="px-2 py-1 text-right font-mono">{loc.qty?.toLocaleString() || "—"}</td>
                            <td className="px-2 py-1 text-muted">{loc.delivery_date || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Item Spec + AX Vendor Parts + Part Number Matches */}
        {(() => {
          const spec = (cached as any)?.itemSpec;
          const matches = (cached as any)?.matches;
          const axVendorParts: any[] = (cached as any)?.axVendorParts || [];
          if (!spec && !matches?.length && axVendorParts.length === 0) return null;
          return (
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              {spec && (
                <div className="bg-gray-50 rounded-lg p-2 border border-card-border text-xs">
                  <div className="text-[10px] font-bold text-gray-600 mb-1">Item Details (LamLinks k08)</div>
                  {spec.item_name && <div>{spec.item_name}</div>}
                  <div className="grid grid-cols-2 gap-1 mt-1 text-[10px] text-muted">
                    {spec.part_number && <div>P/N: <span className="font-mono">{spec.part_number}</span></div>}
                    {spec.cage_code && <div>CAGE: <span className="font-mono">{spec.cage_code}</span></div>}
                    {spec.unit_price > 0 && <div>LL Price: ${spec.unit_price}</div>}
                    {spec.unit_of_issue && <div>UoI: {spec.unit_of_issue}</div>}
                  </div>
                  <div className="mt-1 text-[9px] text-muted italic">LamLinks&apos; best guess — may not match DLA&apos;s approved mfr list</div>
                </div>
              )}
              {axVendorParts.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-2 border border-blue-200 text-xs">
                  <div className="text-[10px] font-bold text-blue-700 mb-1 flex items-center gap-1">
                    AX Vendor Parts ({axVendorParts.length})
                    <span className="inline-block rounded bg-green-100 text-green-700 border border-green-200 px-1 text-[9px] font-semibold">
                      ✓ NSN-direct match
                    </span>
                  </div>
                  {axVendorParts[0]?.ax_item_number && (
                    <div className="text-[9px] text-muted mb-1 leading-snug">
                      AX has NSN <span className="font-mono">{s.nsn}</span> on item{" "}
                      <span className="font-mono font-medium">{axVendorParts[0].ax_item_number}</span>
                      {" "}via <span className="font-mono">ProductBarcodesV3</span>. Vendors below come from{" "}
                      <span className="font-mono">VendorProductDescriptionsV2</span> joined on that ItemNumber.
                    </div>
                  )}
                  <div className="text-[9px] text-muted mb-1 italic">Our vendor chain — not DLA-approved mfr list. For cross-reference.</div>
                  {axVendorParts.slice(0, 5).map((vp: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] mt-0.5">
                      <span className="font-mono text-blue-800">{vp.vendor_account || "—"}</span>
                      <span className="font-mono">{vp.vendor_product_number}</span>
                      {vp.vendor_description && <span className="text-muted truncate">{vp.vendor_description.slice(0, 40)}</span>}
                    </div>
                  ))}
                  {axVendorParts.length > 5 && <div className="text-[9px] text-muted mt-1">…{axVendorParts.length - 5} more</div>}
                </div>
              )}
              {matches?.length > 0 && (() => {
                const fuzzy = matches.filter((m: any) => m.match_type?.startsWith("TITLE_SIMILARITY"));
                const exact = matches.filter((m: any) => !m.match_type?.startsWith("TITLE_SIMILARITY"));
                return (
                  <div className="space-y-2">
                    {exact.length > 0 && (
                      <div className="bg-yellow-50 rounded-lg p-2 border border-yellow-200 text-xs">
                        <div className="text-[10px] font-bold text-yellow-700 mb-1">Part Number Matches ({exact.length})</div>
                        {exact.map((m: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[10px] mt-0.5">
                            <span className={`px-1 rounded font-medium ${m.confidence === "HIGH" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{m.confidence}</span>
                            <span className="font-mono">{m.matched_part_number}</span>
                            <span className="text-muted truncate">{m.matched_description?.slice(0, 40)}</span>
                            <span className="text-[9px] text-muted">({m.matched_source})</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {fuzzy.length > 0 && !s.is_sourceable && (
                      <div className="bg-red-50 rounded-lg p-2 border border-red-300 text-xs">
                        <div className="text-[10px] font-bold text-red-800 mb-1">⚠ Title-Only Candidates — VERIFY before bidding ({fuzzy.length})</div>
                        <div className="text-[10px] text-red-700 mb-1 leading-tight">
                          These part numbers belong to <em>different</em> NSNs that happen to share this nomenclature. Using them as your bid&apos;s mfr part# can misroute the order. Confirm via PUB LOG or the vendor before using.
                        </div>
                        {fuzzy.map((m: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[10px] mt-0.5">
                            <span className="px-1 rounded font-medium bg-red-200 text-red-800">FUZZY</span>
                            <span className="font-mono">{m.matched_part_number}</span>
                            <span className="text-muted truncate">{m.matched_description?.slice(0, 40)}</span>
                            <span className="text-[9px] text-muted">({m.matched_source})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        <NsnHistoryDetail nsn={s.nsn} />
      </div>
    );
  };

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Solicitations</span>
      </div>

      {/* File References grid — Abe works one EDI batch at a time; this
          lets him pick the batch he's currently on and scope the whole page
          to it. Clicking a row sets fileRefFilter; a chip below lets him
          drop it. */}
      {fileReferences.length > 0 && (
        <div className="mb-4 rounded-xl border border-card-border bg-card-bg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-card-border bg-gray-50">
            <div className="text-sm font-semibold">
              File References <span className="text-muted font-normal">({fileReferences.length})</span>
              {fileRefFilter && (
                <span className="ml-3 inline-flex items-center gap-1 text-xs rounded-full border border-accent bg-accent/10 text-accent px-2 py-0.5">
                  Scoped to <span className="font-mono">{fileRefFilter}</span>
                  <button
                    onClick={() => setFileRefFilter(null)}
                    className="ml-1 hover:text-red-600 font-semibold"
                    title="Clear file-reference filter"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            <button
              onClick={() => setFileRefsExpanded((x) => !x)}
              className="text-xs text-muted hover:text-foreground"
            >
              {fileRefsExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
          {fileRefsExpanded && (
            <div className="max-h-[260px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50/80 text-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">File Ref #</th>
                    <th className="px-3 py-1.5 text-left font-medium">Date</th>
                    <th className="px-3 py-1.5 text-right font-medium">Items</th>
                    <th className="px-3 py-1.5 text-left font-medium">Internal EDI ref</th>
                    <th className="px-3 py-1.5 text-right font-medium">AX</th>
                    <th className="px-3 py-1.5 text-right font-medium">Potential</th>
                    <th className="px-3 py-1.5 text-right font-medium">Non-Sourced</th>
                    <th className="px-3 py-1.5 text-right font-medium">Quoted</th>
                    <th className="px-3 py-1.5 text-right font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {fileReferences.slice(0, 60).map((f) => {
                    const active = fileRefFilter === f.file_reference;
                    return (
                      <tr
                        key={f.file_reference}
                        onClick={() => setFileRefFilter(active ? null : f.file_reference)}
                        className={`border-t border-card-border/60 cursor-pointer ${
                          active ? "bg-accent/10 ring-1 ring-accent" : "hover:bg-gray-50/70"
                        }`}
                      >
                        <td className="px-3 py-1.5 font-mono text-[11px]">{f.file_reference}</td>
                        <td className="px-3 py-1.5 text-muted">
                          {f.file_reference_date ? f.file_reference_date.slice(0, 10) : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold">{f.items}</td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-muted">
                          {f.internal_edi_reference || <span className="opacity-40">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {f.ax > 0 ? <span className="text-green-700 font-medium">{f.ax}</span> : <span className="text-muted">0</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {f.potential > 0 ? <span className="text-yellow-700 font-medium">{f.potential}</span> : <span className="text-muted">0</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right text-muted">{f.nonsourced}</td>
                        <td className="px-3 py-1.5 text-right">
                          {f.quoted > 0 ? <span className="text-blue-700 font-medium">{f.quoted}</span> : <span className="text-muted">0</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {f.submitted > 0 ? <span className="text-purple-700 font-medium">{f.submitted}</span> : <span className="text-muted">0</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {fileReferences.length > 60 && (
                <div className="px-3 py-1.5 text-[10px] text-muted text-center border-t border-card-border">
                  …{fileReferences.length - 60} more — oldest dropped. (Ask if you need pagination.)
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* FSC (category) filter — chips for the top categories in the current
          scope plus a dropdown for the rest. Lets Abe knock out one category
          at a time ("all the 6515 first, then 6510, …"). Reuses the existing
          fscFilter state ("all" = no filter) so the dropdown in the lower
          filter bar and this chip strip stay in sync. */}
      {fscRollup.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap text-xs">
          <span className="text-muted font-medium">Category:</span>
          {fscFilter !== "all" && (
            <button
              onClick={() => setFscFilter("all")}
              className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent/10 text-accent px-2.5 py-0.5 font-medium hover:bg-accent/20"
            >
              <span className="font-mono">{fscFilter}</span>
              <span className="text-[11px]">{fscLabel(fscFilter).replace(`${fscFilter} · `, "· ")}</span>
              <span className="ml-1 font-semibold">×</span>
            </button>
          )}
          {fscRollup.slice(0, 8).map((b) => {
            const active = fscFilter === b.fsc;
            return (
              <button
                key={b.fsc}
                onClick={() => setFscFilter(active ? "all" : b.fsc)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 hover:bg-gray-100 ${
                  active ? "border-accent bg-accent/10 text-accent" : "border-card-border bg-card-bg text-foreground"
                }`}
                title={fscLabel(b.fsc)}
              >
                <span className="font-mono font-semibold">{b.fsc}</span>
                <span className="text-muted">·</span>
                <span className="truncate max-w-[140px]">{fscLabel(b.fsc).replace(`${b.fsc} · `, "")}</span>
                <span className="ml-1 rounded bg-gray-200 text-gray-700 px-1.5 text-[10px] font-semibold">{b.total}</span>
              </button>
            );
          })}
          {fscRollup.length > 8 && (
            <select
              value={fscFilter !== "all" && !fscRollup.slice(0, 8).some((b) => b.fsc === fscFilter) ? fscFilter : ""}
              onChange={(e) => setFscFilter(e.target.value || "all")}
              className="rounded-full border border-card-border bg-card-bg px-2 py-0.5 text-xs"
            >
              <option value="">More…</option>
              {fscRollup.slice(8).map((b) => (
                <option key={b.fsc} value={b.fsc}>{fscLabel(b.fsc)} — {b.total}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Match-confidence cards — the three buckets Abe filters by before
          bidding. AX NSN Matched is the highest-confidence pile; Potential
          Matches need review; Non-Sourced are items we've never traded. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        {[
          {
            key: "ax_matched",
            label: "AX NSN Matched",
            sub: "Authoritative AX ProductBarcodesV3 link — highest confidence, safe for batch-quote",
            count: counts.axMatched,
            color: "border-green-400 bg-green-50 hover:bg-green-100",
            ring: "ring-green-400",
          },
          {
            key: "potential_matched",
            label: "Potential Matches",
            sub: "Sourceable via Master DB or P/N cross-ref — verify before bidding",
            count: counts.potentialMatched,
            color: "border-yellow-300 bg-yellow-50 hover:bg-yellow-100",
            ring: "ring-yellow-400",
          },
          {
            key: "non_sourced",
            label: "Non-Sourced",
            sub: "No NSN/part match — never done business with these items",
            count: counts.nonSourced,
            color: "border-gray-300 bg-gray-50 hover:bg-gray-100",
            ring: "ring-gray-400",
          },
        ].map((step) => (
          <button
            key={step.key}
            onClick={() => setFilter(step.key)}
            className={`rounded-lg border-2 p-4 text-left transition-all ${step.color} ${filter === step.key ? `ring-2 ${step.ring}` : ""}`}
          >
            <div className="text-3xl font-bold">{step.count}</div>
            <div className="text-sm font-semibold mt-1">{step.label}</div>
            <div className="text-[11px] text-muted mt-1 leading-snug">{step.sub}</div>
          </button>
        ))}
      </div>

      {/* Status / pipeline stats (smaller, below the big match cards) */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-2">
        {[
          { key: "sourceable", label: "Sourceable (all)", count: counts.sourceable, color: "border-green-200 bg-green-50/60", icon: Zap },
          { key: "quoted", label: "Quoted", count: counts.quoted, color: "border-blue-300 bg-blue-50", icon: DollarSign },
          { key: "submitted", label: "Submitted", count: counts.submitted, color: "border-purple-300 bg-purple-50", icon: Send },
          { key: "skipped", label: "Skipped", count: counts.skipped, color: "border-gray-300 bg-gray-50", icon: X },
          { key: "already_bid", label: "Bid in LL", count: counts.alreadyBid, color: "border-purple-200 bg-purple-50", icon: Check },
        ].map((step) => (
          <button
            key={step.key}
            onClick={() => setFilter(step.key)}
            className={`rounded-lg border-2 p-2 text-center transition-all ${step.color} ${filter === step.key ? "ring-2 ring-accent" : ""}`}
          >
            <div className="text-xl font-bold">{step.count}</div>
            <div className="text-[10px] font-medium">{step.label}</div>
          </button>
        ))}
      </div>
      {/* Source Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: "ll_active", label: "LamLinks FSCs", count: counts.llActive, color: "border-cyan-300 bg-cyan-50 text-cyan-800" },
          { key: "dibbs_only", label: "DIBBS Expansion", count: counts.dibbsOnly, color: "border-orange-300 bg-orange-50 text-orange-800" },
          { key: "all_unsourced", label: "No Source (inc. closed)", count: counts.total - counts.sourceable - counts.quoted - counts.submitted - counts.skipped - counts.alreadyBid, color: "border-amber-200 bg-amber-50 text-amber-800" },
          { key: "all", label: "All", count: counts.total, color: "border-card-border bg-card-bg" },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${f.color} ${filter === f.key ? "ring-2 ring-accent" : ""}`}>
            {f.label} <span className="font-bold ml-1">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-2">
          {filter === "quoted" && filtered.length > 0 && (
            <>
              <button
                onClick={() => {
                  const ids = filtered.filter((s) => s.bid_status === "quoted").map((s) => s.id);
                  setSelectedQuoted(selectedQuoted.size === ids.length ? new Set() : new Set(ids));
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-card-border bg-card-bg"
              >
                {selectedQuoted.size > 0 ? "Deselect All" : "Select All"}
              </button>
              {selectedQuoted.size > 0 && (
                <>
                  <button
                    onClick={handleSubmitAll}
                    disabled={submitting}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Submit {selectedQuoted.size} Bids
                  </button>
                  <button
                    onClick={handleUnquoteSelected}
                    disabled={submitting}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                    Undo {selectedQuoted.size} Quoted
                  </button>
                </>
              )}
            </>
          )}
          {isQuotableFilter && filtered.length > 0 && (
            <>
              <button
                onClick={() => {
                  // Select-all: every eligible row, including the ones missing a
                  // suggested_price. Those stay in the list so Abe can open them
                  // to enter a price manually; the bulk-quote action only submits
                  // the subset that has a price.
                  const ids = filtered
                    .filter((s) => s.is_sourceable && !s.bid_status && !s.already_bid)
                    .map((s) => s.id);
                  setSelectedSourceable(
                    selectedSourceable.size === ids.length ? new Set() : new Set(ids)
                  );
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-card-border bg-card-bg"
              >
                {selectedSourceable.size > 0 ? `Deselect (${selectedSourceable.size})` : "Select All"}
              </button>
              {selectedSourceable.size > 0 && (() => {
                const selectedRows = filtered.filter((s) => selectedSourceable.has(s.id));
                const withPrice = selectedRows.filter((s) => (s.suggested_price ?? 0) > 0).length;
                const withoutPrice = selectedRows.length - withPrice;
                return (
                  <>
                    <button
                      onClick={handleQuoteSelectedAtSuggested}
                      disabled={bulkQuoting || withPrice === 0}
                      title={withPrice === 0 ? "None of the selected rows have a suggested price yet" : undefined}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white disabled:opacity-50"
                    >
                      {bulkQuoting ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}
                      Quote {withPrice} at Suggested
                      {withoutPrice > 0 && (
                        <span className="ml-1 inline-block rounded bg-amber-400/80 text-amber-950 px-1.5 py-0.5 text-[10px] font-semibold">
                          {withoutPrice} lack price
                        </span>
                      )}
                    </button>
                    {withoutPrice > 0 && (
                      <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        {withoutPrice} selected row{withoutPrice !== 1 ? "s" : ""} {withoutPrice !== 1 ? "have" : "has"} no suggested price — open {withoutPrice !== 1 ? "them" : "it"} to enter a manual bid
                      </span>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-muted text-right">
            {lastSync && (
              <>
                <div>Last sync: {formatDateTime(lastSync.created_at)}</div>
                <div>
                  {lastSync.details?.sourceable && `${lastSync.details.sourceable} sourceable`}
                  {lastSync.details?.already_bid && ` · ${lastSync.details.already_bid} already bid`}
                  {lastSync.details?.count && ` · ${lastSync.details.count} scraped`}
                </div>
              </>
            )}
            <div className="text-muted/60">
              Next sync: {(() => {
                const now = new Date();
                const h = now.getUTCHours();
                const next = new Date(now);
                if (h < 11) { next.setUTCHours(11, 0, 0, 0); }
                else if (h < 17) { next.setUTCHours(17, 0, 0, 0); }
                else { next.setUTCDate(next.getUTCDate() + 1); next.setUTCHours(11, 0, 0, 0); }
                // Skip weekends
                while (next.getUTCDay() === 0 || next.getUTCDay() === 6) next.setUTCDate(next.getUTCDate() + 1);
                return next.toLocaleString();
              })()}
            </div>
          </div>
          <button onClick={handleScrapeNow} disabled={scraping || enriching}
            className="flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white disabled:opacity-50">
            {scraping || enriching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {scraping ? "Scraping DIBBS..." : enriching ? "Analyzing..." : "Sync Data"}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-3 rounded-lg bg-blue-50 text-blue-700 px-3 py-2 text-xs">{message}</div>
      )}

      {/* Search + Date Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search NSN, item, sol #, FSC..."
          className="flex-1 min-w-[200px] md:max-w-sm rounded-lg border border-card-border px-3 py-2 text-sm"
        />
        <div className="flex gap-1">
          {[
            { key: "all", label: "All Dates" },
            { key: "posted_today", label: "Posted Today" },
            { key: "posted_2d", label: "Posted 2d" },
            { key: "posted_week", label: "Posted This Week" },
            { key: "due_soon", label: "Due in 3d" },
            { key: "due_week", label: "Due This Week" },
          ].map((d) => (
            <button
              key={d.key}
              onClick={() => setDateFilter(d.key)}
              className={`px-2 py-1 rounded text-[10px] font-medium ${
                dateFilter === d.key
                  ? "bg-accent text-white"
                  : "bg-card-bg border border-card-border text-muted hover:bg-gray-50"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        {/* Column Filters */}
        <FscFilter
          value={fscFilter}
          onChange={setFscFilter}
          options={(() => {
            const counts = new Map<string, number>();
            for (const s of solicitations) {
              if (!s.fsc) continue;
              counts.set(s.fsc, (counts.get(s.fsc) || 0) + 1);
            }
            return [...counts.entries()].map(([code, count]) => ({ code, count }));
          })()}
        />
        <select value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value)}
          className="rounded border border-card-border px-2 py-1 text-[10px] bg-white">
          <option value="all">All Scores</option>
          <option value="bid">BID (65+)</option>
          <option value="consider">CONSIDER (40-64)</option>
          <option value="skip">SKIP (&lt;40)</option>
        </select>
        <select value={fobFilter} onChange={(e) => setFobFilter(e.target.value)}
          className="rounded border border-card-border px-2 py-1 text-[10px] bg-white">
          <option value="all">All FOB</option>
          <option value="D">FOB Dest</option>
          <option value="O">FOB Origin</option>
        </select>
        <select value={marginFilter} onChange={(e) => setMarginFilter(e.target.value)}
          className="rounded border border-card-border px-2 py-1 text-[10px] bg-white">
          <option value="all">All Margins</option>
          <option value="high">20%+</option>
          <option value="mid">10-20%</option>
          <option value="low">1-10%</option>
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded border border-card-border px-2 py-1 text-[10px] bg-white">
          <option value="all">All Sources</option>
          <option value="ax">AX</option>
          <option value="masterdb">Master DB</option>
        </select>
        <select value={qtyFilter} onChange={(e) => setQtyFilter(e.target.value)}
          className="rounded border border-card-border px-2 py-1 text-[10px] bg-white">
          <option value="all">All Qty</option>
          <option value="1">1 unit</option>
          <option value="2-10">2-10</option>
          <option value="11-100">11-100</option>
          <option value="100+">100+</option>
        </select>
        <select value={valueFilter} onChange={(e) => setValueFilter(e.target.value)}
          className="rounded border border-card-border px-2 py-1 text-[10px] bg-white">
          <option value="all">All Values</option>
          <option value="5k+">$5K+</option>
          <option value="1k+">$1K+</option>
          <option value="500+">$500+</option>
          <option value="<500">&lt;$500</option>
        </select>
        <div className="flex items-center gap-1 rounded border border-card-border px-2 py-0.5 bg-white text-[10px]">
          <span className="text-muted">$</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="min"
            value={valueMin}
            onChange={(e) => setValueMin(e.target.value)}
            className="w-14 outline-none bg-transparent text-[10px]"
          />
          <span className="text-muted">–</span>
          <span className="text-muted">$</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="max"
            value={valueMax}
            onChange={(e) => setValueMax(e.target.value)}
            className="w-14 outline-none bg-transparent text-[10px]"
          />
        </div>
        <label
          className="text-[11px] inline-flex items-center gap-1 cursor-pointer select-none"
          title="SPE* prefix = DIBBS solicitations (bidable through LamLinks). Other prefixes (W*, etc.) are DoD but not DIBBS — can't be bid from this system. Default on per Abe 2026-04-16."
        >
          <input type="checkbox" checked={dibbsOnly} onChange={(e) => setDibbsOnly(e.target.checked)} className="rounded" />
          DIBBS only
        </label>
        {(searchQuery || dateFilter !== "all" || fscFilter !== "all" || scoreFilter !== "all" || fobFilter !== "all" || marginFilter !== "all" || sourceFilter !== "all" || qtyFilter !== "all" || valueFilter !== "all" || valueMin || valueMax || !dibbsOnly) && (
          <span className="text-xs text-muted">{filtered.length} results</span>
        )}
        {(fscFilter !== "all" || scoreFilter !== "all" || fobFilter !== "all" || marginFilter !== "all" || sourceFilter !== "all" || qtyFilter !== "all" || valueFilter !== "all" || valueMin || valueMax) && (
          <button onClick={() => { setFscFilter("all"); setScoreFilter("all"); setFobFilter("all"); setMarginFilter("all"); setSourceFilter("all"); setQtyFilter("all"); setValueFilter("all"); setValueMin(""); setValueMax(""); }}
            className="text-[10px] text-red-500 hover:text-red-700 font-medium">Clear all</button>
        )}
      </div>

      {/* Total Value Bar */}
      {filteredTotalValue > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-4 py-2">
          <span className="text-xs text-green-700 font-medium">
            {filtered.length} items in view
          </span>
          <span className="text-sm font-bold font-mono text-green-700">
            Total Potential: ${filteredTotalValue >= 1e6
              ? (filteredTotalValue / 1e6).toFixed(2) + "M"
              : filteredTotalValue >= 1e3
                ? (filteredTotalValue / 1e3).toFixed(1) + "K"
                : filteredTotalValue.toFixed(2)}
          </span>
        </div>
      )}

      {/* Solicitation Table */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm overflow-hidden">
        <div className="px-3 py-1.5 text-[10px] text-muted bg-gray-50 border-b border-card-border flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold">Badges:</span>
          <span><span className="px-1 rounded bg-cyan-50 text-cyan-700 font-medium">LL</span> = from LamLinks (our subscribed FSCs)</span>
          <span>No LL badge = scraped from DIBBS website</span>
          <span><span className="px-1 rounded bg-green-100 text-green-700">P/N Match</span> = we found this item by matching the manufacturer part number (high confidence)</span>
          <span><span className="px-1 rounded bg-yellow-100 text-yellow-700">~Match</span> = possible part number match (lower confidence — verify before bidding)</span>
          <span><span className="px-1 rounded bg-purple-100 text-purple-700">Bid in LL</span> = Abe already placed a bid on this exact solicitation in LamLinks</span>
          <span>Cost under $ = where the cost came from: <span className="text-green-700">AX price agreement</span> / <span className="text-blue-700">Recent PO</span> / <span className="text-purple-700">Competitor won at</span></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted bg-gray-50/50">
                {(filter === "quoted" || isQuotableFilter) && <th className="px-3 py-2 w-8"></th>}
                <th className="px-3 py-2 font-medium"><div>NSN / Item</div><div className="text-[8px] font-normal text-muted">LL k08 + AX + PUB LOG</div></th>
                <th className="px-3 py-2 font-medium"><div>Sol #</div><div className="text-[8px] font-normal text-muted">LL k10</div></th>
                <th className="px-3 py-2 text-right"><SortHeader field="quantity">Qty</SortHeader><div className="text-[8px] font-normal text-muted">LL</div></th>
                <th className="px-3 py-2 text-right font-medium"><div>Cost</div><div className="text-[8px] font-normal text-muted">AX waterfall</div></th>
                <th className="px-3 py-2 text-right"><SortHeader field="price">Suggested</SortHeader><div className="text-[8px] font-normal text-muted">DIBS computed</div></th>
                <th className="px-3 py-2 text-right"><SortHeader field="margin">Margin</SortHeader><div className="text-[8px] font-normal text-muted">DIBS computed</div></th>
                <th className="px-3 py-2 text-right"><SortHeader field="value">Pot. Value</SortHeader><div className="text-[8px] font-normal text-muted">DIBS computed</div></th>
                <th className="px-3 py-2 text-center"><SortHeader field="score">Score</SortHeader><div className="text-[8px] font-normal text-muted">DIBS AI</div></th>
                <th className="px-3 py-2 font-medium"><div>FOB</div><div className="text-[8px] font-normal text-muted">LL</div></th>
                <th className="px-3 py-2"><SortHeader field="due">Due</SortHeader><div className="text-[8px] font-normal text-muted">LL k10</div></th>
                <th className="px-3 py-2"><SortHeader field="posted">Posted</SortHeader><div className="text-[8px] font-normal text-muted">LL k10</div></th>
                <th className="px-3 py-2 text-center font-medium"><div>History</div><div className="text-[8px] font-normal text-muted">LL + AX</div></th>
                <th className="px-3 py-2 font-medium"><div>Source</div><div className="text-[8px] font-normal text-muted">AX / MDB / LL</div></th>
                <th className="px-3 py-2 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, visibleLimit).map((s) => {
                const potValue = (s as any)._potentialValue || s.est_value || (s.suggested_price || s.final_price || 0) * (s.quantity || 1);
                const isEditing = editingId === s.id;
                // Use lazy-loaded cache first, fall back to server-provided data
                const cached = historyCache.get(s.nsn);
                const history = cached?.awards || historyByNsn.get(s.nsn) || [];
                const abeBids = cached?.bids || abeBidsByNsn.get(s.nsn) || [];

                return (
                  <>
                    <tr
                      key={s.id}
                      onClick={() => {
                        const newId = detailId === s.id ? null : s.id;
                        setDetailId(newId);
                        if (newId && !historyCache.has(s.nsn)) loadNsnHistory(s.nsn);
                      }}
                      className={`border-b border-card-border hover:bg-gray-50/50 cursor-pointer ${
                        detailId === s.id ? "bg-accent/5 ring-1 ring-accent/20" :
                        s.bid_status === "submitted" ? "bg-purple-50/30" :
                        s.bid_status === "quoted" ? "bg-blue-50/30" :
                        s.bid_status === "skipped" ? "opacity-40" : ""
                      }`}
                    >
                      {filter === "quoted" && (
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedQuoted.has(s.id)}
                            onChange={(e) => {
                              const next = new Set(selectedQuoted);
                              if (e.target.checked) next.add(s.id); else next.delete(s.id);
                              setSelectedQuoted(next);
                            }} className="rounded" />
                        </td>
                      )}
                      {isQuotableFilter && (
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedSourceable.has(s.id)}
                            disabled={!s.is_sourceable || !!s.bid_status || !!s.already_bid}
                            title={!s.suggested_price ? "No suggested price — selectable but won't auto-quote; open to bid manually" : ""}
                            onChange={(e) => {
                              const next = new Set(selectedSourceable);
                              if (e.target.checked) next.add(s.id); else next.delete(s.id);
                              setSelectedSourceable(next);
                            }}
                            className={`rounded ${!s.suggested_price ? "ring-1 ring-amber-400" : ""}`}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setExpandedNsn(expandedNsn === s.nsn ? null : s.nsn)}
                            className="text-muted hover:text-accent">
                            <History className="h-3 w-3" />
                          </button>
                          <div>
                            <div className="flex items-center gap-1 flex-wrap">
                              <SourceTip source="LamLinks k08_tab.fsc_k08 + niin_k08. Matched to AX via ProductBarcodesV3."><span className="font-mono text-xs text-accent">{s.nsn}</span></SourceTip>
                              <LlPidPopover nsn={s.nsn} compact />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setResearchNsn(s.nsn);
                                  setResearchSolNo(s.solicitation_number);
                                }}
                                className="text-[10px] rounded border border-card-border px-1.5 py-0.5 hover:bg-gray-50 inline-flex items-center gap-1"
                                title="Auto-research: find suppliers for this NSN"
                              >
                                🔍 research
                              </button>
                              {s.bid_status && (
                                <span className={`text-[10px] px-1 rounded ${
                                  s.bid_status === "quoted" ? "bg-blue-100 text-blue-700" :
                                  s.bid_status === "submitted" ? "bg-purple-100 text-purple-700" :
                                  "bg-gray-100 text-gray-600"
                                }`}>{s.bid_status.toUpperCase()}</span>
                              )}
                              {s.source === "ax" && <span className="text-[8px] px-1 rounded bg-green-50 text-green-600">AX</span>}
                              {s.source === "masterdb" && <span className="text-[8px] px-1 rounded bg-purple-50 text-purple-600">MDB</span>}
                              {s.data_source === "lamlinks" && <span className="text-[8px] px-1 rounded bg-cyan-50 text-cyan-700">LL</span>}
                            </div>
                            <div className="text-xs truncate max-w-[180px]"><SourceTip source="LamLinks k08_tab.p_desc_k08">{s.nomenclature || "—"}</SourceTip></div>
                            <div className="flex flex-wrap gap-0.5 mt-0.5">
                              {/* Posting type (Q manual / T auto) — Q means a named buyer
                                  drafted the sol, which changes Abe's approach (match their
                                  requested delivery days exactly, look at buyer name). */}
                              {s.posting_type === "Q" && (
                                <SourceTip source="LamLinks k10_tab.sol_ti_k10 — 'Q' = manual buyer posting (look at buyer name + delivery days)">
                                  <span className="text-[9px] px-1 rounded bg-rose-100 text-rose-800 font-semibold border border-rose-200">Q · manual</span>
                                </SourceTip>
                              )}
                              {s.posting_type === "T" && (
                                <SourceTip source="LamLinks k10_tab.sol_ti_k10 — 'T' = DIBBS auto-generated">
                                  <span className="text-[9px] px-1 rounded bg-slate-100 text-slate-700">T · auto</span>
                                </SourceTip>
                              )}
                              {s.buyer_name && (
                                <SourceTip source="LamLinks k10_tab.b_name_k10 — DLA buyer who drafted this sol">
                                  <span className="text-[9px] px-1 rounded bg-indigo-50 text-indigo-800">👤 {s.buyer_name.split(" ").slice(0, 2).join(" ")}</span>
                                </SourceTip>
                              )}
                              {(s.required_delivery_days ?? 0) > 0 && (
                                <SourceTip source="Derived: earliest k32_tab.dlydte_k32 minus k10_tab.isudte_k10. Suggested bid lead time matches this.">
                                  <span className="text-[9px] px-1 rounded bg-emerald-50 text-emerald-800 font-medium">📅 deliver in {s.required_delivery_days}d</span>
                                </SourceTip>
                              )}
                              {(s.ship_to_locations?.length ?? 0) > 1 && (
                                <SourceTip source="LamLinks k32_tab — number of distinct ship-to destinations on this line">
                                  <span className="text-[9px] px-1 rounded bg-blue-50 text-blue-700">{s.ship_to_locations!.length} ship-tos</span>
                                </SourceTip>
                              )}
                              {s.already_bid && (
                                <span className="text-[9px] px-1 rounded bg-purple-100 text-purple-700 font-medium">
                                  Already Bid{s.last_bid_price ? ` @$${s.last_bid_price.toFixed(2)}` : ""}{s.last_bid_date ? ` ${formatDateShort(s.last_bid_date)}` : ""}
                                </span>
                              )}
                              {/* Outcome pill — shows after we've bid AND an award
                                  has landed (or we at least know who won). Color
                                  tells the story: green = we won, red = lost,
                                  amber = award happened but winner unknown, gray
                                  = still pending. */}
                              {s.already_bid && (s.last_award_winner || (s as any).competitor_cage) && (
                                (() => {
                                  const winner = (s.last_award_winner || "").trim().toUpperCase();
                                  const compCage = ((s as any).competitor_cage || "").trim().toUpperCase();
                                  const winPrice = s.last_bid_price != null ? ` @$${Number(s.last_bid_price).toFixed(2)}` : "";
                                  if (winner === "0AG09") {
                                    return (
                                      <SourceTip source="awards.cage='0AG09' — we won this contract">
                                        <span className="text-[9px] px-1 rounded bg-green-100 text-green-800 font-semibold border border-green-300">
                                          ✓ WE WON{winPrice}
                                        </span>
                                      </SourceTip>
                                    );
                                  }
                                  if (winner && winner !== "0AG09") {
                                    return (
                                      <SourceTip source={`awards.cage='${winner}' — competitor won this contract`}>
                                        <span className="text-[9px] px-1 rounded bg-red-100 text-red-800 font-semibold border border-red-300">
                                          ✗ LOST to {winner}{winPrice}
                                        </span>
                                      </SourceTip>
                                    );
                                  }
                                  if (compCage) {
                                    return (
                                      <span className="text-[9px] px-1 rounded bg-red-100 text-red-800 font-semibold border border-red-300">
                                        ✗ LOST to {compCage}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()
                              )}
                              {/* Award happened but winner name not in LL yet */}
                              {s.already_bid && !s.last_award_winner && !(s as any).competitor_cage && (s.award_count ?? 0) > 0 && (
                                <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-800 border border-amber-300" title="LamLinks shows the sol as awarded but hasn't published the winner's CAGE yet. Check DIBBS.gov.">
                                  ⚠ Awarded — winner unknown
                                </span>
                              )}
                              {s.procurement_type && s.procurement_type !== "RFQ" && (
                                <span className="text-[9px] px-1 rounded bg-indigo-100 text-indigo-700 font-medium">{s.procurement_type}</span>
                              )}
                              {s.set_aside && !["None", "none", "no", "No", "N/A", ""].includes(s.set_aside?.trim()) && (
                                <span className="text-[9px] px-1 rounded bg-amber-50 text-amber-700">{s.set_aside}</span>
                              )}
                              {(s as any).nsn_match && (
                                <span className={`text-[9px] px-1 rounded font-medium ${
                                  (s as any).nsn_match.confidence === "HIGH" ? "bg-green-100 text-green-700" :
                                  (s as any).nsn_match.confidence === "MEDIUM" ? "bg-yellow-100 text-yellow-700" :
                                  "bg-gray-100 text-gray-600"
                                }`}>
                                  {(s as any).nsn_match.confidence === "HIGH" ? "P/N" : "~P/N"}: {(s as any).nsn_match.matched_part_number || "?"} via {(s as any).nsn_match.matched_source || "?"}
                                </span>
                              )}
                              {/* Fuzzy title match warning — only show when we have NO
                                  authoritative source. If AX or Master DB already knows
                                  this NSN (is_sourceable=true with source set), the
                                  fuzzy match is noise from the title-similarity pass. */}
                              {(s as any).nsn_fuzzy_matches?.length > 0 && !(s as any).nsn_match && !s.is_sourceable && (
                                <span className="text-[9px] px-1 rounded font-medium bg-red-50 text-red-700 border border-red-200" title="Title similarity only — different NSN's item may share nomenclature. Do NOT use without verifying.">
                                  ⚠ TITLE-MATCH ONLY — VERIFY
                                </span>
                              )}
                              {(s.award_count ?? 0) > 0 && (
                                <span className="text-[9px] px-1 rounded bg-orange-50 text-orange-700">{s.award_count} competitors{s.competitor_cage ? `: ${s.competitor_cage}` : ""}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted"><SourceTip source="LamLinks k10_tab.sol_no_k10">{s.solicitation_number}</SourceTip></td>
                      <td className="px-3 py-2 text-right"><SourceTip source="LamLinks k11_tab quantity">{s.quantity}</SourceTip></td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-muted">
                        {s.our_cost ? `$${s.our_cost.toFixed(2)}` : "—"}
                        {s.cost_source && <div className="text-[9px] text-muted/60 truncate max-w-[80px]">{s.cost_source}</div>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-green-600">
                        {s.bid_status === "quoted" || s.bid_status === "submitted"
                          ? `$${(s.final_price || 0).toFixed(2)}`
                          : s.suggested_price ? `$${s.suggested_price.toFixed(2)}` : "—"}
                        {s.price_source && (
                          <div className="text-[9px] text-muted/60 font-normal truncate max-w-[120px]">{s.price_source}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <SourceTip source="DIBS computed: (suggested - cost) / suggested">
                        {s.margin_pct !== null ? (
                          <span className={`text-xs font-medium ${s.margin_pct >= 20 ? "text-green-600" : s.margin_pct >= 10 ? "text-yellow-600" : "text-red-600"}`}>
                            {s.margin_pct}%
                          </span>
                        ) : "—"}
                        </SourceTip>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-bold">
                        <SourceTip source="DIBS computed: suggested × quantity. Secondary line is LamLinks' own estval_k11 (their reference estimate).">
                        {potValue > 0 ? (
                          <>
                            ${potValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {!s.is_sourceable && s.last_award_price && (
                              <div className="text-[9px] text-muted font-normal">est. from award</div>
                            )}
                            {s.lamlinks_estimated_value != null && s.lamlinks_estimated_value > 0 && (
                              <div className="text-[9px] text-muted font-normal" title="LamLinks k11_tab.estval_k11 — their internal reference estimate for this line">
                                LL est: ${Number(s.lamlinks_estimated_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            )}
                          </>
                        ) : s.lamlinks_estimated_value != null && s.lamlinks_estimated_value > 0 ? (
                          <div className="text-[10px] font-normal text-muted" title="LamLinks k11_tab.estval_k11">
                            LL est: ${Number(s.lamlinks_estimated_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        ) : "—"}
                        </SourceTip>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <SourceTip source="DIBS AI score: cost confidence + margin quality + win probability + value + timing">
                        {(() => {
                          const bs = (s as any)._bidScore as BidScore | undefined;
                          if (!bs) return "—";
                          const color = bs.score >= 65 ? "bg-green-100 text-green-800" : bs.score >= 40 ? "bg-yellow-100 text-yellow-800" : "bg-red-50 text-red-700";
                          return (
                            <div title={bs.reasons.join(" · ")}>
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${color}`}>{bs.score}</span>
                              <div className={`text-[9px] font-medium mt-0.5 ${bs.recommendation === "BID" ? "text-green-700" : bs.recommendation === "CONSIDER" ? "text-yellow-700" : "text-red-600"}`}>
                                {bs.recommendation}
                              </div>
                            </div>
                          );
                        })()}
                        </SourceTip>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <SourceTip source="LamLinks solicitation — D=Destination (we pay shipping), O=Origin (buyer pays)">
                        {s.fob ? (
                          <span className={`text-[10px] font-medium px-1 rounded ${s.fob === "D" ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-600"}`}>
                            {s.fob === "D" ? "Dest" : "Orig"}
                          </span>
                        ) : "—"}
                        {s.est_shipping && s.fob === "D" && (
                          <div className="text-[9px] text-muted">~${s.est_shipping} ship</div>
                        )}
                        </SourceTip>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted whitespace-nowrap"><SourceTip source="LamLinks k10_tab.closes_k10 — response deadline">{s.return_by_date}</SourceTip></td>
                      <td className="px-3 py-2 text-xs text-muted whitespace-nowrap"><SourceTip source="LamLinks k10_tab.issue_date — when DIBBS posted the solicitation">{s.issue_date || "—"}</SourceTip></td>
                      <td className="px-3 py-2 text-center text-xs whitespace-nowrap">
                        <SourceTip source="Bids from abe_bids + abe_bids_live (LamLinks k34). Wins from awards (LamLinks k81).">
                        {(() => {
                          const hc = (s as any)._histCounts;
                          if (!hc || (hc.bids === 0 && hc.wins === 0)) return <span className="text-muted">—</span>;
                          return (
                            <span>
                              {hc.bids > 0 && <span className="text-blue-700 font-medium">{hc.bids}B</span>}
                              {hc.bids > 0 && hc.wins > 0 && " "}
                              {hc.wins > 0 && <span className="text-green-700 font-medium">{hc.wins}W</span>}
                            </span>
                          );
                        })()}
                        </SourceTip>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          {s.source === "ax" ? (
                            <span className="text-[10px] px-1 rounded bg-green-100 text-green-700 font-medium" title="Matched in D365/AX — proven purchase history">
                              via AX
                            </span>
                          ) : s.source === "masterdb" ? (
                            <span className="text-[10px] px-1 rounded bg-blue-100 text-blue-700 font-medium" title="Matched in Master DB — we carry this product">
                              via Master
                            </span>
                          ) : (
                            <span className="text-[10px] px-1 rounded bg-gray-50 text-gray-400">—</span>
                          )}
                          {s.channel === "dibbs_only" && (
                            <span className="text-[9px] px-1 rounded bg-orange-100 text-orange-600 font-medium" title="FSC not active in LamLinks">
                              DIBBS only
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          {s.is_sourceable && !s.bid_status && !isEditing && (
                            <button onClick={() => { setEditingId(s.id); setEditPrice(s.suggested_price?.toFixed(2) || ""); }}
                              className="text-[10px] px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-medium">
                              Bid
                            </button>
                          )}
                          {!isEditing && (
                            <button onClick={() => handleFindSuppliers(s)}
                              className={`text-[10px] px-2 py-1 rounded border font-medium ${supplierSearchId === s.id ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-700"}`}>
                              {supplierSearchId === s.id ? "Close" : "Find Suppliers"}
                            </button>
                          )}
                          {!isEditing && s.nsn && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setSourcingId(s.id); }}
                              className={`text-[10px] px-2 py-1 rounded border font-medium ${
                                (s as any).bid_vendor
                                  ? "bg-sky-100 text-sky-700 border-sky-300 hover:bg-sky-200"
                                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-sky-50 hover:text-sky-700"
                              }`}
                              title="Set vendor / UoM / cost / supplier SKU in advance — will auto-apply when the award lands"
                            >
                              {(s as any).bid_vendor ? `✓ ${(s as any).bid_vendor}` : "Sourcing"}
                            </button>
                          )}
                          {s.bid_comment && (
                            <div className="text-[9px] text-yellow-700 flex items-center gap-0.5">
                              <MessageSquare className="h-2 w-2" />{s.bid_comment}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Inline edit row */}
                    {isEditing && (
                      <tr key={`edit-${s.id}`} className="border-b border-card-border bg-green-50/30">
                        <td colSpan={filter === "quoted" ? 14 : 13} className="px-3 py-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted">Price:</span>
                              <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                                placeholder={s.suggested_price?.toFixed(2) || ""} step="0.01" autoFocus
                                className="w-24 rounded border border-card-border px-2 py-1 text-xs font-mono text-right" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted">Days:</span>
                              <input type="number" value={editDays} onChange={(e) => setEditDays(e.target.value)}
                                className="w-14 rounded border border-card-border px-2 py-1 text-xs font-mono text-right" />
                            </div>
                            <input type="text" value={editComment} onChange={(e) => setEditComment(e.target.value)}
                              placeholder="Reason (optional)" className="flex-1 min-w-[150px] rounded border border-card-border px-2 py-1 text-xs" />
                            <button onClick={() => handleApprove(s)} disabled={saving}
                              className="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs text-white font-medium disabled:opacity-50">
                              <Check className="h-3 w-3" /> Approve
                            </button>
                            <button onClick={() => handleSkip(s)} disabled={saving}
                              className="flex items-center gap-1 rounded bg-gray-400 px-2 py-1 text-xs text-white font-medium disabled:opacity-50">
                              <X className="h-3 w-3" /> Skip
                            </button>
                            <button onClick={() => { setEditingId(null); setEditComment(""); setEditPrice(""); }}
                              className="text-xs text-muted hover:text-foreground">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Bid + Award history expansion — full timeline with
                        competitor wins and our linked bids (same component
                        used in the detail panel) */}
                    {expandedNsn === s.nsn && (
                      <tr key={`hist-${s.id}`} className="border-b border-card-border bg-blue-50/20">
                        <td colSpan={filter === "quoted" ? 14 : 13} className="px-3 py-2">
                          <NsnHistoryDetail nsn={s.nsn} />
                        </td>
                      </tr>
                    )}


                    {/* Supplier Search Results */}
                    {supplierSearchId === s.id && (
                      <tr key={`sup-${s.id}`} className="border-b border-card-border bg-indigo-50/20">
                        <td colSpan={filter === "quoted" ? 14 : 13} className="px-3 py-3">
                          {loadingSuppliers ? (
                            <div className="flex items-center gap-2 py-4 justify-center">
                              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                              <span className="text-sm text-indigo-700">Searching for suppliers across 10 sources...</span>
                            </div>
                          ) : supplierResults ? (
                            <div className="space-y-3">
                              <div className="text-xs font-bold text-indigo-800">
                                Supplier Search Results — {s.nsn} &quot;{s.nomenclature}&quot;
                              </div>

                              {/* Known Vendors (from our D365 data) */}
                              {supplierResults.vendorPrices?.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-medium text-green-700 mb-1">Known Vendors (from AX)</div>
                                  <div className="flex flex-wrap gap-2">
                                    {supplierResults.vendorPrices.map((v: any, i: number) => (
                                      <div key={i} className="text-xs bg-green-50 border border-green-200 rounded px-2 py-1">
                                        <span className="font-mono font-medium">{v.vendor}</span>
                                        <span className="text-green-700 ml-1">${v.price.toFixed(2)}</span>
                                        <span className="text-[9px] text-muted ml-1">({v.price_source === "recent_po" ? "PO" : "Agreement"})</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Past Award Winners */}
                              {supplierResults.pastWinners?.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-medium text-blue-700 mb-1">Past Award Winners</div>
                                  <div className="flex flex-wrap gap-2">
                                    {supplierResults.pastWinners.map((w: any, i: number) => (
                                      <div key={i} className="text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1">
                                        <span className="font-mono font-medium">CAGE {w.cage}</span>
                                        <span className="ml-1">${w.lastPrice.toFixed(2)}</span>
                                        <span className="text-[9px] text-muted ml-1">({w.wins}x won)</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Master DB Matches */}
                              {supplierResults.masterDbMatches?.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-medium text-purple-700 mb-1">In Our Catalog (Master DB)</div>
                                  <div className="flex flex-wrap gap-2">
                                    {supplierResults.masterDbMatches.map((m: any, i: number) => (
                                      <div key={i} className="text-xs bg-purple-50 border border-purple-200 rounded px-2 py-1">
                                        <span className="font-medium">{m.supplier}</span>
                                        <span className="font-mono ml-1">{m.sku}</span>
                                        {m.cost && <span className="text-purple-700 ml-1">${m.cost.toFixed(2)}</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Web Search Results */}
                              {/* Web Search Results */}
                              {supplierResults.webResults?.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-medium text-indigo-700 mb-1">
                                    Found Online ({supplierResults.webResults.length} results from {supplierResults.searchCount} searches)
                                  </div>
                                  <div className="grid gap-1">
                                    {supplierResults.webResults.map((r: any, i: number) => (
                                      <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center justify-between text-xs bg-white border border-gray-200 rounded px-2 py-1.5 hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
                                        <div className="min-w-0">
                                          <div className="font-medium text-indigo-800 truncate">{r.title}</div>
                                          <div className="text-[10px] text-muted truncate">{r.supplier}</div>
                                        </div>
                                        <span className="text-[9px] text-indigo-400 ml-2 shrink-0">{r.searchType}</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* NSN Approved Sources */}
                              {supplierResults.nsnApprovedCages?.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-medium text-gray-700 mb-1">NSN Approved CAGE Codes</div>
                                  <div className="flex flex-wrap gap-1">
                                    {supplierResults.nsnApprovedCages.map((c: string, i: number) => (
                                      <span key={i} className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded">{c}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* External lookups — ALWAYS shown. When Railway can't
                                  scrape Google (captcha / rate-limit) these are the
                                  places Abe was already manually checking; one-click
                                  out. Kept compact; opens in new tabs. */}
                              {supplierResults.externalLookups?.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-medium text-teal-700 mb-1">External Lookups (one-click)</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {supplierResults.externalLookups.map((ext: any, i: number) => (
                                      <a
                                        key={i}
                                        href={ext.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={ext.hint}
                                        className="inline-flex items-center gap-1 text-[11px] rounded border border-teal-300 bg-teal-50 text-teal-800 px-2 py-0.5 hover:bg-teal-100"
                                      >
                                        {ext.label}
                                        <span aria-hidden className="text-[9px]">↗</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {supplierResults.internalEmpty && supplierResults.webEmpty && (
                                <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
                                  <div className="font-semibold mb-0.5">Nothing in our internal tables for this NSN.</div>
                                  <div className="leading-snug">
                                    AX doesn&apos;t have it (no nsn_catalog / nsn_vendor_prices row), no past award history, and web-scraping returned nothing (Railway IPs are often blocked by Google).
                                    Use the external lookups above — DIBBS awards + NSNLookup usually tell the full story.
                                    If you find a supplier, set it via the{" "}
                                    <span className="font-mono">Sourcing</span> button on the row to lock it in for future awards.
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted">Search failed — try again</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > visibleLimit && (
          <div className="px-4 py-3 border-t border-card-border bg-gray-50 flex items-center justify-between text-xs">
            <span className="text-muted">
              Showing <strong>{visibleLimit}</strong> of <strong>{filtered.length}</strong> matching
              {visibleLimit < filtered.length && ` · next ${Math.min(200, filtered.length - visibleLimit)} not rendered yet`}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setVisibleLimit((n) => Math.min(filtered.length, n + 200))}
                className="rounded border border-card-border bg-white px-3 py-1 font-medium hover:bg-accent/10"
              >
                Show +200
              </button>
              <button
                onClick={() => setVisibleLimit(filtered.length)}
                className="rounded border border-card-border bg-white px-3 py-1 font-medium hover:bg-accent/10"
              >
                Show all ({filtered.length})
              </button>
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted">
            <p className="text-lg font-medium">
              {filter === "sourceable" ? "No sourceable solicitations" :
               filter === "ax_matched" ? "No AX NSN-matched solicitations" :
               filter === "potential_matched" ? "No potential matches" :
               filter === "non_sourced" ? "No non-sourced solicitations" :
               filter === "quoted" ? "No quoted bids yet" :
               "No solicitations"}
            </p>
            <p className="text-sm mt-1">
              {filter === "sourceable" || filter === "ax_matched" || filter === "potential_matched" ? 'Click "Scrape Now" then "Match NSNs"' :
               filter === "non_sourced" ? "Items here have no AX / Master DB match — run NSN match after next scrape." :
               "Review sourceable items first"}
            </p>
          </div>
        )}
      </div>
      {sourcingId !== null && (() => {
        const sol = solicitations.find((x) => x.id === sourcingId);
        if (!sol) return null;
        return (
          <SourcingModal
            solicitation={sol as any}
            onClose={() => setSourcingId(null)}
            onSaved={(upd) => {
              setSolicitations((prev) =>
                prev.map((x) =>
                  x.id === sourcingId
                    ? {
                        ...x,
                        bid_vendor: upd.bid_vendor,
                        bid_cost: upd.bid_cost ?? (x as any).bid_cost,
                        bid_uom: upd.bid_uom ?? (x as any).bid_uom,
                        bid_item_number: upd.bid_item_number ?? (x as any).bid_item_number,
                      } as any
                    : x
                )
              );
              const cascade = upd.draft_lines_updated > 0
                ? ` + ${upd.draft_lines_updated} draft PO line${upd.draft_lines_updated !== 1 ? "s" : ""} refreshed`
                : "";
              setMessage(`Sourcing saved for ${sol.nsn} · ${upd.bid_vendor}${cascade}`);
              setTimeout(() => setMessage(null), 4000);
            }}
          />
        );
      })()}

      {researchNsn && (
        <ResearchDrawer
          nsn={researchNsn}
          solicitationNumber={researchSolNo || undefined}
          onClose={() => {
            setResearchNsn(null);
            setResearchSolNo(null);
          }}
        />
      )}

      {/* Fullscreen review modal — triggered by detailId. Same UX for
          sourceable + non-sourceable. Clicking any row opens this. */}
      {detailId !== null && (() => {
        const idx = filtered.findIndex((x) => x.id === detailId);
        if (idx < 0) return null;
        const current = filtered[idx];
        const prev = idx > 0 ? filtered[idx - 1] : null;
        const next = idx < filtered.length - 1 ? filtered[idx + 1] : null;
        const goTo = (s: Solicitation | null) => {
          if (!s) return;
          setDetailId(s.id);
          setEditPrice(s.suggested_price?.toFixed(2) || "");
          setEditDays("45");
          setEditComment("");
        };
        const close = () => {
          setDetailId(null);
          setEditingId(null);
        };
        const approveAndNext = async () => {
          setEditingId(current.id);
          await handleApprove(current);
          if (next) goTo(next); else close();
        };
        const skipAndNext = async () => {
          setEditingId(current.id);
          await handleSkip(current);
          if (next) goTo(next); else close();
        };

        return (
          <div
            className="fixed inset-0 z-50 bg-black/60 flex items-stretch justify-center"
            onClick={close}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "ArrowLeft" && prev) goTo(prev);
              if (e.key === "ArrowRight" && next) goTo(next);
            }}
            tabIndex={-1}
          >
            <div
              className="bg-white w-full max-w-6xl mx-4 my-4 rounded-xl shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top nav bar: prev preview · position · next preview */}
              <div className="bg-gradient-to-r from-gray-50 to-white border-b border-card-border px-4 py-3 flex items-center gap-3">
                <button
                  onClick={() => prev && goTo(prev)}
                  disabled={!prev}
                  className={`rounded border border-card-border px-3 py-2 text-left flex-1 max-w-[220px] transition ${
                    prev ? "hover:bg-accent/10" : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  <div className="text-[10px] text-muted">← Previous</div>
                  {prev ? (
                    <>
                      <div className="font-mono text-[10px] text-accent truncate">{prev.nsn}</div>
                      <div className="text-[11px] truncate">{prev.nomenclature}</div>
                      <div className="text-[10px] text-muted">qty {prev.quantity}</div>
                    </>
                  ) : (
                    <div className="text-xs text-muted italic">first item</div>
                  )}
                </button>

                <div className="flex-1 text-center px-2">
                  <div className="text-[11px] text-muted font-mono uppercase tracking-wide">
                    {idx + 1} of {filtered.length} · {filter}
                  </div>
                  <div className="text-lg font-bold truncate">{current.nomenclature}</div>
                  <div className="text-xs font-mono text-accent">{current.nsn}</div>
                  <div className="mt-2 inline-block bg-gray-900 text-white rounded-lg px-6 py-2">
                    <div className="text-[10px] uppercase tracking-widest opacity-70">Qty</div>
                    <div className="text-4xl font-bold leading-none">{current.quantity}</div>
                  </div>
                </div>

                <button
                  onClick={() => next && goTo(next)}
                  disabled={!next}
                  className={`rounded border border-card-border px-3 py-2 text-right flex-1 max-w-[220px] transition ${
                    next ? "hover:bg-accent/10" : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  <div className="text-[10px] text-muted">Next →</div>
                  {next ? (
                    <>
                      <div className="font-mono text-[10px] text-accent truncate">{next.nsn}</div>
                      <div className="text-[11px] truncate">{next.nomenclature}</div>
                      <div className="text-[10px] text-muted">qty {next.quantity}</div>
                    </>
                  ) : (
                    <div className="text-xs text-muted italic">last item</div>
                  )}
                </button>

                <button onClick={close} className="text-muted hover:text-foreground ml-2">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body — identical content to the old inline expanded view,
                  rendered via the shared renderSolDetail helper so the two
                  never drift. hideInlineNext=true because the modal has its
                  own prev/next navigation in the top bar + footer. */}
              <div className="flex-1 overflow-y-auto bg-gray-50">
                {renderSolDetail(current, { hideInlineNext: true })}
              </div>

              {/* Footer — edit inputs + action buttons */}
              <div className="bg-white border-t border-card-border p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted uppercase">Price</span>
                    <input type="number" value={editPrice} onChange={(e) => { setEditingId(current.id); setEditPrice(e.target.value); }}
                      step="0.01" autoFocus
                      className="w-28 rounded border border-card-border px-2 py-1.5 text-sm font-mono text-right" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted uppercase">Days</span>
                    <input type="number" value={editDays} onChange={(e) => { setEditingId(current.id); setEditDays(e.target.value); }}
                      className="w-16 rounded border border-card-border px-2 py-1.5 text-sm font-mono text-right" />
                  </div>
                  <input type="text" value={editComment} onChange={(e) => { setEditingId(current.id); setEditComment(e.target.value); }}
                    placeholder="Reason (optional)"
                    className="flex-1 min-w-[200px] rounded border border-card-border px-2 py-1.5 text-sm" />

                  <div className="flex items-center gap-1 ml-auto">
                    <button onClick={() => prev && goTo(prev)} disabled={!prev}
                      className="px-3 py-1.5 text-xs rounded border border-card-border disabled:opacity-40 hover:bg-gray-50">
                      ← Prev
                    </button>
                    <button onClick={skipAndNext} disabled={saving}
                      className="px-3 py-1.5 text-xs rounded bg-gray-500 text-white disabled:opacity-50 hover:opacity-90 inline-flex items-center gap-1">
                      <X className="h-3 w-3" /> Skip &amp; Next
                    </button>
                    <button onClick={approveAndNext} disabled={saving}
                      className="px-3 py-1.5 text-xs rounded bg-green-600 text-white font-semibold disabled:opacity-50 hover:opacity-90 inline-flex items-center gap-1">
                      <Check className="h-3 w-3" /> Approve &amp; Next
                    </button>
                    <button onClick={() => next && goTo(next)} disabled={!next}
                      className="px-3 py-1.5 text-xs rounded border border-card-border disabled:opacity-40 hover:bg-gray-50">
                      Next →
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-muted mt-2">
                  Tip: ← / → arrow keys to navigate · Esc to close
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
