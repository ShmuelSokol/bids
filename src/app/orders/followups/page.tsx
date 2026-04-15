"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Plus, Save, Trash2 } from "lucide-react";

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

  async function reload() {
    setLoading(true);
    const [ovRes, rulesRes] = await Promise.all([
      fetch("/api/orders/followups").then((r) => r.json()),
      fetch("/api/orders/followups/rules").then((r) => r.json()),
    ]);
    setOverdue(ovRes.overdue || []);
    setDefaultSla(ovRes.default_sla || 7);
    setRules(rulesRes.rules || []);
    setLoading(false);
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
