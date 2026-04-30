"use client";

import { useState, useMemo } from "react";
import { Send, Edit2, Save, X, Trash2, Mail, CheckCircle2, Clock, AlertCircle, Ban } from "lucide-react";

type Draft = {
  id: number;
  status: string;
  supplier_id: number | null;
  supplier_email: string;
  supplier_name: string;
  subject: string;
  body: string;
  lines: Array<{ nsn?: string; partNumber?: string; qty: number; description?: string }>;
  sol_id: string | null;
  source: string;
  created_at: string;
  sent_at: string | null;
  send_error: string | null;
};

type Counts = {
  total: number; draft: number; pending_send: number; sending: number;
  sent: number; send_failed: number; cancelled: number;
};

const STATUS_STYLES: Record<string, { color: string; icon: any; label: string }> = {
  draft: { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Mail, label: "Draft" },
  pending_send: { color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock, label: "Pending Send" },
  sending: { color: "bg-amber-50 text-amber-800 border-amber-300", icon: Clock, label: "Sending..." },
  sent: { color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2, label: "Sent" },
  send_failed: { color: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle, label: "Failed" },
  responded: { color: "bg-purple-50 text-purple-700 border-purple-200", icon: CheckCircle2, label: "Responded" },
  expired: { color: "bg-gray-50 text-gray-700 border-gray-200", icon: Clock, label: "Expired" },
  cancelled: { color: "bg-gray-50 text-gray-500 border-gray-200", icon: Ban, label: "Cancelled" },
};

