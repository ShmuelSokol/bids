"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Plus, Save, Trash2, Package, RefreshCw } from "lucide-react";
import { formatDateShort } from "@/lib/dates";

type OverduePO = {
  id: number;
  po_number: string;
  ax_po_number: string | null;
  supplier: string;
  total_cost: number;
  line_count: number;
  dmf_state: string;
  days_overdue: number;
  sla_days: number;
  created_at: string;
};

type Rule = {
  vendor: string;
  sla_days: number;
  email_template: string | null;
  updated_at: string;
};

export default function FollowupsPage() {
  const [overdue, setOverdue] = useState<OverduePO[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [defaultSla, setDefaultSla] = useState(7);
  const [loading, setLoading] = useState(true);
  const [editRule, setEditRule] = useState<Rule | null>(null);
  const [axData, setAxData] = useState<any>(null);
  const [axLoading, setAxLoading] = useState(true);

  async function reload() {
    setLoading(true);
    setAxLoading(true);
    const [ovRes, rulesRes, axRes] = await Promise.all([
      fetch("/api/orders/followups").then((r) => r.json()),
      fetch("/api/orders/followups/rules").then((r) => r.json()),
      fetch("/api/invoicing/followups").then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);
    setOverdue(ovRes.overdue || []);
    setDefaultSla(ovRes.default_sla || 7);
    setRules(rulesRes.rules || []);
    setAxData(axRes);
    setLoading(false);
    setAxLoading(false);
  }
  useEffect(() => {
    reload();
  }, []);

  async function markFollowedUp(poId: number) {
    await fetch("/api/orders/followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poId }),
    });
    reload();
  }

  async function saveRule() {
    if (!editRule) return;
    await fetch("/api/orders/followups/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editRule),
    });
    setEditRule(null);
    reload();
  }

  async function deleteRule(vendor: string) {
    if (!confirm(`Delete rule for ${vendor}?`)) return;
    await fetch("/api/orders/followups/rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor }),
    });
    reload();
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">PO Follow-ups</h1>
        <Link href="/orders" className="text-sm text-accent hover:underline">
          ← back to orders
        </Link>
      </div>

      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Overdue POs ({overdue.length})
            </h2>
            <p className="text-xs text-muted mt-0.5">
              POs past their supplier SLA and not yet followed up. Default {defaultSla}d when no rule exists.
            </p>
          </div>
        </div>
        {loading ? (
          <div className="p-6 text-center text-muted text-sm">Loading…</div>
        ) : overdue.length === 0 ? (
          <div className="p-6 text-center text-muted text-sm">No overdue POs. Either everything is on time or nothing has been created yet.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted border-b border-card-border">
              <tr>
                <th className="px-4 py-2 text-left font-medium">AX PO #</th>
                <th className="px-4 py-2 text-left font-medium">Supplier</th>
                <th className="px-4 py-2 text-right font-medium">Lines</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">SLA</th>
                <th className="px-4 py-2 text-right font-medium">Overdue</th>
                <th className="px-4 py-2 text-left font-medium">State</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((p) => (
                <tr key={p.id} className="border-b border-card-border/50 hover:bg-amber-50/40">
                  <td className="px-4 py-1.5 font-mono">{p.ax_po_number || p.po_number}</td>
                  <td className="px-4 py-1.5">{p.supplier}</td>
                  <td className="px-4 py-1.5 text-right">{p.line_count}</td>
                  <td className="px-4 py-1.5 text-right font-mono">
                    ${p.total_cost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-1.5 text-right text-muted">{p.sla_days}d</td>
                  <td className="px-4 py-1.5 text-right font-mono text-amber-700">
                    <Clock className="h-3 w-3 inline mr-0.5" />+{p.days_overdue}d
                  </td>
                  <td className="px-4 py-1.5 text-muted">{p.dmf_state}</td>
                  <td className="px-4 py-1.5 text-right">
                    <button
                      onClick={() => markFollowedUp(p.id)}
                      className="px-2 py-1 rounded bg-accent text-white text-[10px] font-medium hover:opacity-90"
                    >
                      Mark followed up
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Supplier SLA rules</h2>
            <p className="text-xs text-muted mt-0.5">
              Per-supplier follow-up thresholds. No rule = {defaultSla}d default.
            </p>
          </div>
          <button
            onClick={() => setEditRule({ vendor: "", sla_days: defaultSla, email_template: null, updated_at: "" })}
            className="px-3 py-1.5 rounded bg-accent text-white text-xs font-medium inline-flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add rule
          </button>
        </div>
        <table className="w-full text-xs">
          <thead className="text-muted border-b border-card-border">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Vendor</th>
              <th className="px-4 py-2 text-right font-medium">SLA days</th>
              <th className="px-4 py-2 text-left font-medium">Email template</th>
              <th className="px-4 py-2 text-left font-medium">Updated</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.vendor} className="border-b border-card-border/50">
                <td className="px-4 py-1.5 font-mono">{r.vendor}</td>
                <td className="px-4 py-1.5 text-right">{r.sla_days}</td>
                <td className="px-4 py-1.5 text-muted truncate max-w-[300px]">{r.email_template || "—"}</td>
                <td className="px-4 py-1.5 text-muted">{r.updated_at?.slice(0, 10)}</td>
                <td className="px-4 py-1.5 text-right">
                  <button onClick={() => setEditRule(r)} className="text-accent text-[11px] mr-2">edit</button>
                  <button onClick={() => deleteRule(r.vendor)} className="text-red-600 text-[11px]">
                    <Trash2 className="h-3 w-3 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Award ↔ PO status from AX */}
      {axData && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="text-lg font-bold text-green-700">{axData.awards_shipped_count || 0}</div>
              <div className="text-[10px] text-green-600">Shipped to DLA</div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="text-lg font-bold text-blue-700">{axData.awards_received_pending_count || 0}</div>
              <div className="text-[10px] text-blue-600">Received from vendor</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="text-lg font-bold text-amber-700">{axData.awards_backorder?.length || 0}</div>
              <div className="text-[10px] text-amber-600">PO Backorder — chase vendor</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="text-lg font-bold text-red-700">{axData.awards_no_po?.length || 0}</div>
              <div className="text-[10px] text-red-600">No PO — needs PO or in stock</div>
            </div>
          </div>

          {axData.awards_no_po?.length > 0 && (
            <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
              <div className="px-6 py-3 bg-red-50 border-b border-card-border">
                <h2 className="font-semibold text-red-800 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Awards without PO ({axData.awards_no_po.length}) — need PO creation or ship from stock
                </h2>
              </div>
              <table className="w-full text-xs">
                <thead className="text-muted border-b border-card-border">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Contract</th>
                    <th className="px-4 py-2 text-left font-medium">NSN</th>
                    <th className="px-4 py-2 text-right font-medium">Qty</th>
                    <th className="px-4 py-2 text-right font-medium">Price</th>
                    <th className="px-4 py-2 text-left font-medium">Awarded</th>
                    <th className="px-4 py-2 text-left font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {axData.awards_no_po.slice(0, 100).map((a: any) => (
                    <tr key={a.id} className="border-b border-card-border/40">
                      <td className="px-4 py-1.5 font-mono text-[10px]">{a.contract_number}</td>
                      <td className="px-4 py-1.5 font-mono">{a.fsc}-{a.niin}</td>
                      <td className="px-4 py-1.5 text-right">{a.quantity}</td>
                      <td className="px-4 py-1.5 text-right font-mono">${a.unit_price?.toFixed(2)}</td>
                      <td className="px-4 py-1.5 text-muted">{formatDateShort(a.award_date)}</td>
                      <td className="px-4 py-1.5 text-muted truncate max-w-[200px]">{a.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {axData.awards_no_po.length > 100 && <div className="px-6 py-1 text-[10px] text-muted">Showing first 100 of {axData.awards_no_po.length}</div>}
            </div>
          )}

          {axData.awards_backorder?.length > 0 && (
            <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
              <div className="px-6 py-3 bg-amber-50 border-b border-card-border">
                <h2 className="font-semibold text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Awards with PO on backorder ({axData.awards_backorder.length}) — chase vendor
                </h2>
              </div>
              <table className="w-full text-xs">
                <thead className="text-muted border-b border-card-border">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Contract</th>
                    <th className="px-4 py-2 text-left font-medium">NSN</th>
                    <th className="px-4 py-2 text-right font-medium">Qty</th>
                    <th className="px-4 py-2 text-left font-medium">AX PO(s)</th>
                    <th className="px-4 py-2 text-left font-medium">Supplier</th>
                    <th className="px-4 py-2 text-left font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {axData.awards_backorder.slice(0, 100).map((a: any) => (
                    <tr key={a.id} className="border-b border-card-border/40">
                      <td className="px-4 py-1.5 font-mono text-[10px]">{a.contract_number}</td>
                      <td className="px-4 py-1.5 font-mono">{a.fsc}-{a.niin}</td>
                      <td className="px-4 py-1.5 text-right">{a.quantity}</td>
                      <td className="px-4 py-1.5 font-mono text-[10px]">
                        {a.links?.map((l: any) => `${l.ax_po_number}/${l.ax_line_number}`).join(", ")}
                      </td>
                      <td className="px-4 py-1.5 font-mono text-[10px]">{a.links?.[0]?.supplier || "—"}</td>
                      <td className="px-4 py-1.5">
                        <span className={`text-[10px] px-1 rounded ${a.links?.[0]?.confidence === "high" ? "bg-green-100 text-green-700" : a.links?.[0]?.confidence === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>
                          {a.links?.[0]?.confidence || "?"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {axData.ax_po_count > 0 && (
            <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
              <div className="px-6 py-3 border-b border-card-border">
                <h2 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  Open DD219 government POs in AX ({axData.ax_po_count})
                </h2>
                <p className="text-[10px] text-muted mt-0.5">DD219-marked PO lines still in Backorder status. Data refreshed nightly from AX.</p>
              </div>
              <table className="w-full text-xs">
                <thead className="text-muted border-b border-card-border">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">AX PO #</th>
                    <th className="px-4 py-2 text-right font-medium">Lines</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2 text-left font-medium">Earliest delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {axData.ax_government_pos?.slice(0, 50).map((po: any) => (
                    <tr key={po.po_number} className="border-b border-card-border/40">
                      <td className="px-4 py-1.5 font-mono">{po.po_number}</td>
                      <td className="px-4 py-1.5 text-right">{po.line_count}</td>
                      <td className="px-4 py-1.5 text-right font-mono">${po.total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-1.5 text-muted">{po.earliest_delivery ? formatDateShort(po.earliest_delivery) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {axLoading && !axData && <div className="text-center py-8 text-muted text-sm">Loading AX PO data...</div>}

      {editRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setEditRule(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-[500px] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-card-border">
              <h3 className="font-bold">{editRule.updated_at ? `Edit ${editRule.vendor}` : "New rule"}</h3>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Vendor (AX VendorAccountNumber)</label>
                <input
                  type="text"
                  value={editRule.vendor}
                  onChange={(e) => setEditRule({ ...editRule, vendor: e.target.value })}
                  disabled={!!editRule.updated_at}
                  className="w-full rounded border border-card-border px-3 py-2 text-sm font-mono disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">SLA (days)</label>
                <input
                  type="number"
                  min={1}
                  value={editRule.sla_days}
                  onChange={(e) => setEditRule({ ...editRule, sla_days: Number(e.target.value) })}
                  className="w-full rounded border border-card-border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Email template (optional — used by AX Send Confirmation, not DIBS)</label>
                <textarea
                  rows={3}
                  value={editRule.email_template || ""}
                  onChange={(e) => setEditRule({ ...editRule, email_template: e.target.value || null })}
                  className="w-full rounded border border-card-border px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="px-6 py-3 border-t border-card-border flex justify-end gap-2">
              <button onClick={() => setEditRule(null)} className="px-3 py-1.5 rounded border border-card-border text-xs">
                Cancel
              </button>
              <button onClick={saveRule} className="px-3 py-1.5 rounded bg-accent text-white text-xs font-medium inline-flex items-center gap-1">
                <Save className="h-3 w-3" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
