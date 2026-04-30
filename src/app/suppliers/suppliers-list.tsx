"use client";

import { useState, useMemo } from "react";
import { Mail, Plus, Edit2, Save, X, Ban, CheckCircle, Building2 } from "lucide-react";

type Supplier = {
  id: number;
  ax_vendor_account: string | null;
  ax_data_area: string | null;
  cage: string | null;
  name: string;
  email: string | null;
  email_alternates: string[] | null;
  phone: string | null;
  source: string;
  confidence: number | null;
  last_verified: string | null;
  last_rfq_sent: string | null;
  rfq_count_total: number;
  blocked: boolean;
  blocked_reason: string | null;
  notes: string | null;
};

type Counts = {
  total: number; ax: number; research: number; manual: number;
  blocked: number; withEmail: number;
};

const SOURCE_STYLES: Record<string, string> = {
  ax: "bg-green-50 text-green-700 border-green-200",
  research: "bg-purple-50 text-purple-700 border-purple-200",
  manual: "bg-blue-50 text-blue-700 border-blue-200",
};

export function SuppliersList({
  rows,
  counts,
  lastSync,
}: {
  rows: Supplier[];
  counts: Counts;
  lastSync: { created_at: string; details: any } | null;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Supplier>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDraft, setAddDraft] = useState({ name: "", email: "", cage: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const filtered = useMemo(() => {
    let r = rows;
    if (filter === "ax") r = r.filter((x) => x.source === "ax");
    else if (filter === "research") r = r.filter((x) => x.source === "research");
    else if (filter === "manual") r = r.filter((x) => x.source === "manual");
    else if (filter === "blocked") r = r.filter((x) => x.blocked);
    else if (filter === "no-email") r = r.filter((x) => !x.email);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((x) =>
        x.name.toLowerCase().includes(q) ||
        (x.email || "").toLowerCase().includes(q) ||
        (x.cage || "").toLowerCase().includes(q) ||
        (x.ax_vendor_account || "").toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, filter, search]);

  async function saveEdit(id: number) {
    setBusy(true);
    try {
      const r = await fetch(`/api/suppliers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg(`Save failed: ${d.error || r.status}`);
        return;
      }
      setEditingId(null);
      setEditDraft({});
      setMsg("Saved.");
      setTimeout(() => location.reload(), 500);
    } finally {
      setBusy(false);
    }
  }

  async function addSupplier() {
    if (!addDraft.name.trim() || !addDraft.email.trim()) {
      setMsg("Name and email are required.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...addDraft, source: "manual" }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg(`Add failed: ${d.error || r.status}`);
        return;
      }
      setShowAddForm(false);
      setAddDraft({ name: "", email: "", cage: "", notes: "" });
      setMsg("Added.");
      setTimeout(() => location.reload(), 500);
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlocked(id: number, blocked: boolean) {
    const reason = blocked ? prompt("Reason for blocking? (optional)") : null;
    await fetch(`/api/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked, blocked_reason: reason }),
    });
    setTimeout(() => location.reload(), 200);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Building2 className="h-6 w-6" /> Suppliers
        </h1>
        <div className="flex items-center gap-3">
          {lastSync && (
            <span className="text-xs text-muted">AX sync: {new Date(lastSync.created_at).toLocaleString()}</span>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Add Manual
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-3 p-2 text-sm bg-amber-50 border border-amber-200 rounded">{msg}</div>
      )}

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        <SummaryCard label="Total" value={counts.total} active={filter === "all"} onClick={() => setFilter("all")} />
        <SummaryCard label="From AX" value={counts.ax} active={filter === "ax"} onClick={() => setFilter("ax")} />
        <SummaryCard label="Research" value={counts.research} active={filter === "research"} onClick={() => setFilter("research")} />
        <SummaryCard label="Manual" value={counts.manual} active={filter === "manual"} onClick={() => setFilter("manual")} />
        <SummaryCard label="Blocked" value={counts.blocked} active={filter === "blocked"} onClick={() => setFilter("blocked")} red />
        <SummaryCard label="No Email" value={counts.total - counts.withEmail} active={filter === "no-email"} onClick={() => setFilter("no-email")} amber />
      </div>

      <input
        type="text"
        placeholder="Search by name, email, CAGE, or AX account..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-3 px-3 py-2 border rounded text-sm"
      />

      {showAddForm && (
        <div className="mb-3 p-3 border rounded bg-blue-50">
          <div className="font-semibold mb-2 text-sm">Add Manual Supplier</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
            <input
              type="text" placeholder="Name *"
              value={addDraft.name}
              onChange={(e) => setAddDraft({ ...addDraft, name: e.target.value })}
              className="px-2 py-1 border rounded text-sm"
            />
            <input
              type="email" placeholder="Email *"
              value={addDraft.email}
              onChange={(e) => setAddDraft({ ...addDraft, email: e.target.value })}
              className="px-2 py-1 border rounded text-sm"
            />
            <input
              type="text" placeholder="CAGE (optional)"
              value={addDraft.cage}
              onChange={(e) => setAddDraft({ ...addDraft, cage: e.target.value })}
              className="px-2 py-1 border rounded text-sm"
            />
            <input
              type="text" placeholder="Notes (optional)"
              value={addDraft.notes}
              onChange={(e) => setAddDraft({ ...addDraft, notes: e.target.value })}
              className="px-2 py-1 border rounded text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addSupplier} disabled={busy}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => { setShowAddForm(false); setAddDraft({ name: "", email: "", cage: "", notes: "" }); }}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="text-xs text-muted mb-2">
        Showing {filtered.length} of {counts.total}
      </div>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">CAGE / AX</th>
              <th className="text-left px-3 py-2">Source</th>
              <th className="text-left px-3 py-2">RFQ Sent</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2 w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted py-8">No suppliers match.</td>
              </tr>
            )}
            {filtered.map((s) => {
              const isEditing = editingId === s.id;
              return (
                <tr key={s.id} className={`border-b ${s.blocked ? "bg-red-50/30" : "hover:bg-gray-50"}`}>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editDraft.name ?? s.name}
                        onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                        className="px-1 py-0.5 border rounded text-sm w-full"
                      />
                    ) : (
                      <span className="font-medium">{s.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {isEditing ? (
                      <input
                        type="email"
                        value={editDraft.email ?? s.email ?? ""}
                        onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })}
                        className="px-1 py-0.5 border rounded text-sm w-full"
                      />
                    ) : (
                      <>
                        {s.email ? (
                          <a href={`mailto:${s.email}`} className="text-blue-600 hover:underline font-mono">{s.email}</a>
                        ) : <span className="text-amber-600">—</span>}
                        {s.email_alternates && s.email_alternates.length > 0 && (
                          <div className="text-muted text-xs">+{s.email_alternates.length} alt</div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {s.cage || "—"}
                    {s.ax_vendor_account && <div className="text-muted">{s.ax_vendor_account}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded border ${SOURCE_STYLES[s.source] || "bg-gray-50 border-gray-200"}`}>
                      {s.source}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {s.rfq_count_total > 0 ? (
                      <>
                        {s.rfq_count_total}× total
                        {s.last_rfq_sent && <div className="text-muted">last: {new Date(s.last_rfq_sent).toLocaleDateString()}</div>}
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {s.blocked ? (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <Ban className="h-3 w-3" /> blocked
                        {s.blocked_reason && <div className="text-muted">{s.blocked_reason}</div>}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <CheckCircle className="h-3 w-3" /> ok
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button onClick={() => saveEdit(s.id)} disabled={busy} className="p-1 hover:bg-green-50 rounded">
                          <Save className="h-3.5 w-3.5 text-green-700" />
                        </button>
                        <button onClick={() => { setEditingId(null); setEditDraft({}); }} className="p-1 hover:bg-gray-100 rounded">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingId(s.id); setEditDraft({}); }}
                          className="p-1 hover:bg-gray-100 rounded" title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleBlocked(s.id, !s.blocked)}
                          className={`p-1 rounded ${s.blocked ? "hover:bg-green-50" : "hover:bg-red-50"}`}
                          title={s.blocked ? "Unblock" : "Block"}
                        >
                          {s.blocked ? <CheckCircle className="h-3.5 w-3.5 text-green-700" /> : <Ban className="h-3.5 w-3.5 text-red-700" />}
                        </button>
                        {s.email && (
                          <a href={`mailto:${s.email}`} className="p-1 hover:bg-blue-50 rounded" title="Email">
                            <Mail className="h-3.5 w-3.5 text-blue-700" />
                          </a>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label, value, active, onClick, red, amber,
}: {
  label: string; value: number; active?: boolean; onClick?: () => void; red?: boolean; amber?: boolean;
}) {
  const color = red ? "border-red-300" : amber ? "border-amber-300" : "border-blue-300";
  return (
    <button
      onClick={onClick}
      className={`p-2 border rounded text-left transition ${active ? `bg-blue-50 ${color} ring-2 ring-blue-200` : `bg-white ${color} hover:bg-gray-50`}`}
    >
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </button>
  );
}
