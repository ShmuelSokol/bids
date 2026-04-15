"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, RefreshCw, AlertTriangle, Package } from "lucide-react";
import { formatDate, formatDateShort } from "@/lib/dates";

type PostedInv = {
  kad_id: number;
  invoice_number: string;
  total: number;
  posted_on: string;
  days_since_posted: number;
  days_overdue: number;
  severity: "amber" | "red";
  upname: string;
};

type AxPo = {
  po_number: string;
  line_count: number;
  total: number;
  earliest_delivery: string | null;
  lines: any[];
};

export default function InvoiceFollowupsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPo, setExpandedPo] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/invoicing/followups");
      setData(await r.json());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function fmt$(n: number | null | undefined) {
    if (!n && n !== 0) return "—";
    return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/invoicing" className="text-xs text-muted hover:text-accent inline-flex items-center gap-1 mb-2">
            <ChevronLeft className="h-3 w-3" /> Back to Invoicing
          </Link>
          <h1 className="text-2xl font-bold">Follow-ups — Invoices & Government POs</h1>
          <p className="text-muted text-sm mt-1">
            Two leaks Abe flagged (2026-04-16): invoices posted but unpaid by DLA, and government POs open/unreceived at vendors. This page surfaces both so they stop slipping.
          </p>
        </div>
        <button onClick={load} className="px-3 py-1.5 rounded border border-card-border bg-card-bg text-xs font-medium inline-flex items-center gap-1">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {data && (
        <>
          {/* Posted invoices awaiting payment */}
          <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
            <div className="px-6 py-4 border-b border-card-border">
              <h2 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Posted invoices awaiting DLA payment ({data.posted_invoices_count})
              </h2>
              <p className="text-xs text-muted mt-1">
                DLA typical pay window is ~30 days. {data.posted_amber} amber (21-30d), {data.posted_red} red (&gt;30d). Source: invoice_state_events where latest state is Posted.
              </p>
            </div>
            {data.posted_invoices.length === 0 ? (
              <div className="p-6 text-center text-muted text-sm">No posted invoices older than 21 days. Everything is within SLA.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted border-b border-card-border">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Invoice #</th>
                    <th className="px-4 py-2 text-left font-medium">Posted on</th>
                    <th className="px-4 py-2 text-right font-medium">Days posted</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2 text-left font-medium">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.posted_invoices.map((inv: PostedInv) => (
                    <tr key={inv.kad_id} className={`border-b border-card-border/40 ${inv.severity === "red" ? "bg-red-50/40" : "bg-amber-50/20"}`}>
                      <td className="px-4 py-1.5 font-mono">{inv.invoice_number}</td>
                      <td className="px-4 py-1.5 text-muted">{formatDate(inv.posted_on)}</td>
                      <td className="px-4 py-1.5 text-right font-mono">{inv.days_since_posted}d</td>
                      <td className="px-4 py-1.5 text-right font-mono">{fmt$(inv.total)}</td>
                      <td className="px-4 py-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${inv.severity === "red" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {inv.severity === "red" ? `+${inv.days_overdue}d past DLA window` : "approaching 30d"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* AX government POs via DD219 */}
          <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
            <div className="px-6 py-4 border-b border-card-border">
              <h2 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                Open government POs in AX ({data.ax_po_count})
              </h2>
              <p className="text-xs text-muted mt-1">
                AX query: PurchaseOrderLinesV2 where CustomerRequisitionNumber='DD219' and status=Backorder. Per Abe 2026-04-16: every gov PO carries the DD219 marker, so we can find them without needing a DIBS↔AX correlation. Sorted by earliest requested delivery.
              </p>
              {data.ax_error && <p className="text-xs text-red-700 mt-1">AX error: {data.ax_error}</p>}
            </div>
            {data.ax_government_pos.length === 0 ? (
              <div className="p-6 text-center text-muted text-sm">
                {data.ax_error ? "Couldn't reach AX." : "No open DD219 POs — everything received or there's a query issue."}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted border-b border-card-border">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">AX PO #</th>
                    <th className="px-4 py-2 text-right font-medium">Lines</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2 text-left font-medium">Earliest delivery</th>
                    <th className="px-4 py-2 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.ax_government_pos.map((po: AxPo) => {
                    const expanded = expandedPo === po.po_number;
                    return (
                      <>
                        <tr key={po.po_number} className="border-b border-card-border/40 hover:bg-gray-50/50 cursor-pointer" onClick={() => setExpandedPo(expanded ? null : po.po_number)}>
                          <td className="px-4 py-1.5 font-mono">{po.po_number}</td>
                          <td className="px-4 py-1.5 text-right">{po.line_count}</td>
                          <td className="px-4 py-1.5 text-right font-mono">{fmt$(po.total)}</td>
                          <td className="px-4 py-1.5 text-muted">{po.earliest_delivery ? formatDateShort(po.earliest_delivery) : "—"}</td>
                          <td className="px-4 py-1.5 text-xs text-accent">{expanded ? "hide lines" : "show lines"}</td>
                        </tr>
                        {expanded && (
                          <tr className="bg-blue-50/20">
                            <td colSpan={5} className="px-6 py-3">
                              <table className="w-full text-[11px]">
                                <thead className="text-muted">
                                  <tr>
                                    <th className="px-2 py-1 text-left">Line</th>
                                    <th className="px-2 py-1 text-left">Item</th>
                                    <th className="px-2 py-1 text-left">Description</th>
                                    <th className="px-2 py-1 text-right">Qty</th>
                                    <th className="px-2 py-1 text-right">Price</th>
                                    <th className="px-2 py-1 text-left">Req delivery</th>
                                    <th className="px-2 py-1 text-left">Conf delivery</th>
                                    <th className="px-2 py-1 text-left">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {po.lines.map((l: any) => (
                                    <tr key={l.LineNumber} className="border-t border-card-border/30">
                                      <td className="px-2 py-1">{l.LineNumber}</td>
                                      <td className="px-2 py-1 font-mono">{l.ItemNumber}</td>
                                      <td className="px-2 py-1 truncate max-w-[260px]" title={l.LineDescription}>{l.LineDescription}</td>
                                      <td className="px-2 py-1 text-right">{l.OrderedPurchaseQuantity}</td>
                                      <td className="px-2 py-1 text-right font-mono">{fmt$(l.PurchasePrice)}</td>
                                      <td className="px-2 py-1 text-muted">{l.RequestedDeliveryDate === "1900-01-01T12:00:00Z" ? "—" : formatDateShort(l.RequestedDeliveryDate)}</td>
                                      <td className="px-2 py-1 text-muted">{l.ConfirmedDeliveryDate === "1900-01-01T12:00:00Z" ? "—" : formatDateShort(l.ConfirmedDeliveryDate)}</td>
                                      <td className="px-2 py-1"><span className="text-[10px] px-1 rounded bg-amber-100 text-amber-700">{l.PurchaseOrderLineStatus}</span></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
