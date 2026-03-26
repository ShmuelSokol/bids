"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Package,
  Check,
  Loader2,
  Calendar,
  ArrowUpDown,
  ShoppingCart,
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
}

export function AwardsList({
  awards,
  purchaseOrders,
}: {
  awards: Award[];
  purchaseOrders: PurchaseOrder[];
}) {
  const [tab, setTab] = useState<"awards" | "pos">("awards");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showOnlyNew, setShowOnlyNew] = useState(true);
  const [switchingLine, setSwitchingLine] = useState<{ id: number; nsn: string; currentSupplier: string } | null>(null);
  const [vendorPrices, setVendorPrices] = useState<any[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [switching, setSwitching] = useState(false);

  const filtered = useMemo(() => {
    let items = awards;

    if (showOnlyNew) {
      items = items.filter((a) => !a.po_generated);
    }

    if (dateFrom) {
      items = items.filter((a) => {
        if (!a.award_date) return false;
        return new Date(a.award_date) >= new Date(dateFrom);
      });
    }
    if (dateTo) {
      items = items.filter((a) => {
        if (!a.award_date) return false;
        return new Date(a.award_date) <= new Date(dateTo + "T23:59:59");
      });
    }

    return items;
  }, [awards, dateFrom, dateTo, showOnlyNew]);

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
    } catch {
      setVendorPrices([]);
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

      <h1 className="text-2xl font-bold mb-1">Orders & Purchase Orders</h1>
      <p className="text-muted text-sm mb-4">
        {awards.filter((a) => !a.po_generated).length} new awards,{" "}
        {purchaseOrders.length} POs created
      </p>

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
                type="datetime-local"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-card-border px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">To</label>
              <input
                type="datetime-local"
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
                        {a.award_date
                          ? new Date(a.award_date).toLocaleDateString()
                          : "—"}
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
            purchaseOrders.map((po) => (
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
                      {new Date(po.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold font-mono">
                      ${po.total_cost?.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted">est. cost</div>
                  </div>
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
            ))
          )}
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
                        <div className="font-mono text-sm font-medium">{v.vendor}</div>
                        <div className="text-xs text-muted mt-0.5">
                          {v.sources.map((s: any) => (
                            <span key={s.source} className="mr-3">
                              {s.source === "recent_po" ? "Last PO" : "Agreement"}:
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
            <div className="px-6 py-3 border-t border-card-border">
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
