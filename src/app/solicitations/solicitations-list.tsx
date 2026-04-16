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
  award_count: number | null;
  bid_status: string | null;
  final_price: number | null;
  bid_comment: string | null;
  decided_by: string | null;
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

type SortField = "value" | "margin" | "due" | "price" | "quantity" | "score";

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
  const [filter, setFilter] = useState<string>(initialFilter || "sourceable");
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
        });
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
    let sourceable = 0, quoted = 0, submitted = 0, skipped = 0, alreadyBid = 0, llActive = 0, dibbsOnly = 0;
    for (const s of solicitations) {
      const open = isOpenSolicitation(s.return_by_date);
      if (s.data_source === "lamlinks" && open) llActive++;
      if (s.data_source !== "lamlinks" && open) dibbsOnly++;
      if (s.bid_status === "quoted") { quoted++; continue; }
      if (s.bid_status === "submitted") { submitted++; continue; }
      if (s.bid_status === "skipped") { skipped++; continue; }
      if (s.already_bid) { alreadyBid++; continue; }
      if (s.is_sourceable && !s.bid_status && open) sourceable++;
    }
    return { total: solicitations.length, sourceable, quoted, submitted, skipped, alreadyBid, llActive, dibbsOnly };
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

  const filtered = useMemo(() => {
    let items = solicitations.filter((s) => {
      // Single source of truth for "is this sol still open" — same helper
      // the dashboard and server-side counts use. Don't re-implement.
      const isOpen = isOpenSolicitation(s.return_by_date);

      if (filter === "sourceable") return s.is_sourceable && !s.bid_status && !s.already_bid && isOpen;
      if (filter === "new_only") return s.is_sourceable && !s.bid_status && !s.already_bid && isOpen;
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

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const yesterday = new Date(now.getTime() - 86400000).toISOString().split("T")[0];
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];

      items = items.filter((s) => {
        const issueDate = s.issue_date || "";
        const dueDate = s.return_by_date || "";
        if (dateFilter === "today") {
          return issueDate.includes(today.replace(/-/g, "-").slice(5)) || issueDate.includes(today.slice(5).replace("-", "-"));
        }
        if (dateFilter === "yesterday") {
          return issueDate.includes(yesterday.slice(5).replace(/-0?/, "-")) || issueDate.includes(today.slice(5).replace(/-0?/, "-"));
        }
        if (dateFilter === "this_week") {
          // Compare MM-DD-YYYY format
          const parseDate = (d: string) => {
            const parts = d.split("-");
            if (parts.length === 3 && parts[2].length === 4) return new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
            return new Date(d);
          };
          const issued = parseDate(issueDate);
          return issued >= new Date(weekAgo);
        }
        if (dateFilter === "closing_soon") {
          const parseDate = (d: string) => {
            const parts = d.split("-");
            if (parts.length === 3 && parts[2].length === 4) return new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
            return new Date(d);
          };
          const due = parseDate(dueDate);
          const threeDays = new Date(now.getTime() + 3 * 86400000);
          return due <= threeDays && due >= now;
        }
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

      {/* Pipeline Stats */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-2">
        {[
          { key: "sourceable", label: "Sourceable", count: counts.sourceable, color: "border-green-300 bg-green-50", icon: Zap },
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
          { key: "all_unsourced", label: "No Source", count: counts.total - counts.sourceable - counts.quoted - counts.submitted - counts.skipped - counts.alreadyBid, color: "border-amber-200 bg-amber-50 text-amber-800" },
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
          {filter === "sourceable" && filtered.length > 0 && (
            <>
              <button
                onClick={() => {
                  const ids = filtered
                    .filter((s) => s.is_sourceable && !s.bid_status && !s.already_bid && (s.suggested_price ?? 0) > 0)
                    .map((s) => s.id);
                  setSelectedSourceable(
                    selectedSourceable.size === ids.length ? new Set() : new Set(ids)
                  );
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-card-border bg-card-bg"
              >
                {selectedSourceable.size > 0 ? `Deselect (${selectedSourceable.size})` : "Select All"}
              </button>
              {selectedSourceable.size > 0 && (
                <button
                  onClick={handleQuoteSelectedAtSuggested}
                  disabled={bulkQuoting}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white disabled:opacity-50"
                >
                  {bulkQuoting ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}
                  Quote {selectedSourceable.size} at Suggested
                </button>
              )}
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
            { key: "today", label: "Today" },
            { key: "yesterday", label: "Today+Yesterday" },
            { key: "this_week", label: "This Week" },
            { key: "closing_soon", label: "Closing Soon" },
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
        <select value={fscFilter} onChange={(e) => setFscFilter(e.target.value)}
          className="rounded border border-card-border px-2 py-1 text-[10px] bg-white">
          <option value="all">All FSCs</option>
          {[...new Set(solicitations.map(s => s.fsc).filter(Boolean))].sort().map(fsc => (
            <option key={fsc} value={fsc}>{fsc}</option>
          ))}
        </select>
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
          <span className="font-semibold">Data sources:</span>
          <span><span className="px-1 rounded bg-cyan-50 text-cyan-700 font-medium">LL</span> = LamLinks import</span>
          <span><span className="px-1 rounded bg-gray-100 text-gray-600">no LL badge</span> = DIBBS scrape</span>
          <span>Cost source shown under $ — <span className="text-green-700">AX price agreement</span> / Recent PO / MDB</span>
          <span><span className="px-1 rounded bg-green-100 text-green-700">P/N Match</span> = PUB LOG match</span>
          <span><span className="px-1 rounded bg-purple-100 text-purple-700">Bid in LL</span> = Abe already bid via LamLinks</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted bg-gray-50/50">
                {(filter === "quoted" || filter === "sourceable") && <th className="px-3 py-2 w-8"></th>}
                <th className="px-3 py-2 font-medium" title="NSN from DIBBS scrape or LamLinks (k08); nomenclature from DIBBS. Item metadata after enrichment comes from PUB LOG + AX ProductBarcodesV3.">NSN / Item</th>
                <th className="px-3 py-2 font-medium" title="Solicitation number from DIBBS / LamLinks k10.sol_no_k10 — matches exactly across sources.">Sol #</th>
                <th className="px-3 py-2 text-right" title="Quantity solicited, from DIBBS line data."><SortHeader field="quantity">Qty</SortHeader></th>
                <th className="px-3 py-2 text-right font-medium" title="Our unit cost from nsn_costs (waterfall: Recent PO → Older PO → AX price agreement → Master DB). Source tag shown under $ amount.">Cost</th>
                <th className="px-3 py-2 text-right" title="Computed by DIBS: winning-bid history if recent wins exist for this NSN, else bracket markup (2.00× under $25, 1.36× $25-100, 1.21× $100-500, 1.16× $500+). See /wiki/pricing-logic."><SortHeader field="price">Suggested</SortHeader></th>
                <th className="px-3 py-2 text-right" title="Computed by DIBS: (suggested − cost) / suggested. FOB-Destination lines subtract shipping first."><SortHeader field="margin">Margin</SortHeader></th>
                <th className="px-3 py-2 text-right" title="Computed: suggested × quantity. What we'd win if this bid succeeds at suggested price."><SortHeader field="value">Pot. Value</SortHeader></th>
                <th className="px-3 py-2 text-center" title="DIBS AI score 0-100: cost confidence + margin quality + win probability (FSC heatmap) + value + timing. See /wiki/bidding-workflow."><SortHeader field="score">Score</SortHeader></th>
                <th className="px-3 py-2 font-medium" title="Freight terms from DIBBS solicitation line — D=Destination (we pay shipping), O=Origin (buyer pays).">FOB</th>
                <th className="px-3 py-2" title="Response-by date from DIBBS / LamLinks k10.closes_k10."><SortHeader field="due">Due</SortHeader></th>
                <th className="px-3 py-2 font-medium" title="Which data source flagged this solicitation — LL (LamLinks import, covers our subscribed 240 FSCs) or DIBBS (our scrape, covers the other 224).">Channel</th>
                <th className="px-3 py-2 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
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
                      {filter === "sourceable" && (
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedSourceable.has(s.id)}
                            disabled={!s.is_sourceable || !!s.bid_status || !!s.already_bid || !s.suggested_price}
                            title={!s.suggested_price ? "No suggested price — can't auto-quote" : ""}
                            onChange={(e) => {
                              const next = new Set(selectedSourceable);
                              if (e.target.checked) next.add(s.id); else next.delete(s.id);
                              setSelectedSourceable(next);
                            }}
                            className="rounded"
                          />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {(history.length > 0 || abeBids.length > 0) && (
                            <button onClick={() => setExpandedNsn(expandedNsn === s.nsn ? null : s.nsn)}
                              className="text-muted hover:text-accent" title={`${abeBids.length} bids, ${history.length} awards`}>
                              <History className="h-3 w-3" />
                              <span className="text-[8px]">{abeBids.length + history.length}</span>
                            </button>
                          )}
                          <div>
                            <span className="font-mono text-xs text-accent">{s.nsn}</span>
                            {s.bid_status && (
                              <span className={`ml-1 text-[10px] px-1 rounded ${
                                s.bid_status === "quoted" ? "bg-blue-100 text-blue-700" :
                                s.bid_status === "submitted" ? "bg-purple-100 text-purple-700" :
                                "bg-gray-100 text-gray-600"
                              }`}>{s.bid_status.toUpperCase()}</span>
                            )}
                            <div className="text-xs truncate max-w-[180px]">{s.nomenclature || "—"}</div>
                            {s.already_bid && (
                              <span className="text-[9px] px-1 rounded bg-purple-100 text-purple-700 font-medium" title={`Last bid: $${s.last_bid_price?.toFixed(2)} on ${formatDateShort(s.last_bid_date)}`}>
                                Bid in LL ${s.last_bid_price ? `@$${s.last_bid_price.toFixed(2)}` : ''}
                              </span>
                            )}
                            {s.procurement_type && s.procurement_type !== "RFQ" && (
                              <span className="text-[9px] px-1 rounded bg-indigo-100 text-indigo-700 font-medium">{s.procurement_type}</span>
                            )}
                            {s.set_aside && !["None", "none", "no", "No", "N/A", ""].includes(s.set_aside?.trim()) && (
                              <span className="text-[9px] px-1 rounded bg-amber-50 text-amber-700">{s.set_aside}</span>
                            )}
                            {s.data_source === "lamlinks" && (
                              <span className="text-[9px] px-1 rounded bg-cyan-50 text-cyan-700 font-medium">LL</span>
                            )}
                            {(s as any).nsn_match && (
                              <span className={`text-[9px] px-1 rounded font-medium ${
                                (s as any).nsn_match.confidence === "HIGH" ? "bg-green-100 text-green-700" :
                                (s as any).nsn_match.confidence === "MEDIUM" ? "bg-yellow-100 text-yellow-700" :
                                "bg-gray-100 text-gray-600"
                              }`} title={`${(s as any).nsn_match.match_type}: ${(s as any).nsn_match.matched_part_number} — ${(s as any).nsn_match.matched_description}`}>
                                {(s as any).nsn_match.confidence === "HIGH" ? "P/N Match" : "~Match"}
                              </span>
                            )}
                            {(s.award_count ?? 0) > 0 && (
                              <span className="text-[9px] px-1 rounded bg-orange-50 text-orange-700" title={s.competitor_cage || ""}>{s.award_count} competitors</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted">{s.solicitation_number}</td>
                      <td className="px-3 py-2 text-right">{s.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-muted">
                        {s.our_cost ? `$${s.our_cost.toFixed(2)}` : "—"}
                        {s.cost_source && <div className="text-[9px] text-muted/60 truncate max-w-[80px]">{s.cost_source}</div>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-green-600" title={s.price_source || ""}>
                        {s.bid_status === "quoted" || s.bid_status === "submitted"
                          ? `$${(s.final_price || 0).toFixed(2)}`
                          : s.suggested_price ? `$${s.suggested_price.toFixed(2)}` : "—"}
                        {s.price_source && !s.bid_status && (
                          <div className="text-[9px] text-muted/60 font-normal truncate max-w-[100px]">{s.price_source}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {s.margin_pct !== null ? (
                          <span className={`text-xs font-medium ${s.margin_pct >= 20 ? "text-green-600" : s.margin_pct >= 10 ? "text-yellow-600" : "text-red-600"}`}>
                            {s.margin_pct}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-bold">
                        {potValue > 0 ? (
                          <>
                            ${potValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {!s.is_sourceable && s.last_award_price && (
                              <div className="text-[9px] text-muted font-normal">est. from award</div>
                            )}
                          </>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
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
                      </td>
                      <td className="px-3 py-2 text-center">
                        {s.fob ? (
                          <span className={`text-[10px] font-medium px-1 rounded ${s.fob === "D" ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-600"}`}>
                            {s.fob === "D" ? "Dest" : "Orig"}
                          </span>
                        ) : "—"}
                        {s.est_shipping && s.fob === "D" && (
                          <div className="text-[9px] text-muted">~${s.est_shipping} ship</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">{s.return_by_date}</td>
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
                        <td colSpan={filter === "quoted" ? 12 : 11} className="px-3 py-2">
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
                        <td colSpan={filter === "quoted" ? 12 : 11} className="px-3 py-2">
                          <NsnHistoryDetail nsn={s.nsn} />
                        </td>
                      </tr>
                    )}

                    {/* Detail / Bid Panel */}
                    {detailId === s.id && (
                      <tr key={`detail-${s.id}`} className="border-b border-card-border bg-white">
                        <td colSpan={filter === "quoted" ? 12 : 11} className="p-0">
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
                                {filtered.indexOf(s) < filtered.length - 1 && (
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
                                      <Check className="h-3 w-3" /> Approve & Next
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

                            {/* Item Spec + Part Number Matches (from lazy-loaded data) */}
                            {(() => {
                              const cached = historyCache.get(s.nsn);
                              const spec = (cached as any)?.itemSpec;
                              const matches = (cached as any)?.matches;
                              if (!spec && !matches?.length) return null;
                              return (
                                <div className="grid md:grid-cols-2 gap-3 mb-3">
                                  {spec && (
                                    <div className="bg-gray-50 rounded-lg p-2 border border-card-border text-xs">
                                      <div className="text-[10px] font-bold text-gray-600 mb-1">Item Details (LamLinks)</div>
                                      {spec.item_name && <div>{spec.item_name}</div>}
                                      <div className="grid grid-cols-2 gap-1 mt-1 text-[10px] text-muted">
                                        {spec.part_number && <div>P/N: <span className="font-mono">{spec.part_number}</span></div>}
                                        {spec.cage_code && <div>CAGE: <span className="font-mono">{spec.cage_code}</span></div>}
                                        {spec.unit_price > 0 && <div>LL Price: ${spec.unit_price}</div>}
                                        {spec.unit_of_issue && <div>UoI: {spec.unit_of_issue}</div>}
                                      </div>
                                    </div>
                                  )}
                                  {matches?.length > 0 && (
                                    <div className="bg-yellow-50 rounded-lg p-2 border border-yellow-200 text-xs">
                                      <div className="text-[10px] font-bold text-yellow-700 mb-1">Part Number Matches ({matches.length})</div>
                                      {matches.map((m: any, i: number) => (
                                        <div key={i} className="flex items-center gap-2 text-[10px] mt-0.5">
                                          <span className={`px-1 rounded font-medium ${m.confidence === "HIGH" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{m.confidence}</span>
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

                            {/* History (Our Awards / Competitor Awards / Our Bids / P/N matches)
                                — same shared component used on /bids/today so both
                                pages always render the same data layout. */}
                            <NsnHistoryDetail nsn={s.nsn} />
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Supplier Search Results */}
                    {supplierSearchId === s.id && (
                      <tr key={`sup-${s.id}`} className="border-b border-card-border bg-indigo-50/20">
                        <td colSpan={filter === "quoted" ? 12 : 11} className="px-3 py-3">
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

                              {supplierResults.webResults?.length === 0 && supplierResults.vendorPrices?.length === 0 && supplierResults.pastWinners?.length === 0 && (
                                <div className="text-xs text-muted py-2">No suppliers found. Try a different search term.</div>
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

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted">
            <p className="text-lg font-medium">
              {filter === "sourceable" ? "No sourceable solicitations" :
               filter === "quoted" ? "No quoted bids yet" :
               "No solicitations"}
            </p>
            <p className="text-sm mt-1">
              {filter === "sourceable" ? 'Click "Scrape Now" then "Match NSNs"' : "Review sourceable items first"}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
