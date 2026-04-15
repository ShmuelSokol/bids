"use client";

import { useState, useMemo } from "react";
import { Search, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { formatTime } from "@/lib/dates";
import { NsnHistoryDetail } from "@/components/nsn-history-detail";

type Bid = {
  id: number;
  bid_time: string | null;
  nsn: string | null;
  fsc: string | null;
  item_desc: string | null;
  bid_price: number | null;
  bid_qty: number | null;
  lead_days: number | null;
  fob: string | null;
  bid_status: string | null;
  solicitation_number: string | null;
  part_number: string | null;
};

type SortField = "bid_time" | "nsn" | "fsc" | "bid_price" | "bid_qty" | "value" | "lead_days" | "bid_status";

export function TodayBidsTable({ bids }: { bids: Bid[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("bid_time");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = bids.filter((b) => {
      if (statusFilter !== "all" && b.bid_status !== statusFilter) return false;
      if (!q) return true;
      return (
        (b.nsn || "").toLowerCase().includes(q) ||
        (b.fsc || "").toLowerCase().includes(q) ||
        (b.item_desc || "").toLowerCase().includes(q) ||
        (b.solicitation_number || "").toLowerCase().includes(q) ||
        (b.part_number || "").toLowerCase().includes(q)
      );
    });

    rows = [...rows].sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      const va = sortValue(a, sortField);
      const vb = sortValue(b, sortField);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });

    return rows;
  }, [bids, search, statusFilter, sortField, sortAsc]);

  const visibleValue = filtered.reduce(
    (s, b) => s + (Number(b.bid_price) || 0) * (Number(b.bid_qty) || 1),
    0
  );

  function handleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  return (
    <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
      {/* Filter bar */}
      <div className="px-4 py-3 border-b border-card-border flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search NSN, item, sol #, part #, FSC..."
            className="w-full rounded-lg border border-card-border bg-white pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {[
            { key: "all", label: "All" },
            { key: "submitted", label: "Submitted" },
            { key: "pending", label: "Pending" },
          ].map((b) => (
            <button
              key={b.key}
              onClick={() => setStatusFilter(b.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                statusFilter === b.key
                  ? "bg-accent text-white border-accent"
                  : "bg-white border-card-border text-muted hover:text-foreground"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="text-xs text-muted">
          {filtered.length} of {bids.length} ·{" "}
          <span className="font-mono text-foreground">
            ${visibleValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border text-left text-muted bg-gray-50 sticky top-0">
              <th className="px-4 py-2 font-medium">
                <SortBtn field="bid_time" current={sortField} asc={sortAsc} onClick={handleSort}>
                  Time
                </SortBtn>
              </th>
              <th className="px-4 py-2 font-medium">
                <SortBtn field="nsn" current={sortField} asc={sortAsc} onClick={handleSort}>
                  NSN
                </SortBtn>
              </th>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Sol #</th>
              <th className="px-4 py-2 font-medium text-right">
                <SortBtn field="bid_price" current={sortField} asc={sortAsc} onClick={handleSort}>
                  Price
                </SortBtn>
              </th>
              <th className="px-4 py-2 font-medium text-right">
                <SortBtn field="bid_qty" current={sortField} asc={sortAsc} onClick={handleSort}>
                  Qty
                </SortBtn>
              </th>
              <th className="px-4 py-2 font-medium text-right">
                <SortBtn field="value" current={sortField} asc={sortAsc} onClick={handleSort}>
                  Value
                </SortBtn>
              </th>
              <th className="px-4 py-2 font-medium">
                <SortBtn field="lead_days" current={sortField} asc={sortAsc} onClick={handleSort}>
                  Lead
                </SortBtn>
              </th>
              <th className="px-4 py-2 font-medium">FOB</th>
              <th className="px-4 py-2 font-medium">
                <SortBtn field="bid_status" current={sortField} asc={sortAsc} onClick={handleSort}>
                  Status
                </SortBtn>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => {
              const value = (b.bid_price || 0) * (b.bid_qty || 1);
              const expanded = expandedId === b.id;
              return (
                <>
                  <tr
                    key={b.id}
                    onClick={() => setExpandedId(expanded ? null : b.id)}
                    className={`border-b border-card-border/50 cursor-pointer ${
                      expanded ? "bg-blue-50/40" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-4 py-1.5 text-xs text-muted whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {expanded ? (
                          <ChevronDown className="h-3 w-3 text-accent" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted/60" />
                        )}
                        {formatTime(b.bid_time)}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 font-mono text-xs text-accent whitespace-nowrap">
                      {b.nsn || "—"}
                    </td>
                    <td className="px-4 py-1.5 text-xs truncate max-w-[260px]" title={b.item_desc || ""}>
                      {b.item_desc || "—"}
                    </td>
                    <td className="px-4 py-1.5 font-mono text-[10px] text-muted whitespace-nowrap">
                      {b.solicitation_number?.trim() || "—"}
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono text-xs">
                      ${(b.bid_price || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-1.5 text-right text-xs">{b.bid_qty || 0}</td>
                    <td className="px-4 py-1.5 text-right font-mono text-xs font-medium text-blue-700">
                      ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-1.5 text-xs text-muted">{b.lead_days ?? "—"}d</td>
                    <td className="px-4 py-1.5 text-xs text-muted">{b.fob || "—"}</td>
                    <td className="px-4 py-1.5">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          b.bid_status === "submitted"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {b.bid_status || "pending"}
                      </span>
                    </td>
                  </tr>
                  {expanded && b.nsn && (
                    <tr className="bg-blue-50/20">
                      <td colSpan={10} className="px-4 py-3 border-b border-card-border">
                        <NsnHistoryDetail nsn={b.nsn} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-muted">No bids match your filter.</div>
        )}
      </div>
    </div>
  );
}

function sortValue(b: Bid, f: SortField): string | number | null {
  switch (f) {
    case "bid_time":
      return b.bid_time ? new Date(b.bid_time).getTime() : null;
    case "value":
      return (b.bid_price || 0) * (b.bid_qty || 1);
    case "nsn":
      return b.nsn || "";
    case "fsc":
      return b.fsc || "";
    case "bid_status":
      return b.bid_status || "";
    case "bid_price":
      return b.bid_price ?? null;
    case "bid_qty":
      return b.bid_qty ?? null;
    case "lead_days":
      return b.lead_days ?? null;
  }
}

function SortBtn({
  field,
  current,
  asc,
  onClick,
  children,
}: {
  field: SortField;
  current: SortField;
  asc: boolean;
  onClick: (f: SortField) => void;
  children: React.ReactNode;
}) {
  const active = current === field;
  return (
    <button
      onClick={() => onClick(field)}
      className={`flex items-center gap-1 ${active ? "text-accent" : ""}`}
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${active ? "" : "opacity-40"}`} />
      {active && <span className="text-[8px]">{asc ? "↑" : "↓"}</span>}
    </button>
  );
}
