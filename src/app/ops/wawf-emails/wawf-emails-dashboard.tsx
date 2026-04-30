"use client";

import { useState, useMemo } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, Mail } from "lucide-react";

type EmailRow = {
  id: number;
  ews_uid: string;
  received_at: string;
  subject: string | null;
  form_type: string | null;
  contract_no: string | null;
  cin: string | null;
  shipment_no: string | null;
  wawf_tcn: string | null;
  outcome: string;
  error_text: string | null;
  matched_kaj: number | null;
  kbr_action: string | null;
  alerted: boolean;
  raw_body: string | null;
};

type Counts = {
  total: number;
  accepted: number;
  rejected: number;
  rejectedBenign: number;
  unparseable: number;
  alertsFired: number;
};

const OUTCOME_STYLES: Record<string, { icon: any; color: string; label: string }> = {
  accepted: { icon: CheckCircle2, color: "text-green-700 bg-green-50 border-green-200", label: "Accepted" },
  accepted_with_modifications: { icon: CheckCircle2, color: "text-green-700 bg-green-50 border-green-200", label: "Accepted (mods)" },
  rejected: { icon: AlertCircle, color: "text-red-700 bg-red-50 border-red-200", label: "REJECTED" },
  rejected_benign: { icon: AlertTriangle, color: "text-amber-700 bg-amber-50 border-amber-200", label: "Reject (benign)" },
  unparseable: { icon: HelpCircle, color: "text-gray-700 bg-gray-50 border-gray-200", label: "Unparseable" },
};

export function WawfEmailsDashboard({
  rows,
  counts,
  lastSync,
}: {
  rows: EmailRow[];
  counts: Counts;
  lastSync: { created_at: string; details: any } | null;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState<string>("");

  const filtered = useMemo(() => {
    let r = rows;
    if (filter !== "all") {
      r = r.filter((row) => {
        if (filter === "accepted") return row.outcome === "accepted" || row.outcome === "accepted_with_modifications";
        return row.outcome === filter;
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((row) =>
        (row.cin || "").toLowerCase().includes(q) ||
        (row.contract_no || "").toLowerCase().includes(q) ||
        (row.subject || "").toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, filter, search]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Mail className="h-6 w-6" /> WAWF Email Parser
        </h1>
        <div className="text-xs text-muted">
          {lastSync ? `Last parser run: ${new Date(lastSync.created_at).toLocaleString()}` : "No parser run logged yet."}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-6">
        <SummaryCard label="Total" value={counts.total} active={filter === "all"} onClick={() => setFilter("all")} />
        <SummaryCard label="Accepted" value={counts.accepted} active={filter === "accepted"} onClick={() => setFilter("accepted")} green />
        <SummaryCard label="Rejected (real)" value={counts.rejected} active={filter === "rejected"} onClick={() => setFilter("rejected")} red />
        <SummaryCard label="Rejected (benign)" value={counts.rejectedBenign} active={filter === "rejected_benign"} onClick={() => setFilter("rejected_benign")} amber />
        <SummaryCard label="Unparseable" value={counts.unparseable} active={filter === "unparseable"} onClick={() => setFilter("unparseable")} gray />
        <SummaryCard label="Alerts Fired" value={counts.alertsFired} red />
      </div>

      <input
        type="text"
        placeholder="Search by CIN, contract, or subject..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-4 px-3 py-2 border rounded text-sm"
      />

      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-3 py-2">Received</th>
              <th className="text-left px-3 py-2">Outcome</th>
              <th className="text-left px-3 py-2">Form</th>
              <th className="text-left px-3 py-2">Contract</th>
              <th className="text-left px-3 py-2">CIN</th>
              <th className="text-left px-3 py-2">Ship #</th>
              <th className="text-left px-3 py-2">TCN</th>
              <th className="text-left px-3 py-2">Action Taken</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted py-8">No emails match the current filter.</td>
              </tr>
            )}
            {filtered.map((row) => {
              const style = OUTCOME_STYLES[row.outcome] || OUTCOME_STYLES.unparseable;
              const Icon = style.icon;
              const isExpanded = expanded === row.id;
              return (
                <>
                  <tr
                    key={row.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : row.id)}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(row.received_at).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${style.color}`}>
                        <Icon className="h-3 w-3" /> {style.label}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.form_type || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.contract_no || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.cin || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.shipment_no || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.wawf_tcn || "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.kbr_action || "—"}
                      {row.alerted && <span className="ml-1 text-red-600">⚠ alerted</span>}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`exp-${row.id}`}>
                      <td colSpan={8} className="px-3 py-3 bg-gray-50 border-b">
                        <div className="text-xs">
                          <div className="font-semibold mb-1">Subject:</div>
                          <div className="font-mono mb-2">{row.subject || "(empty)"}</div>
                          {row.error_text && (
                            <>
                              <div className="font-semibold mb-1">Error text:</div>
                              <pre className="font-mono whitespace-pre-wrap bg-red-50 border border-red-200 rounded p-2 mb-2">{row.error_text}</pre>
                            </>
                          )}
                          {row.matched_kaj && (
                            <div className="text-muted">Matched LL kaj: <span className="font-mono">{row.matched_kaj}</span></div>
                          )}
                          {row.raw_body && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-muted hover:text-foreground">Show raw email body</summary>
                              <pre className="font-mono whitespace-pre-wrap bg-white border rounded p-2 mt-1 max-h-96 overflow-y-auto">{row.raw_body}</pre>
                            </details>
                          )}
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
    </div>
  );
}

function SummaryCard({
  label, value, active, onClick, green, red, amber, gray,
}: {
  label: string; value: number; active?: boolean; onClick?: () => void;
  green?: boolean; red?: boolean; amber?: boolean; gray?: boolean;
}) {
  const colorClass = green ? "border-green-300" : red ? "border-red-300" : amber ? "border-amber-300" : gray ? "border-gray-300" : "border-blue-300";
  return (
    <button
      onClick={onClick}
      className={`p-3 border rounded text-left transition ${active ? `bg-blue-50 ${colorClass} ring-2 ring-blue-200` : `bg-white ${colorClass} hover:bg-gray-50`}`}
    >
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </button>
  );
}
