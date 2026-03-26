"use client";

import { useState, useMemo } from "react";
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

type SortField = "value" | "margin" | "due" | "price" | "quantity";

export function SolicitationsList({
  initialData,
  counts: initialCounts,
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
  const [counts, setCounts] = useState(initialCounts);
  const [filter, setFilter] = useState<string>(initialFilter || "sourceable");
  const [sortField, setSortField] = useState<SortField>((initialSort as SortField) || "value");
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
  const [supplierSearchId, setSupplierSearchId] = useState<number | null>(null);
  const [supplierResults, setSupplierResults] = useState<any>(null);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  // Build award history lookup
  const historyByNsn = useMemo(() => {
    const map = new Map<string, AwardHistory[]>();
    for (const a of awardHistory) {
      const nsn = `${a.fsc}-${a.niin}`;
      if (!map.has(nsn)) map.set(nsn, []);
      map.get(nsn)!.push(a);
    }
    return map;
  }, [awardHistory]);

  // Build Abe's bid history lookup
  const abeBidsByNsn = useMemo(() => {
    const map = new Map<string, AbeBid[]>();
    for (const b of abeBidHistory) {
      if (!map.has(b.nsn)) map.set(b.nsn, []);
      map.get(b.nsn)!.push(b);
    }
    return map;
  }, [abeBidHistory]);

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

  async function handleScrapeNow() {
    setScraping(true);
    setMessage("Step 1/3: Scraping DIBBS for new solicitations...");
    try {
      const scrapeRes = await fetch("/api/dibbs/scrape-now", { method: "POST" });
      const scrapeData = await scrapeRes.json();
      const scraped = scrapeData.count || 0;

      setMessage(`Step 2/3: Found ${scraped} solicitations. Matching NSNs + pricing...`);
      setEnriching(true);
      const enrichRes = await fetch("/api/dibbs/enrich", { method: "POST" });
      const enrichData = await enrichRes.json();
      setEnriching(false);

      const parts = [`${scraped} scraped`];
      if (enrichData.sourceable) parts.push(`${enrichData.sourceable} sourceable`);
      if (enrichData.with_cost_data) parts.push(`${enrichData.with_cost_data} with costs`);
      if (enrichData.already_bid) parts.push(`${enrichData.already_bid} already bid`);

      setMessage(`Step 3/3: Sync complete! ${parts.join(" · ")}. Refreshing...`);
      setTimeout(() => window.location.reload(), 2000);
    } catch {
      setMessage("Sync failed — check connection");
    } finally {
      setScraping(false);
      setEnriching(false);
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    try {
      const res = await fetch("/api/dibbs/enrich", { method: "POST" });
      const data = await res.json();
      setMessage(
        `Found ${data.sourceable} sourceable (${data.with_cost_data || 0} with cost data)`
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
      setCounts((c) => ({ ...c, sourceable: c.sourceable - 1, skipped: c.skipped + 1 }));
      advanceDetail(sol.id);
      setEditingId(null);
      setEditComment("");
    } catch {} finally { setSaving(false); }
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
            status: "submitted",
            final_price: sol.final_price,
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
    } catch {} finally { setSubmitting(false); }
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  const filtered = useMemo(() => {
    let items = solicitations.filter((s) => {
      // Parse return_by_date (MM-DD-YYYY format from DIBBS)
      const isOpen = (() => {
        if (!s.return_by_date) return true;
        const parts = s.return_by_date.split("-");
        if (parts.length === 3 && parts[2].length === 4) {
          const d = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
          return d >= new Date(new Date().toDateString());
        }
        return new Date(s.return_by_date) >= new Date(new Date().toDateString());
      })();

      if (filter === "sourceable") return s.is_sourceable && !s.bid_status && !s.already_bid && isOpen;
      if (filter === "new_only") return s.is_sourceable && !s.bid_status && !s.already_bid && isOpen;
      if (filter === "already_bid") return s.already_bid;
      if (filter === "quoted") return s.bid_status === "quoted";
      if (filter === "submitted") return s.bid_status === "submitted";
      if (filter === "skipped") return s.bid_status === "skipped";
      if (filter === "all_unsourced") return !s.is_sourceable && isOpen;
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

    // Add potential_value for sorting
    items = items.map((s) => ({
      ...s,
      _potentialValue: s.est_value || (s.suggested_price || s.final_price || 0) * (s.quantity || 1),
    }));

    // Sort
    const dir = sortAsc ? 1 : -1;
    items.sort((a, b) => {
      const av = a as any, bv = b as any;
      switch (sortField) {
        case "value": return (av._potentialValue - bv._potentialValue) * dir;
        case "margin": return ((a.margin_pct || 0) - (b.margin_pct || 0)) * dir;
        case "due": return ((a.return_by_date || "").localeCompare(b.return_by_date || "")) * dir;
        case "price": return ((a.suggested_price || 0) - (b.suggested_price || 0)) * dir;
        case "quantity": return ((a.quantity || 0) - (b.quantity || 0)) * dir;
        default: return 0;
      }
    });

    return items;
  }, [solicitations, filter, sortField, sortAsc, searchQuery, dateFilter]);

  const filteredTotalValue = useMemo(() => {
    return filtered.reduce((sum, s) => sum + ((s as any)._potentialValue || s.est_value || 0), 0);
  }, [filtered]);

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
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        {[
          { key: "sourceable", label: "Sourceable", count: counts.sourceable, color: "border-green-300 bg-green-50", icon: Zap },
          { key: "quoted", label: "Quoted", count: counts.quoted, color: "border-blue-300 bg-blue-50", icon: DollarSign },
          { key: "submitted", label: "Submitted", count: counts.submitted, color: "border-purple-300 bg-purple-50", icon: Send },
          { key: "skipped", label: "Skipped", count: counts.skipped, color: "border-gray-300 bg-gray-50", icon: X },
          { key: "all_unsourced", label: "No Source", count: counts.total - counts.sourceable - counts.quoted - counts.submitted - counts.skipped, color: "border-amber-200 bg-amber-50", icon: Package },
          { key: "already_bid", label: "Bid in LL", count: solicitations.filter(s => s.already_bid).length, color: "border-purple-200 bg-purple-50", icon: Check },
          { key: "all", label: "All", count: counts.total, color: "border-card-border bg-card-bg", icon: Package },
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
                <button
                  onClick={handleSubmitAll}
                  disabled={submitting}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Submit {selectedQuoted.size} Bids
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-muted text-right">
            {lastSync && (
              <>
                <div>Last sync: {new Date(lastSync.created_at).toLocaleString()}</div>
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
        {(searchQuery || dateFilter !== "all") && (
          <span className="text-xs text-muted">{filtered.length} results</span>
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted bg-gray-50/50">
                {filter === "quoted" && <th className="px-3 py-2 w-8"></th>}
                <th className="px-3 py-2 font-medium">NSN / Item</th>
                <th className="px-3 py-2 font-medium">Sol #</th>
                <th className="px-3 py-2 text-right"><SortHeader field="quantity">Qty</SortHeader></th>
                <th className="px-3 py-2 text-right font-medium">Cost</th>
                <th className="px-3 py-2 text-right"><SortHeader field="price">Suggested</SortHeader></th>
                <th className="px-3 py-2 text-right"><SortHeader field="margin">Margin</SortHeader></th>
                <th className="px-3 py-2 text-right"><SortHeader field="value">Pot. Value</SortHeader></th>
                <th className="px-3 py-2 font-medium">FOB</th>
                <th className="px-3 py-2"><SortHeader field="due">Due</SortHeader></th>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const potValue = (s as any)._potentialValue || s.est_value || (s.suggested_price || s.final_price || 0) * (s.quantity || 1);
                const isEditing = editingId === s.id;
                const history = historyByNsn.get(s.nsn) || [];
                const abeBids = abeBidsByNsn.get(s.nsn) || [];

                return (
                  <>
                    <tr
                      key={s.id}
                      onClick={() => setDetailId(detailId === s.id ? null : s.id)}
                      className={`border-b border-card-border hover:bg-gray-50/50 cursor-pointer ${
                        detailId === s.id ? "bg-accent/5 ring-1 ring-accent/20" :
                        s.bid_status === "submitted" ? "bg-purple-50/30" :
                        s.bid_status === "quoted" ? "bg-blue-50/30" :
                        s.bid_status === "skipped" ? "opacity-40" : ""
                      }`}
                    >
                      {filter === "quoted" && (
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedQuoted.has(s.id)}
                            onChange={(e) => {
                              const next = new Set(selectedQuoted);
                              if (e.target.checked) next.add(s.id); else next.delete(s.id);
                              setSelectedQuoted(next);
                            }} className="rounded" />
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
                              <span className="text-[9px] px-1 rounded bg-purple-100 text-purple-700 font-medium" title={`Last bid: $${s.last_bid_price?.toFixed(2)} on ${s.last_bid_date ? new Date(s.last_bid_date).toLocaleDateString() : '?'}`}>
                                Bid in LL ${s.last_bid_price ? `@$${s.last_bid_price.toFixed(2)}` : ''}
                              </span>
                            )}
                            {s.procurement_type && s.procurement_type !== "RFQ" && (
                              <span className="text-[9px] px-1 rounded bg-indigo-100 text-indigo-700 font-medium">{s.procurement_type}</span>
                            )}
                            {s.set_aside && s.set_aside !== "None" && (
                              <span className="text-[9px] px-1 rounded bg-amber-50 text-amber-700">{s.set_aside}</span>
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

                    {/* Bid + Award history expansion */}
                    {expandedNsn === s.nsn && (history.length > 0 || abeBids.length > 0) && (
                      <tr key={`hist-${s.id}`} className="border-b border-card-border bg-blue-50/20">
                        <td colSpan={filter === "quoted" ? 12 : 11} className="px-3 py-2">
                          <div className="grid md:grid-cols-2 gap-4">
                            {/* Abe's Bids */}
                            <div>
                              <div className="text-xs font-medium text-green-700 mb-1">
                                Abe&apos;s Bids ({abeBids.length})
                              </div>
                              {abeBids.length > 0 ? (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-muted">
                                      <th className="text-left py-1">Date</th>
                                      <th className="text-right py-1">Bid Price</th>
                                      <th className="text-right py-1">Days</th>
                                      <th className="text-right py-1">Qty</th>
                                      <th className="text-center py-1">FOB</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {abeBids.slice(0, 8).map((b, i) => (
                                      <tr key={i} className="border-t border-card-border/50">
                                        <td className="py-1 text-muted">{b.bid_date ? new Date(b.bid_date).toLocaleDateString() : "—"}</td>
                                        <td className="py-1 text-right font-mono font-medium text-green-700">${b.bid_price?.toFixed(2)}</td>
                                        <td className="py-1 text-right">{b.lead_time_days}d</td>
                                        <td className="py-1 text-right">{b.bid_qty}</td>
                                        <td className="py-1 text-center">{b.fob || "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-xs text-muted">No prior bids</p>
                              )}
                            </div>

                            {/* Awards */}
                            <div>
                              <div className="text-xs font-medium text-blue-700 mb-1">
                                Award History ({history.length})
                              </div>
                              {history.length > 0 ? (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-muted">
                                      <th className="text-left py-1">Date</th>
                                      <th className="text-right py-1">Award Price</th>
                                      <th className="text-right py-1">Qty</th>
                                      <th className="text-left py-1">Winner</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {history.slice(0, 8).map((h, i) => (
                                      <tr key={i} className="border-t border-card-border/50">
                                        <td className="py-1 text-muted">{h.award_date ? new Date(h.award_date).toLocaleDateString() : "—"}</td>
                                        <td className="py-1 text-right font-mono font-medium text-blue-700">${h.unit_price?.toFixed(2)}</td>
                                        <td className="py-1 text-right">{h.quantity}</td>
                                        <td className="py-1 font-mono text-xs">{h.cage?.trim() || "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-xs text-muted">No awards on record</p>
                              )}
                            </div>
                          </div>
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
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={(e) => { e.stopPropagation(); handleFindSuppliers(s); }}
                                  className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-medium">
                                  Find Suppliers
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
                                  {s.source && <div>Matched: <span className={`px-1 rounded font-medium ${s.source === "ax" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{s.source === "ax" ? "via AX" : "via Master"}</span></div>}
                                  {s.cost_source && <div className="text-muted">Cost: {s.cost_source}</div>}
                                  {s.channel === "dibbs_only" && <div><span className="px-1 rounded bg-orange-100 text-orange-700 font-medium">DIBBS only — not in LamLinks</span></div>}
                                  {s.already_bid && <div className="text-purple-700 font-medium">Already bid in LamLinks @${s.last_bid_price?.toFixed(2)}</div>}
                                </div>
                              </div>
                            </div>

                            {/* Bid History */}
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs font-bold text-green-700 mb-1">Ever Ready Bid History ({abeBids.length})</div>
                                {abeBids.length > 0 ? (
                                  <div className="max-h-40 overflow-auto">
                                    <table className="w-full text-xs">
                                      <thead><tr className="text-muted"><th className="text-left py-0.5">Date</th><th className="text-right py-0.5">Price</th><th className="text-right py-0.5">Days</th><th className="text-right py-0.5">Qty</th></tr></thead>
                                      <tbody>
                                        {abeBids.map((b, i) => (
                                          <tr key={i} className="border-t border-card-border/30">
                                            <td className="py-0.5 text-muted">{b.bid_date ? new Date(b.bid_date).toLocaleDateString() : "—"}</td>
                                            <td className="py-0.5 text-right font-mono text-green-700">${b.bid_price?.toFixed(2)}</td>
                                            <td className="py-0.5 text-right">{b.lead_time_days}d</td>
                                            <td className="py-0.5 text-right">{b.bid_qty}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : <p className="text-xs text-muted">No prior bids</p>}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-blue-700 mb-1">Award History ({history.length})</div>
                                {history.length > 0 ? (
                                  <div className="max-h-40 overflow-auto">
                                    <table className="w-full text-xs">
                                      <thead><tr className="text-muted"><th className="text-left py-0.5">Date</th><th className="text-right py-0.5">Price</th><th className="text-right py-0.5">Qty</th><th className="text-left py-0.5">Winner</th></tr></thead>
                                      <tbody>
                                        {history.map((h, i) => (
                                          <tr key={i} className="border-t border-card-border/30">
                                            <td className="py-0.5 text-muted">{h.award_date ? new Date(h.award_date).toLocaleDateString() : "—"}</td>
                                            <td className="py-0.5 text-right font-mono text-blue-700">${h.unit_price?.toFixed(2)}</td>
                                            <td className="py-0.5 text-right">{h.quantity}</td>
                                            <td className="py-0.5 font-mono">{h.cage?.trim() || "—"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : <p className="text-xs text-muted">No awards</p>}
                              </div>
                            </div>
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