export function RfqQueueDashboard({ drafts, counts }: { drafts: Draft[]; counts: Counts }) {
  const [filter, setFilter] = useState<string>("draft");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Draft>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const filtered = useMemo(() => {
    let r = drafts;
    if (filter !== "all") r = r.filter((d) => d.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((d) =>
        d.supplier_name.toLowerCase().includes(q) ||
        d.supplier_email.toLowerCase().includes(q) ||
        d.subject.toLowerCase().includes(q) ||
        (d.sol_id || "").toLowerCase().includes(q) ||
        d.lines.some((l) => (l.nsn || "").includes(q) || (l.partNumber || "").toLowerCase().includes(q))
      );
    }
    return r;
  }, [drafts, filter, search]);

  function toggleSelect(id: number) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  }
  function selectAll() {
    setSelected(new Set(filtered.filter((d) => d.status === "draft").map((d) => d.id)));
  }
  function clearSel() { setSelected(new Set()); }

  async function sendIds(ids: number[]) {
    if (ids.length === 0) return;
    if (!confirm(`Queue ${ids.length} RFQ(s) for sending? They'll go out via the daemon within ~1 min.`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/rfq/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(`Send failed: ${d.error || r.status}`); return; }
      setMsg(d.note || `Queued ${d.queued || 0} for send.`);
      clearSel();
      setTimeout(() => location.reload(), 800);
    } finally { setBusy(false); }
  }

  async function cancelDraft(id: number) {
    if (!confirm("Cancel this draft?")) return;
    await fetch(`/api/rfq/${id}`, { method: "DELETE" });
    setTimeout(() => location.reload(), 200);
  }

  async function saveEdit(id: number) {
    setBusy(true);
    try {
      const r = await fetch(`/api/rfq/${id}`, {
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
      setTimeout(() => location.reload(), 300);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Mail className="h-6 w-6" /> RFQ Queue
        </h1>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">{selected.size} selected</span>
            <button
              onClick={() => sendIds([...selected])}
              disabled={busy}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Send Selected
            </button>
            <button onClick={clearSel} className="text-sm text-muted hover:text-foreground">Clear</button>
          </div>
        )}
      </div>

      {msg && (
        <div className="mb-3 p-2 text-sm bg-amber-50 border border-amber-200 rounded">{msg}</div>
      )}

      <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mb-4">
        <SummaryCard label="All" value={counts.total} active={filter === "all"} onClick={() => setFilter("all")} />
        <SummaryCard label="Draft" value={counts.draft} active={filter === "draft"} onClick={() => setFilter("draft")} blue />
        <SummaryCard label="Pending" value={counts.pending_send} active={filter === "pending_send"} onClick={() => setFilter("pending_send")} amber />
        <SummaryCard label="Sending" value={counts.sending} active={filter === "sending"} onClick={() => setFilter("sending")} amber />
        <SummaryCard label="Sent" value={counts.sent} active={filter === "sent"} onClick={() => setFilter("sent")} green />
        <SummaryCard label="Failed" value={counts.send_failed} active={filter === "send_failed"} onClick={() => setFilter("send_failed")} red />
        <SummaryCard label="Cancelled" value={counts.cancelled} active={filter === "cancelled"} onClick={() => setFilter("cancelled")} gray />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          placeholder="Search by supplier, NSN, sol, subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border rounded text-sm"
        />
        {filter === "draft" && filtered.length > 0 && (
          <button onClick={selectAll} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
            Select All ({filtered.length})
          </button>
        )}
      </div>

      <div className="text-xs text-muted mb-2">
        Showing {filtered.length} of {counts.total}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="border rounded p-8 text-center text-muted">
            No drafts match the current filter.
          </div>
        )}
        {filtered.map((d) => {
          const style = STATUS_STYLES[d.status] || STATUS_STYLES.draft;
          const Icon = style.icon;
          const isEditing = editingId === d.id;
          const checked = selected.has(d.id);
          return (
            <div key={d.id} className={`border rounded p-3 ${checked ? "bg-blue-50/40 border-blue-300" : "bg-white"}`}>
              <div className="flex items-start gap-3">
                {d.status === "draft" && (
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(d.id)}
                    className="mt-1"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border ${style.color}`}>
                        <Icon className="h-3 w-3" /> {style.label}
                      </span>
                      <span className="text-sm font-medium">{d.supplier_name}</span>
                      <span className="text-xs text-muted">{d.supplier_email}</span>
                      {d.sol_id && <span className="text-xs text-muted">• sol {d.sol_id}</span>}
                      <span className="text-xs text-muted">• {d.source}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {d.status === "draft" && !isEditing && (
                        <>
                          <button
                            onClick={() => sendIds([d.id])}
                            disabled={busy}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            <Send className="h-3 w-3 inline" /> Send
                          </button>
                          <button
                            onClick={() => { setEditingId(d.id); setEditDraft({ subject: d.subject, body: d.body, supplier_email: d.supplier_email }); }}
                            className="p-1 hover:bg-gray-100 rounded" title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => cancelDraft(d.id)} className="p-1 hover:bg-red-50 rounded" title="Cancel">
                            <Trash2 className="h-3.5 w-3.5 text-red-700" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {!isEditing ? (
                    <>
                      <div className="text-sm font-medium mb-1">{d.subject}</div>
                      <div className="text-xs text-muted mb-2">
                        {d.lines.length} line(s):{" "}
                        {d.lines.slice(0, 4).map((l) => l.nsn || l.partNumber).join(", ")}
                        {d.lines.length > 4 && ` +${d.lines.length - 4} more`}
                      </div>
                      <details>
                        <summary className="cursor-pointer text-xs text-blue-700 hover:underline">Show body</summary>
                        <pre className="text-xs font-mono whitespace-pre-wrap bg-gray-50 border rounded p-2 mt-1 max-h-64 overflow-y-auto">{d.body}</pre>
                      </details>
                      {d.send_error && (
                        <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                          Send error: {d.send_error}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="email"
                        value={editDraft.supplier_email ?? d.supplier_email}
                        onChange={(e) => setEditDraft({ ...editDraft, supplier_email: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        placeholder="Recipient email"
                      />
                      <input
                        type="text"
                        value={editDraft.subject ?? d.subject}
                        onChange={(e) => setEditDraft({ ...editDraft, subject: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        placeholder="Subject"
                      />
                      <textarea
                        value={editDraft.body ?? d.body}
                        onChange={(e) => setEditDraft({ ...editDraft, body: e.target.value })}
                        rows={12}
                        className="w-full px-2 py-1 border rounded font-mono text-xs"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(d.id)} disabled={busy} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">
                          <Save className="h-3 w-3 inline" /> Save
                        </button>
                        <button onClick={() => { setEditingId(null); setEditDraft({}); }} className="px-2 py-1 text-xs border rounded">
                          <X className="h-3 w-3 inline" /> Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted mt-1">
                    Created {new Date(d.created_at).toLocaleString()}
                    {d.sent_at && ` • Sent ${new Date(d.sent_at).toLocaleString()}`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({
  label, value, active, onClick, blue, amber, green, red, gray,
}: {
  label: string; value: number; active?: boolean; onClick?: () => void;
  blue?: boolean; amber?: boolean; green?: boolean; red?: boolean; gray?: boolean;
}) {
  const color = blue ? "border-blue-300" : amber ? "border-amber-300" : green ? "border-green-300" : red ? "border-red-300" : gray ? "border-gray-300" : "border-blue-300";
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
