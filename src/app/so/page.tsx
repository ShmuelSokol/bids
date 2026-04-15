"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Upload, CheckCircle, AlertTriangle, Package, Plus, Trash2 } from "lucide-react";

type ValidateResult = {
  batch_id: string | null;
  checked: number;
  ready: any[];
  dodaac_missing: { dodaac: string; awards: any[] }[];
  nsn_missing: { nsn: string; awards: any[]; part_no_hint: string | null }[];
  note?: string;
};

export default function SoUploadPage() {
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [dodaacRows, setDodaacRows] = useState<any[]>([]);
  const [dodaacPaste, setDodaacPaste] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadDodaacs() {
    const r = await fetch("/api/so/dodaacs");
    const d = await r.json();
    setDodaacRows(d.rows || []);
  }
  useEffect(() => { loadDodaacs(); }, []);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/so/upload", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) setError(d.error || "Upload failed");
      else setUploadResult(d);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function validate(batchId?: string) {
    setValidating(true); setError("");
    try {
      const r = await fetch("/api/so/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchId ? { batch_id: batchId } : {}),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error || "Validate failed");
      else setResult(d);
    } finally {
      setValidating(false);
    }
  }

  async function saveDodaacPaste() {
    // Each line: DODAAC<tab>address_id  OR  DODAAC,address_id
    const lines = dodaacPaste.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows = lines.map((l) => {
      const parts = l.split(/[\t,]/).map((x) => x.trim());
      return { dodaac: parts[0], address_id: parts[1] };
    }).filter((r) => r.dodaac && r.address_id);
    if (rows.length === 0) { setError("Nothing parseable. Expected DODAAC<TAB>address_id per line."); return; }
    const r = await fetch("/api/so/dodaacs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const d = await r.json();
    if (!r.ok) setError(d.error || "Save failed");
    else {
      setDodaacPaste("");
      await loadDodaacs();
      setError("");
    }
  }

  async function deleteDodaac(d: string) {
    if (!confirm(`Delete ${d}?`)) return;
    await fetch("/api/so/dodaacs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dodaac: d }) });
    await loadDodaacs();
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Sales Order Upload &amp; Validate</h1>
        <p className="text-muted text-sm mt-1">
          Upload LamLinks awards file, DIBS pre-validates DODAAC + NSN against AX, Abe handles errors in AX + re-uploads before running the MPI Sales Order import.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm border border-red-200">{error}</div>
      )}

      {/* Upload */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="px-6 py-4 border-b border-card-border">
          <h2 className="font-semibold">1. Upload LamLinks awards file</h2>
          <p className="text-xs text-muted mt-1">
            The .xlsx Abe normally downloads from LamLinks. DIBS will strip today's partial-day rows automatically (matches Yosef's VBA macro).
          </p>
        </div>
        <div className="p-6 flex items-center gap-3">
          <input ref={fileRef} type="file" accept=".xlsx" onChange={upload} disabled={uploading} className="text-sm" />
          {uploading && <span className="text-sm text-muted inline-flex items-center gap-1"><Upload className="h-4 w-4 animate-pulse" /> parsing...</span>}
        </div>
        {uploadResult && (
          <div className="px-6 pb-4 text-xs text-muted">
            ✓ Saved <strong>{uploadResult.saved}</strong> rows as batch <code className="font-mono">{uploadResult.batch_id}</code>
            {uploadResult.stripped_today > 0 && <> — stripped {uploadResult.stripped_today} partial-day rows (cutoff {uploadResult.cutoff_date})</>}
            <button onClick={() => validate(uploadResult.batch_id)} disabled={validating} className="ml-3 px-2.5 py-1 rounded bg-accent text-white text-[11px] font-medium">
              {validating ? "Validating..." : "Validate this batch →"}
            </button>
          </div>
        )}
      </div>

      {/* Validate anytime */}
      <div className="flex gap-2">
        <button onClick={() => validate()} disabled={validating} className="px-3 py-1.5 rounded border border-card-border bg-card-bg text-sm font-medium">
          {validating ? "Validating..." : "Validate latest batch"}
        </button>
      </div>

      {/* Validation result */}
      {result && (
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border">
            <h2 className="font-semibold">Validation — batch {result.batch_id}</h2>
            <p className="text-xs text-muted">Fix everything flagged below BEFORE running the MPI Sales Order import.</p>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Ready for MPI" count={result.ready.length} tone="green" />
              <StatCard label="DODAAC not mapped" count={result.dodaac_missing.length} tone="amber" />
              <StatCard label="NSN no AX item" count={result.nsn_missing.length} tone="red" />
            </div>

            {result.dodaac_missing.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  DODAACs not in DIBS cache ({result.dodaac_missing.length})
                </h3>
                <p className="text-xs text-muted mb-2">
                  Add these to AX (DD219 customer address list) AND to the DIBS cache below. DIBS cache is independent of AX — both need the mapping for the SO import + DIBS validation to pass.
                </p>
                <div className="rounded border border-card-border max-h-64 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr><th className="px-3 py-1.5 text-left">DODAAC</th><th className="px-3 py-1.5 text-right">Awards affected</th><th className="px-3 py-1.5 text-left">Example contract</th></tr>
                    </thead>
                    <tbody>
                      {result.dodaac_missing.map((d, i) => (
                        <tr key={i} className="border-t border-card-border/40">
                          <td className="px-3 py-1.5 font-mono text-accent">{d.dodaac}</td>
                          <td className="px-3 py-1.5 text-right">{d.awards.length}</td>
                          <td className="px-3 py-1.5 font-mono text-[10px] text-muted">{d.awards[0]?.contract_no || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.nsn_missing.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-red-600" />
                  NSNs with no AX item ({result.nsn_missing.length})
                </h3>
                <p className="text-xs text-muted mb-2">
                  Each NSN needs an item created in AX (via NPI) or attached to an existing item's barcode list.
                </p>
                <div className="rounded border border-card-border max-h-64 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr><th className="px-3 py-1.5 text-left">NSN</th><th className="px-3 py-1.5 text-right">Awards</th><th className="px-3 py-1.5 text-left">Part # hint</th></tr>
                    </thead>
                    <tbody>
                      {result.nsn_missing.map((n, i) => (
                        <tr key={i} className="border-t border-card-border/40">
                          <td className="px-3 py-1.5 font-mono text-accent">{n.nsn}</td>
                          <td className="px-3 py-1.5 text-right">{n.awards.length}</td>
                          <td className="px-3 py-1.5 font-mono text-[10px] text-muted">{n.part_no_hint || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.dodaac_missing.length === 0 && result.nsn_missing.length === 0 && result.ready.length > 0 && (
              <div className="rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                All {result.checked} awards passed validation. Safe to run the MPI Sales Order import now.
              </div>
            )}

            {result.note && (
              <p className="text-xs text-muted italic">{result.note}</p>
            )}
          </div>
        </div>
      )}

      {/* DODAAC cache management */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="px-6 py-4 border-b border-card-border">
          <h2 className="font-semibold">DIBS DODAAC cache ({dodaacRows.length})</h2>
          <p className="text-xs text-muted mt-1">
            Local copy of the AX DODAAC→address_id mapping, used for DIBS-side validation. Keep in sync with AX's DD219 customer address list.
          </p>
        </div>
        <div className="p-6 space-y-3">
          <label className="text-xs font-medium text-muted block">Paste DODAACs (one per line, <code>DODAAC&lt;tab&gt;address_id</code>):</label>
          <textarea
            rows={4}
            value={dodaacPaste}
            onChange={(e) => setDodaacPaste(e.target.value)}
            placeholder="W569FT\t000001234&#10;SW3210\t000005678"
            className="w-full rounded border border-card-border px-3 py-2 text-xs font-mono"
          />
          <button onClick={saveDodaacPaste} className="px-3 py-1.5 rounded bg-accent text-white text-xs font-medium inline-flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add to cache
          </button>
          {dodaacRows.length > 0 && (
            <div className="rounded border border-card-border max-h-72 overflow-auto mt-2">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0 text-muted">
                  <tr>
                    <th className="px-3 py-1.5 text-left">DODAAC</th>
                    <th className="px-3 py-1.5 text-left">Address ID</th>
                    <th className="px-3 py-1.5 text-left">Description</th>
                    <th className="px-3 py-1.5 text-left">Added by</th>
                    <th className="px-3 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {dodaacRows.map((r) => (
                    <tr key={r.dodaac} className="border-t border-card-border/40">
                      <td className="px-3 py-1.5 font-mono">{r.dodaac}</td>
                      <td className="px-3 py-1.5 font-mono">{r.address_id}</td>
                      <td className="px-3 py-1.5 text-muted">{r.address_description || "—"}</td>
                      <td className="px-3 py-1.5 text-[10px] text-muted">{r.added_by || "—"}</td>
                      <td className="px-3 py-1.5 text-right">
                        <button onClick={() => deleteDodaac(r.dodaac)} className="text-red-600">
                          <Trash2 className="h-3 w-3 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-muted">
        <Link href="/orders" className="text-accent hover:underline">← back to orders</Link>
      </div>
    </div>
  );
}

function StatCard({ label, count, tone }: { label: string; count: number; tone: "green" | "amber" | "red" }) {
  const bg = tone === "green" ? "bg-green-50 border-green-200" : tone === "amber" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  const fg = tone === "green" ? "text-green-700" : tone === "amber" ? "text-amber-700" : "text-red-700";
  return (
    <div className={`rounded-lg border p-3 text-center ${bg}`}>
      <div className={`text-2xl font-bold ${fg}`}>{count}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}
