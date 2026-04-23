"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Package, Search } from "lucide-react";
import { formatDateTime } from "@/lib/dates";

interface InventoryRow {
  id: number;
  fsc: string;
  niin: string;
  nsn: string;
  description: string | null;
  lots: number;
  qty_on_hand: number;
  qty_reserved: number | null;
  qty_available: number | null;
  stock_value: number;
}

export function InventoryTable({
  items,
  lastSync,
  summary,
}: {
  items: InventoryRow[];
  lastSync: string | null;
  summary: any;
}) {
  const [search, setSearch] = useState("");
  const [fsc, setFsc] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (fsc !== "all" && r.fsc !== fsc) return false;
      if (q) {
        return (
          r.nsn.toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q) ||
          r.niin.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, search, fsc]);

  const fscOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of items) if (r.fsc) set.add(r.fsc);
    return [...set].sort();
  }, [items]);

  const totalUnits = items.reduce((s, r) => s + (r.qty_on_hand || 0), 0);

  return (
    <>
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Inventory</span>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Inventory on Hand</h1>
          <p className="text-muted text-sm mt-1">
            Aggregated from LamLinks k93_tab. {items.length.toLocaleString()} NSNs with stock, {totalUnits.toLocaleString()} total units.
            {lastSync && <span className="ml-2 text-[10px]">Last sync: {formatDateTime(lastSync)}</span>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border border-card-border bg-card-bg p-3">
          <div className="text-2xl font-bold">{items.length.toLocaleString()}</div>
          <div className="text-xs text-muted flex items-center gap-1"><Package className="h-3 w-3" /> NSNs stocked</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-2xl font-bold text-blue-700">{totalUnits.toLocaleString()}</div>
          <div className="text-xs text-muted">Total units</div>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
          <div className="text-2xl font-bold text-purple-700">
            {items.filter((r) => r.qty_on_hand >= 10_000).length}
          </div>
          <div className="text-xs text-muted">NSNs with 10K+ stock</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-2xl font-bold text-amber-700">
            {items.filter((r) => (r.qty_reserved || 0) > 0).length}
          </div>
          <div className="text-xs text-muted">NSNs with reservations</div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1 border border-card-border rounded-lg px-2 py-1">
          <Search className="h-3.5 w-3.5 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="NSN, NIIN, or description..."
            className="text-xs border-0 outline-none bg-transparent w-64"
          />
        </div>
        <select
          value={fsc}
          onChange={(e) => setFsc(e.target.value)}
          className="rounded border border-card-border px-2 py-1 text-xs"
        >
          <option value="all">All FSCs</option>
          {fscOptions.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-3 py-2 font-medium">NSN</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium text-right">On Hand</th>
                <th className="px-3 py-2 font-medium text-right">Reserved</th>
                <th className="px-3 py-2 font-medium text-right">Available</th>
                <th className="px-3 py-2 font-medium text-right">Lots</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-muted">
                    No items match.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 500).map((r) => (
                  <tr key={r.id} className="border-b border-card-border/50 hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-accent">
                      <Link href={`/lookup?nsn=${encodeURIComponent(r.nsn)}`} className="hover:underline">
                        {r.nsn}
                      </Link>
                    </td>
                    <td className="px-3 py-2 truncate max-w-[260px]">{r.description || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(r.qty_on_hand).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono text-amber-700">
                      {r.qty_reserved ? Number(r.qty_reserved).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">
                      {r.qty_available != null ? Number(r.qty_available).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted">{r.lots}</td>
                    <td className="px-3 py-2 text-[10px]">
                      <Link href={`/solicitations?search=${encodeURIComponent(r.nsn)}`} className="text-accent hover:underline">
                        sols →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-3 py-2 border-t border-card-border text-xs text-muted">
            Showing {Math.min(filtered.length, 500)} of {filtered.length} NSNs
          </div>
        )}
      </div>
    </>
  );
}
