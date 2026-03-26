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

  async function handleScrapeNow() {
    setScraping(true);
    setMessage("Syncing — scraping DIBBS for new solicitations...");
    try {
      const res = await fetch("/api/dibbs/scrape-now", { method: "POST" });
      const data = await res.json();
      const enrichInfo = data.enrich;
      if (data.count > 0 || enrichInfo) {
        const parts = [];
        if (data.count > 0) parts.push(`${data.count} solicitations scraped`);
        if (enrichInfo?.sourceable) parts.push(`${enrichInfo.sourceable} sourceable`);
        if (enrichInfo?.already_bid) parts.push(`${enrichInfo.already_bid} already bid in LL`);
        if (enrichInfo?.with_cost_data) parts.push(`${enrichInfo.with_cost_data} with cost data`);
        setMessage(`Sync complete: ${parts.join(" · ")}. Refreshing...`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        // Scrape found nothing, run enrich anyway for existing items
        setMessage("No new solicitations. Running analysis on existing...");
        setEnriching(true);
        await handleEnrich();
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch {
      setMessage("Sync failed — check connection");
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
      if (filter === "sourceable") return s.is_sourceable && !s.bid_status;
      if (filter === "quoted") return s.bid_status === "quoted";
      if (filter === "submitted") return s.bid_status === "submitted";
      if (filter === "skipped") return s.bid_status === "skipped";
      if (filter === "all_unsourced") return !s.is_sourceable;
      if (filter === "new_only") return s.is_sourceable && !s.bid_status && !s.already_bid;
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
      _potentialValue: (s.suggested_price || s.final_price || 0) * (s.quantity || 1),
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
  }, [solicitations, filter, sortField, sortAsc]);

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
          { key: "new_only", label: "New (not bid)", count: counts.total, color: "border-teal-200 bg-teal-50", icon: Zap },
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
          {lastSync && (
            <div className="text-[10px] text-muted text-right">
              <div>Last sync: {new Date(lastSync.created_at).toLocaleString()}</div>
              <div>
                {lastSync.details?.sourceable && `${lastSync.details.sourceable} sourceable`}
                {lastSync.details?.already_bid && ` · ${lastSync.details.already_bid} already bid`}
                {lastSync.details?.count && ` · ${lastSync.details.count} scraped`}
              </div>
            </div>
          )}
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
                const potValue = (s.suggested_price || s.final_price || 0) * (s.quantity || 1);
                const isEditing = editingId === s.id;
                const history = historyByNsn.get(s.nsn) || [];
                const abeBids = abeBidsByNsn.get(s.nsn) || [];

                return (
                  <>
                    <tr
                      key={s.id}
                      className={`border-b border-card-border hover:bg-gray-50/50 ${
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
                        {potValue > 0 ? `$${potValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
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
                        {s.is_sourceable && !s.bid_status && !isEditing && (
                          <button onClick={() => { setEditingId(s.id); setEditPrice(s.suggested_price?.toFixed(2) || ""); }}
                            className="text-[10px] px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-medium">
                            Bid
                          </button>
                        )}
                        {s.bid_comment && (
                          <div className="text-[9px] text-yellow-700 mt-0.5 flex items-center gap-0.5">
                            <MessageSquare className="h-2 w-2" />{s.bid_comment}
                          </div>
                        )}
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
