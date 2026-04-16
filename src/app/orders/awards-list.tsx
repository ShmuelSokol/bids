"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatDateShort } from "@/lib/dates";
import {
  ChevronLeft,
  Package,
  Check,
  Loader2,
  Calendar,
  ArrowUpDown,
  ShoppingCart,
  Clock,
} from "lucide-react";

interface Award {
  id: number;
  contract_number: string;
  clin: string;
  fsc: string;
  niin: string;
  nsn: string;
  part_number: string;
  description: string;
  cage: string;
  unit_price: number;
  quantity: number;
  extended_value: number;
  order_number: string;
  tcn: string;
  ship_status: string;
  fob: string;
  award_date: string;
  required_delivery: string;
  piid: string;
  fast_pay: string;
  po_generated: boolean;
  po_id: number | null;
  our_cost: number | null;
  margin_pct: number | null;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier: string;
  status: string;
  total_cost: number;
  line_count: number;
  created_at: string;
  po_lines: any[];
  ax_po_number?: string | null;
  ax_correlation_ref?: string | null;
  dmf_state?: string | null;
}

type ShipStats = { shipped: number; notShipped: number; noStatus: number; shipping: number; partial: number; total: number };

export function AwardsList({
  awards,
  purchaseOrders,
  shipStats,
}: {
  awards: Award[];
  purchaseOrders: PurchaseOrder[];
  shipStats?: ShipStats;
}) {
  const [tab, setTab] = useState<"awards" | "pos">("awards");
  const [shipFilter, setShipFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showOnlyNew, setShowOnlyNew] = useState(true);
  const [switchingLine, setSwitchingLine] = useState<{ id: number; nsn: string; currentSupplier: string } | null>(null);
  const [vendorPrices, setVendorPrices] = useState<any[]>([]);
  const [poReceipts, setPoReceipts] = useState<any[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newVendorCode, setNewVendorCode] = useState("");
  const [newVendorPrice, setNewVendorPrice] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | "all" | null>(null);
  const [validateResult, setValidateResult] = useState<{
    checked: number;
    ready: any[];
    nsn_missing: { nsn: string; awards: any[] }[];
    dodaac_missing: any[];
  } | null>(null);
  const [validating, setValidating] = useState(false);

  async function downloadFromEndpoint(endpoint: string, poIds: number[], fallbackName: string) {
    const key: number | "all" = poIds.length === 1 ? poIds[0] : "all";
    setDownloadingId(key);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(`${fallbackName} failed: ${err.error || res.status}`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m?.[1] || fallbackName;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setMessage(`${fallbackName} error: ${e?.message || "unknown"}`);
    } finally {
      setDownloadingId(null);
    }
  }

  async function pollAx(poIds?: number[]) {
    const res = await fetch("/api/orders/poll-ax", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(poIds ? { poIds } : {}),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Polled ${data.checked} PO(s); ${data.updated} advanced state.`);
      setTimeout(() => window.location.reload(), 1200);
    } else {
      setMessage(`Poll failed: ${data.error || res.status}`);
    }
  }

  async function downloadXlsx(poIds: number[], fallbackName?: string) {
    const key: number | "all" = poIds.length === 1 ? poIds[0] : "all";
    setDownloadingId(key);
    try {
      const res = await fetch("/api/orders/export-xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(`Export failed: ${err.error || res.status}`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m?.[1] || fallbackName || "dibs-pos.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setMessage(`Export error: ${e?.message || "unknown"}`);
    } finally {
      setDownloadingId(null);
    }
  }

  const filtered = useMemo(() => {
    let items = awards;

    if (showOnlyNew) {
      items = items.filter((a) => !a.po_generated);
    }

    if (shipFilter) {
      items = items.filter((a) => {
        const s = (a.ship_status || "").trim().toLowerCase();
        if (shipFilter === "shipped") return s === "shipped" || s === "invoiced" || s === "complete";
        if (shipFilter === "not_shipped") return s === "not shipped";
        if (shipFilter === "no_status") return !s;
        if (shipFilter === "in_progress") return s === "shipping" || s.includes("partial");
        return true;
      });
    }

    if (dateFrom) {
      items = items.filter((a) => {
        if (!a.award_date) return false;
        return a.award_date.slice(0, 10) >= dateFrom;
      });
    }
    if (dateTo) {
      items = items.filter((a) => {
        if (!a.award_date) return false;
        return a.award_date.slice(0, 10) <= dateTo;
      });
    }

    return items;
  }, [awards, dateFrom, dateTo, showOnlyNew, shipFilter]);

  function selectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((a) => a.id)));
    }
  }

  function selectDateRange() {
    // Select all visible (filtered) items
    setSelected(new Set(filtered.map((a) => a.id)));
  }

  async function handleShowSuppliers(lineId: number, nsn: string, currentSupplier: string) {
    setSwitchingLine({ id: lineId, nsn, currentSupplier });
    setLoadingVendors(true);
    try {
      const res = await fetch(`/api/orders/vendor-prices?nsn=${encodeURIComponent(nsn)}`);
      const data = await res.json();
      setVendorPrices(data.vendors || []);
      setPoReceipts(data.receipts || []);
    } catch {
      setVendorPrices([]);
      setPoReceipts([]);
    } finally {
      setLoadingVendors(false);
    }
  }

  async function handleSwitchSupplier(newSupplier: string) {
    if (!switchingLine) return;
    setSwitching(true);
    try {
      await fetch("/api/orders/switch-supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_id: switchingLine.id, new_supplier: newSupplier }),
      });
      setMessage(`Moved to ${newSupplier}. Refreshing...`);
      setSwitchingLine(null);
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      setMessage("Switch failed");
    } finally {
      setSwitching(false);
    }
  }

  async function handleAddSupplier() {
    if (!switchingLine || !newVendorCode.trim()) return;
    setAddingSupplier(true);
    try {
      const res = await fetch("/api/orders/add-supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nsn: switchingLine.nsn,
          vendor: newVendorCode.trim().toUpperCase(),
          price: newVendorPrice ? parseFloat(newVendorPrice) : null,
          line_id: switchingLine.id,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(`Added ${newVendorCode.trim().toUpperCase()} and switched. Refreshing...`);
        setSwitchingLine(null);
        setNewVendorCode("");
        setNewVendorPrice("");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setMessage(data.error || "Failed to add supplier");
      }
    } catch {
      setMessage("Failed to add supplier");
    } finally {
      setAddingSupplier(false);
    }
  }

  async function handleGeneratePOs() {
    if (selected.size === 0) return;
    setGenerating(true);
    setMessage("Generating purchase orders...");

    try {
      const selectedAwards = awards.filter((a) => selected.has(a.id));
      const res = await fetch("/api/orders/generate-pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          award_ids: Array.from(selected),
          awards: selectedAwards.map((a) => ({
            id: a.id,
            nsn: a.nsn,
            description: a.description,
            quantity: a.quantity,
            unit_price: a.unit_price,
            our_cost: a.our_cost,
            cage: a.cage,
            contract_number: a.contract_number,
            order_number: a.order_number,
            fob: a.fob,
            ship_status: a.ship_status,
            required_delivery: a.required_delivery,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(
          `Created ${data.po_count} POs with ${data.line_count} line items. Refreshing...`
        );
        setSelected(new Set());
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Failed to generate POs");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Orders & POs</span>
      </div>

      {/* Ship Status Breakdown */}
      {shipStats && (
        <div className="grid grid-cols-5 gap-2 mb-4">
          <button onClick={() => setShipFilter(shipFilter === "shipped" ? null : "shipped")}
            className={`rounded-lg border p-3 text-left transition-colors ${shipFilter === "shipped" ? "border-green-400 bg-green-50" : "border-card-border bg-card-bg hover:border-green-300"}`}>
            <div className="text-lg font-bold text-green-700">{shipStats.shipped.toLocaleString()}</div>
            <div className="text-[10px] text-green-600">Shipped / Done</div>
          </button>
          <button onClick={() => setShipFilter(shipFilter === "not_shipped" ? null : "not_shipped")}
            className={`rounded-lg border p-3 text-left transition-colors ${shipFilter === "not_shipped" ? "border-red-400 bg-red-50" : "border-card-border bg-card-bg hover:border-red-300"}`}>
            <div className="text-lg font-bold text-red-700">{shipStats.notShipped.toLocaleString()}</div>
            <div className="text-[10px] text-red-600">Not Shipped</div>
          </button>
          <button onClick={() => setShipFilter(shipFilter === "no_status" ? null : "no_status")}
            className={`rounded-lg border p-3 text-left transition-colors ${shipFilter === "no_status" ? "border-gray-400 bg-gray-50" : "border-card-border bg-card-bg hover:border-gray-300"}`}>
            <div className="text-lg font-bold text-gray-700">{shipStats.noStatus.toLocaleString()}</div>
            <div className="text-[10px] text-gray-500">No Status</div>
          </button>
          <button onClick={() => setShipFilter(shipFilter === "in_progress" ? null : "in_progress")}
            className={`rounded-lg border p-3 text-left transition-colors ${shipFilter === "in_progress" ? "border-amber-400 bg-amber-50" : "border-card-border bg-card-bg hover:border-amber-300"}`}>
            <div className="text-lg font-bold text-amber-700">{(shipStats.shipping + shipStats.partial).toLocaleString()}</div>
            <div className="text-[10px] text-amber-600">In Progress</div>
          </button>
          <div className="rounded-lg border border-card-border bg-card-bg p-3 text-left">
            <div className="text-lg font-bold text-foreground">{shipStats.total.toLocaleString()}</div>
            <div className="text-[10px] text-muted">Total</div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Orders & Purchase Orders</h1>
          <p className="text-muted text-sm">
            {awards.filter((a) => !a.po_generated).length} awards without DIBS POs (of {awards.length} total),{" "}
            {purchaseOrders.length} POs created
            {shipFilter && <span className="ml-2 text-accent font-medium">· Filtered: {shipFilter.replace("_", " ")}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/orders/followups"
            className="px-3 py-1.5 rounded border border-card-border bg-card-bg text-xs font-medium hover:bg-accent/5 inline-flex items-center gap-1"
          >
            <Clock className="h-3.5 w-3.5" /> Follow-ups
          </Link>
          <button
            onClick={async () => {
              setValidating(true);
              try {
                const r = await fetch("/api/so/validate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                });
                const d = await r.json();
                if (!r.ok) {
                  setMessage(`SO validate failed: ${d.error || r.status}`);
                  return;
                }
                setValidateResult(d);
              } finally {
                setValidating(false);
              }
            }}
            disabled={validating}
            className="px-3 py-1.5 rounded border border-card-border bg-card-bg text-xs font-medium hover:bg-accent/5 inline-flex items-center gap-1 disabled:opacity-50"
            title="Pre-validate awards against AX before you run the MPI Sales Order import"
          >
            {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Validate for AX
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("awards")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "awards"
              ? "bg-accent text-white"
              : "bg-card-bg border border-card-border"
          }`}
        >
          <ShoppingCart className="h-4 w-4 inline mr-1" />
          Awards ({awards.filter((a) => !a.po_generated).length} new)
        </button>
        <button
          onClick={() => setTab("pos")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "pos"
              ? "bg-accent text-white"
              : "bg-card-bg border border-card-border"
          }`}
        >
          <Package className="h-4 w-4 inline mr-1" />
          Purchase Orders ({purchaseOrders.length})
        </button>
      </div>

      {tab === "awards" && (
        <>
          {/* Date Filter + Actions */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="text-xs text-muted block mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-card-border px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-card-border px-3 py-1.5 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showOnlyNew}
                onChange={(e) => setShowOnlyNew(e.target.checked)}
                className="rounded"
              />
              New only (no PO yet)
            </label>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={selectDateRange}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-card-border bg-card-bg hover:bg-gray-50"
              >
                <Calendar className="h-3 w-3 inline mr-1" />
                Select All Visible ({filtered.length})
              </button>
              {selected.size > 0 && (
                <button
                  onClick={handleGeneratePOs}
                  disabled={generating}
                  className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Package className="h-3 w-3" />
                  )}
                  Generate POs ({selected.size} awards)
                </button>
              )}
            </div>
          </div>

          {message && (
            <div className="mb-3 rounded-lg bg-blue-50 text-blue-700 px-3 py-2 text-xs">
              {message}
            </div>
          )}

          {/* Awards Table */}
          <div className="rounded-xl border border-card-border bg-card-bg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-left text-muted bg-gray-50/50">
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={
                          selected.size > 0 &&
                          selected.size === filtered.length
                        }
                        onChange={selectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-3 py-2 font-medium">NSN</th>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium">Contract</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Sell Price
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Cost</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Margin
                    </th>
                    <th className="px-3 py-2 font-medium">FOB</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Award Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((a) => (
                    <tr
                      key={a.id}
                      className={`border-b border-card-border hover:bg-gray-50/50 ${
                        selected.has(a.id) ? "bg-green-50/30" : ""
                      } ${a.po_generated ? "opacity-40" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(a.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(a.id);
                            else next.delete(a.id);
                            setSelected(next);
                          }}
                          className="rounded"
                          disabled={a.po_generated}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-accent">
                        {a.nsn}
                      </td>
                      <td className="px-3 py-2">
                        <div className="truncate max-w-[180px] text-xs">
                          {a.description || "—"}
                        </div>
                        {a.cage && (
                          <div className="text-[10px] text-muted">
                            CAGE: {a.cage}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px]">
                        {a.contract_number?.trim().slice(0, 20)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        ${a.unit_price?.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-muted">
                        {a.our_cost ? `$${a.our_cost.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        {a.quantity}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {a.margin_pct !== null ? (
                          <span
                            className={`text-xs font-medium ${
                              a.margin_pct >= 20
                                ? "text-green-600"
                                : a.margin_pct >= 10
                                  ? "text-yellow-600"
                                  : "text-red-600"
                            }`}
                          >
                            {a.margin_pct}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-[10px]">
                        {a.fob === "D" ? (
                          <span className="px-1 rounded bg-blue-50 text-blue-700">
                            Dest
                          </span>
                        ) : a.fob === "O" ? (
                          <span className="px-1 rounded bg-gray-50 text-gray-600">
                            Orig
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-[10px] px-1 rounded ${
                            a.ship_status === "Shipped"
                              ? "bg-green-100 text-green-700"
                              : a.ship_status === "Not Shipped"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {a.ship_status || "—"}
                        </span>
                        {a.po_generated && (
                          <span className="text-[9px] px-1 rounded bg-purple-100 text-purple-700 ml-1">
                            PO
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">
                        {formatDateShort(a.award_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > 200 && (
              <div className="px-4 py-2 text-xs text-muted border-t border-card-border">
                Showing 200 of {filtered.length} — narrow date range to see more
              </div>
            )}
          </div>
        </>
      )}

      {tab === "pos" && (
        <div className="space-y-4">
          {purchaseOrders.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-lg font-medium">No purchase orders yet</p>
              <p className="text-sm">
                Select awards and click "Generate POs" to create them
              </p>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <button
                  onClick={() => downloadXlsx(purchaseOrders.map((p) => p.id))}
                  disabled={downloadingId === "all"}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {downloadingId === "all" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Building ZIP...
                    </>
                  ) : (
                    <>Download All as ZIP ({purchaseOrders.length} POs)</>
                  )}
                </button>
              </div>
              {purchaseOrders.map((po) => (
              <div
                key={po.id}
                className="rounded-xl border border-card-border bg-card-bg shadow-sm overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">
                        {po.po_number}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          po.status === "draft"
                            ? "bg-yellow-100 text-yellow-700"
                            : po.status === "submitted"
                              ? "bg-blue-100 text-blue-700"
                              : po.status === "confirmed"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {po.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm text-muted mt-0.5">
                      {po.supplier} · {po.line_count} items ·{" "}
                      {formatDateShort(po.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold font-mono">
                        ${po.total_cost?.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted">est. cost</div>
                    </div>
                    <button
                      onClick={() => downloadXlsx([po.id])}
                      disabled={downloadingId === po.id}
                      className="px-3 py-1.5 rounded-md border border-card-border bg-card-bg hover:bg-accent/5 text-xs font-medium inline-flex items-center gap-1.5"
                      title={`Download ${po.po_number} as Excel`}
                    >
                      {downloadingId === po.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>Excel</>
                      )}
                    </button>
                  </div>
                </div>
                {/* AX write-back state + actions */}
                <div className="px-6 py-2 bg-gray-50 border-b border-card-border text-[11px] flex items-center gap-3">
                  <span className="text-muted">AX state:</span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-medium ${
                      po.dmf_state === "posted"
                        ? "bg-green-100 text-green-700"
                        : po.dmf_state === "awaiting_po_number" || po.dmf_state === "awaiting_lines_import"
                          ? "bg-blue-100 text-blue-700"
                          : po.dmf_state === "lines_ready"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {po.dmf_state || "drafted"}
                  </span>
                  {po.ax_po_number && (
                    <span className="text-muted">
                      AX PO: <code className="font-mono text-foreground">{po.ax_po_number}</code>
                    </span>
                  )}
                  {!po.dmf_state || po.dmf_state === "drafted" ? (
                    <button
                      onClick={() => downloadFromEndpoint("/api/orders/dmf-header", [po.id], `dibs-po-header-${po.id}.xlsx`)}
                      disabled={downloadingId === po.id || po.supplier === "UNASSIGNED"}
                      className="ml-auto px-2.5 py-1 rounded bg-accent text-white font-medium disabled:opacity-40"
                      title="Download the PO header DMF file, import into AX"
                    >
                      Download Header DMF
                    </button>
                  ) : po.dmf_state === "awaiting_po_number" ? (
                    <button onClick={() => pollAx([po.id])} className="ml-auto px-2.5 py-1 rounded border border-card-border font-medium">
                      Check for AX PO #
                    </button>
                  ) : po.dmf_state === "lines_ready" ? (
                    <button
                      onClick={async () => {
                        await downloadFromEndpoint("/api/orders/dmf-lines", [po.id], `dibs-po-lines-${po.id}.xlsx`);
                        // flip state to awaiting_lines_import so polling picks up
                        await fetch("/api/orders/poll-ax", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ poIds: [po.id] }),
                        });
                      }}
                      className="ml-auto px-2.5 py-1 rounded bg-accent text-white font-medium"
                    >
                      Download Lines DMF
                    </button>
                  ) : po.dmf_state === "awaiting_lines_import" ? (
                    <button onClick={() => pollAx([po.id])} className="ml-auto px-2.5 py-1 rounded border border-card-border font-medium">
                      Check posted
                    </button>
                  ) : null}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted border-b border-card-border">
                        <th className="px-4 py-2 text-left font-medium">
                          NSN
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Item
                        </th>
                        <th className="px-4 py-2 text-right font-medium">
                          Qty
                        </th>
                        <th className="px-4 py-2 text-right font-medium">
                          Unit Cost
                        </th>
                        <th className="px-4 py-2 text-right font-medium">
                          Sell Price
                        </th>
                        <th className="px-4 py-2 text-right font-medium">
                          Margin
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Contract
                        </th>
                        <th className="px-4 py-2 text-left font-medium w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(po.po_lines || []).map((line: any) => (
                        <tr
                          key={line.id}
                          className="border-b border-card-border/50"
                        >
                          <td className="px-4 py-1.5 font-mono text-accent">
                            {line.nsn}
                          </td>
                          <td className="px-4 py-1.5 truncate max-w-[200px]">
                            {line.description}
                          </td>
                          <td className="px-4 py-1.5 text-right">
                            {line.quantity}
                          </td>
                          <td className="px-4 py-1.5 text-right font-mono">
                            {line.unit_cost ? `$${line.unit_cost.toFixed(2)}` : "—"}
                          </td>
                          <td className="px-4 py-1.5 text-right font-mono">
                            ${line.sell_price?.toFixed(2)}
                          </td>
                          <td className="px-4 py-1.5 text-right">
                            {line.margin_pct !== null ? (
                              <span
                                className={`font-medium ${
                                  line.margin_pct >= 20
                                    ? "text-green-600"
                                    : "text-yellow-600"
                                }`}
                              >
                                {line.margin_pct}%
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-1.5 font-mono text-[10px]">
                            {line.contract_number?.slice(0, 20)}
                          </td>
                          <td className="px-4 py-1.5">
                            <button
                              onClick={() => handleShowSuppliers(line.id, line.nsn, po.supplier)}
                              className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-medium"
                            >
                              Switch
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              ))}
            </>
          )}
        </div>
      )}
      {/* Validate-for-AX Result Modal */}
      {validateResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setValidateResult(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-[720px] max-w-[95vw] max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-card-border flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">AX pre-validation results</h3>
                <p className="text-xs text-muted mt-1">
                  Checked {validateResult.checked} recent awards against AX. Fix everything below BEFORE running the MPI Sales Order import — DIBS catching issues here is faster than MPI's error screen.
                </p>
              </div>
              <button onClick={() => setValidateResult(null)} className="text-muted hover:text-foreground text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{validateResult.ready.length}</div>
                  <div className="text-xs text-muted mt-1">Ready for MPI</div>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
                  <div className="text-2xl font-bold text-amber-700">{validateResult.nsn_missing.length}</div>
                  <div className="text-xs text-muted mt-1">NSNs need AX item</div>
                </div>
                <div className="rounded-lg bg-slate-100 border border-slate-200 p-3 text-center">
                  <div className="text-2xl font-bold text-slate-700">{validateResult.dodaac_missing.length}</div>
                  <div className="text-xs text-muted mt-1">DODAAC unmapped <span className="text-[9px] align-top text-slate-500">(stubbed)</span></div>
                </div>
              </div>

              {validateResult.nsn_missing.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">NSNs with no AX item</h4>
                  <p className="text-xs text-muted mb-2">
                    Each NSN needs an item created in AX (via NPI) or attached to an existing item. Abe does this in the MPI error workflow OR via the NPI multi-sheet import.
                  </p>
                  <div className="rounded border border-card-border max-h-64 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr className="text-left text-muted">
                          <th className="px-3 py-1.5 font-medium">NSN</th>
                          <th className="px-3 py-1.5 font-medium text-right">Awards affected</th>
                          <th className="px-3 py-1.5 font-medium">Example contract</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validateResult.nsn_missing.slice(0, 100).map((row, i) => (
                          <tr key={i} className="border-t border-card-border/40">
                            <td className="px-3 py-1.5 font-mono text-accent">{row.nsn}</td>
                            <td className="px-3 py-1.5 text-right">{row.awards.length}</td>
                            <td className="px-3 py-1.5 text-muted font-mono text-[10px]">
                              {row.awards[0]?.contract_number || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {validateResult.nsn_missing.length > 100 && (
                    <p className="text-[10px] text-muted mt-1">Showing first 100 of {validateResult.nsn_missing.length}</p>
                  )}
                </div>
              )}

              {validateResult.dodaac_missing.length === 0 && (
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-muted">
                  <strong>DODAAC check stubbed.</strong> The awards table doesn't carry DODAAC today; needs Yosef's schema tour (which k81 join reaches ka0) before this column becomes meaningful. For now, DIBS can't catch DODAAC-map-missing issues ahead of MPI.
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-card-border text-right">
              <button onClick={() => setValidateResult(null)} className="px-3 py-1.5 rounded bg-accent text-white text-xs font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Switch Modal */}
      {switchingLine && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSwitchingLine(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-[500px] max-w-[95vw] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-card-border">
              <h3 className="text-lg font-bold">Switch Supplier</h3>
              <p className="text-xs text-muted mt-1">
                NSN: {switchingLine.nsn} · Current: {switchingLine.currentSupplier}
              </p>
            </div>
            <div className="p-6">
              {loadingVendors ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted" />
                  <span className="ml-2 text-sm text-muted">Loading vendors...</span>
                </div>
              ) : vendorPrices.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">No alternative vendors found for this NSN</p>
              ) : (
                <div className="space-y-2">
                  {vendorPrices.map((v: any, i: number) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        v.vendor === switchingLine.currentSupplier
                          ? "border-green-300 bg-green-50"
                          : "border-card-border hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">{v.vendor}</span>
                          {v.axItemNumber && (
                            <span className="text-[10px] text-muted bg-blue-50 px-1 rounded" title="AX Item Number">
                              AX: {v.axItemNumber}
                            </span>
                          )}
                          {v.lastPoDate && (
                            <span className="text-[10px] text-muted bg-gray-100 px-1 rounded">
                              Last PO: {formatDateShort(v.lastPoDate)}
                            </span>
                          )}
                        </div>
                        {v.vendorPartNumber && (
                          <div className="text-[10px] text-purple-700 mt-0.5">
                            Vendor P/N: <span className="font-mono">{v.vendorPartNumber}</span>
                            {v.vendorDescription && <span className="text-muted ml-2">{v.vendorDescription}</span>}
                          </div>
                        )}
                        <div className="text-xs text-muted mt-0.5">
                          {v.sources.map((s: any) => (
                            <span key={s.source} className="mr-3">
                              {s.source === "recent_po" ? "PO Price" : "Agreement"}:
                              <span className="font-mono font-medium ml-1">${s.price.toFixed(2)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      {v.vendor === switchingLine.currentSupplier ? (
                        <span className="text-xs text-green-700 font-medium px-2 py-1 rounded bg-green-100">Current</span>
                      ) : (
                        <button
                          onClick={() => handleSwitchSupplier(v.vendor)}
                          disabled={switching}
                          className="text-xs px-3 py-1.5 rounded bg-accent text-white font-medium hover:bg-accent-hover disabled:opacity-50"
                        >
                          {switching ? "Moving..." : "Switch Here"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {poReceipts.length > 0 && (
              <div className="px-6 py-3 border-t border-card-border">
                <div className="text-xs font-medium text-blue-700 mb-2">Recent PO History from AX ({poReceipts.length})</div>
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-[11px]">
                    <thead className="text-muted sticky top-0 bg-white">
                      <tr>
                        <th className="text-left px-2 py-1">Vendor</th>
                        <th className="text-left px-2 py-1">PO #</th>
                        <th className="text-right px-2 py-1">Price</th>
                        <th className="text-right px-2 py-1">Qty</th>
                        <th className="text-left px-2 py-1">UoM</th>
                        <th className="text-left px-2 py-1">Delivery</th>
                        <th className="text-left px-2 py-1">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poReceipts.map((r: any, i: number) => (
                        <tr key={i} className="border-t border-card-border/30">
                          <td className="px-2 py-1 font-mono font-medium">{r.vendor}</td>
                          <td className="px-2 py-1 font-mono text-muted">{r.po_number}</td>
                          <td className="px-2 py-1 text-right font-mono">${r.purchase_price?.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right">{r.quantity || "—"}</td>
                          <td className="px-2 py-1">{r.uom || "—"}</td>
                          <td className="px-2 py-1 text-muted">{r.delivery_date && r.delivery_date !== "1900-01-01T12:00:00Z" ? formatDateShort(r.delivery_date) : "—"}</td>
                          <td className="px-2 py-1">
                            <span className={`text-[9px] px-1 rounded ${r.line_status === "Received" ? "bg-green-100 text-green-700" : r.line_status === "Backorder" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{r.line_status || "—"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-card-border space-y-3">
              <div className="text-xs font-medium text-muted">Add a new supplier for this NSN</div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-[10px] text-muted">Vendor code</label>
                  <input
                    type="text"
                    value={newVendorCode}
                    onChange={(e) => setNewVendorCode(e.target.value)}
                    placeholder="e.g. SEABERG"
                    className="w-full px-2 py-1.5 border border-card-border rounded text-sm font-mono"
                  />
                </div>
                <div className="w-28">
                  <label className="text-[10px] text-muted">Price (optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newVendorPrice}
                    onChange={(e) => setNewVendorPrice(e.target.value)}
                    placeholder="$0.00"
                    className="w-full px-2 py-1.5 border border-card-border rounded text-sm font-mono"
                  />
                </div>
                <button
                  onClick={handleAddSupplier}
                  disabled={addingSupplier || !newVendorCode.trim()}
                  className="px-3 py-1.5 rounded bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {addingSupplier ? "Adding..." : "Add & Switch"}
                </button>
              </div>
              <p className="text-[10px] text-muted">
                Adds this vendor to nsn_vendor_prices so it appears on future orders. Also create the trade agreement in AX so the cost pulls through automatically.
              </p>
              <button onClick={() => setSwitchingLine(null)} className="text-sm text-muted hover:text-foreground">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
