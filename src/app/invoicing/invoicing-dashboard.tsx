"use client";

import { useState, useMemo } from "react";
import {
  Receipt, Upload, Download, Clock, Check, AlertTriangle,
  Mail, DollarSign, FileText, Loader2, ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { trackAction } from "@/components/activity-tracker";
import { formatDateShort, formatDateTime } from "@/lib/dates";

interface Award {
  id: number;
  fsc: string;
  niin: string;
  description: string;
  unit_price: number;
  quantity: number;
  award_date: string;
  contract_number: string;
  cage: string;
  order_number?: string;
  po_generated?: boolean;
  po_id?: number;
  [key: string]: unknown;
}

interface POLine {
  id: number;
  po_id: number;
  nsn: string;
  description: string;
  quantity: number;
  unit_cost: number;
  sell_price: number;
  margin_pct: number;
  supplier: string;
  contract_number: string;
  fob?: string;
  purchase_orders?: {
    po_number: string;
    supplier: string;
    status: string;
    created_by: string;
  };
}

interface SubmittedBid {
  solicitation_number: string;
  nsn: string;
  nomenclature: string;
  quantity: number;
  final_price: number;
  lead_time_days: number;
  updated_at: string;
}

// Invoice number generation (matching src/lib/invoicing.ts logic)
function stripToGovFormat(contractNum: string, lineIdx: number, totalLines: number): string {
  let stripped = contractNum.replace(/[^0-9]/g, "");
  if (stripped.length > 7) stripped = stripped.slice(-7);
  while (stripped.length < 7) stripped = "0" + stripped;
  if (totalLines > 1 && lineIdx > 0) {
    const suffix = String.fromCharCode(65 + lineIdx - 1);
    stripped = stripped.slice(0, 6) + suffix;
  }
  return stripped;
}

const wafStatusColors: Record<string, string> = {
  ready: "bg-blue-100 text-blue-700",
  submitted: "bg-yellow-100 text-yellow-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
};

export function InvoicingDashboard({
  awards,
  poLines,
  submittedBids,
  lastInvoiceSync,
}: {
  awards: Award[];
  poLines: POLine[];
  submittedBids: SubmittedBid[];
  lastInvoiceSync: any;
}) {
  const [generating, setGenerating] = useState(false);
  const [ediResult, setEdiResult] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [remittanceText, setRemittanceText] = useState("");
  const [showRemittance, setShowRemittance] = useState(false);
  const [remittanceResult, setRemittanceResult] = useState<any>(null);
  const [parsingRemittance, setParsingRemittance] = useState(false);

  // Build invoice-ready items from awards that have POs
  const readyToInvoice = useMemo(() => {
    // Group awards by contract number
    const byContract = new Map<string, Award[]>();
    for (const a of awards) {
      if (!a.contract_number) continue;
      if (!byContract.has(a.contract_number)) byContract.set(a.contract_number, []);
      byContract.get(a.contract_number)!.push(a);
    }

    const items: Array<Award & {
      lineIdx: number;
      totalLines: number;
      govInvoice: string;
      totalAmount: number;
    }> = [];

    for (const [contract, contractAwards] of byContract) {
      contractAwards.forEach((a, idx) => {
        const amount = (a.unit_price || 0) * (a.quantity || 1);
        items.push({
          ...a,
          lineIdx: idx,
          totalLines: contractAwards.length,
          govInvoice: stripToGovFormat(contract, idx, contractAwards.length),
          totalAmount: amount,
        });
      });
    }

    return items.slice(0, 100); // Show first 100
  }, [awards]);

  // Stats
  const totalReady = readyToInvoice.length;
  const totalAmount = readyToInvoice.reduce((s, inv) => s + inv.totalAmount, 0);
  const poCount = poLines.length;
  const submittedCount = submittedBids.length;

  // Select all / toggle
  function toggleSelectAll() {
    if (selectedIds.size === readyToInvoice.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(readyToInvoice.map(a => a.id)));
    }
  }

  function toggleSelect(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  // Generate EDI 810 for selected awards
  async function handleGenerateEdi() {
    if (selectedIds.size === 0) return;
    setGenerating(true);
    trackAction("invoice", "generate_edi", { count: selectedIds.size });

    try {
      const selected = readyToInvoice.filter(a => selectedIds.has(a.id));
      const res = await fetch("/api/invoices/generate-edi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoices: selected.map(a => ({
            invoiceNumber: a.govInvoice,
            invoiceDate: new Date().toISOString().replace(/-/g, "").slice(0, 8),
            contractNumber: a.contract_number,
            contractDate: a.award_date?.replace(/-/g, "").slice(0, 8) || "",
            shipToName: "DLA DISTRIBUTION",
            shipToAddress: "RECEIVING DOCK",
            shipToCity: "NEW CUMBERLAND",
            shipToState: "PA",
            shipToZip: "17070",
            shipToDodaac: "W25G1U",
            lines: [{
              lineNumber: String(a.lineIdx + 1).padStart(4, "0"),
              nsn: `${a.fsc}-${a.niin}`,
              description: a.description || "",
              quantity: a.quantity || 1,
              unitOfMeasure: "EA",
              unitPrice: a.unit_price || 0,
            }],
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        alert("EDI generation failed: " + (err.error || res.statusText));
        return;
      }

      // API returns JSON with ediContent when download is not set
      const data = await res.json();
      if (data.ediContent) {
        setEdiResult(data.ediContent);
      } else if (data.error) {
        alert("EDI error: " + data.error);
      }
    } catch {
      alert("EDI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  // Download EDI file
  function downloadEdi() {
    if (!ediResult) return;
    const blob = new Blob([ediResult], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split("T")[0]}.edi`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Parse remittance
  async function handleParseRemittance() {
    if (!remittanceText.trim()) return;
    setParsingRemittance(true);
    trackAction("invoice", "parse_remittance");
    try {
      const res = await fetch("/api/remittance/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: remittanceText,
          wireDate: new Date().toISOString().split("T")[0],
          wireReference: "MANUAL-IMPORT",
        }),
      });
      const data = await res.json();
      setRemittanceResult(data);
    } catch {
      alert("Remittance parsing failed");
    } finally {
      setParsingRemittance(false);
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
        <span className="text-foreground font-medium">Invoicing</span>
      </div>

      <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Invoicing</h1>
          <p className="text-muted mt-1 text-sm">
            Generate EDI 810 invoices, parse remittances, track payments
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRemittance(!showRemittance)}
            className="flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" />
            Import Remittance
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-card-border bg-card-bg p-4 shadow-sm">
          <p className="text-xs text-muted">Awards Loaded</p>
          <p className="text-2xl font-bold mt-1">{awards.length.toLocaleString()}</p>
          <p className="text-xs text-muted mt-1">{totalReady} ready to invoice</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm">
          <p className="text-xs text-green-700">Total Value</p>
          <p className="text-2xl font-bold text-green-700 mt-1">${totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-green-600 mt-1">from {readyToInvoice.length} line items</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <p className="text-xs text-blue-700">PO Lines</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{poCount}</p>
          <p className="text-xs text-blue-600 mt-1">generated from awards</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 shadow-sm">
          <p className="text-xs text-purple-700">Submitted Bids</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{submittedCount}</p>
          <p className="text-xs text-purple-600 mt-1">awaiting award</p>
        </div>
      </div>

      {/* Remittance Import Panel */}
      {showRemittance && (
        <div className="mb-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Upload className="h-5 w-5 text-amber-700" />
            <h2 className="text-sm font-bold text-amber-800">Import Remittance File</h2>
            <span className="text-xs text-amber-600">Paste DLA wire remittance text (CSV or tab-delimited)</span>
          </div>
          <textarea
            value={remittanceText}
            onChange={(e) => setRemittanceText(e.target.value)}
            rows={6}
            placeholder="Paste remittance file contents here...&#10;&#10;Each line should contain: invoice number, amount, contract number"
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-xs font-mono mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={handleParseRemittance}
              disabled={parsingRemittance || !remittanceText.trim()}
              className="flex items-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-xs text-white font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {parsingRemittance ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
              Parse & Match
            </button>
            <button onClick={() => { setShowRemittance(false); setRemittanceResult(null); }}
              className="text-xs text-amber-700 hover:text-amber-900 px-2">Close</button>
          </div>
          {remittanceResult && (
            <div className="mt-3 rounded-lg bg-white border border-amber-200 p-3 text-xs">
              <div className="grid grid-cols-3 gap-4 mb-2">
                <div><span className="text-muted">Total Lines:</span> <strong>{remittanceResult.summary?.totalLines || 0}</strong></div>
                <div><span className="text-muted">Matched:</span> <strong className="text-green-700">{remittanceResult.matched?.length || 0}</strong></div>
                <div><span className="text-muted">Net Amount:</span> <strong className="text-green-700">${(remittanceResult.summary?.netAmount || 0).toLocaleString()}</strong></div>
              </div>
              {remittanceResult.unmatched?.length > 0 && (
                <div className="text-red-600">
                  {remittanceResult.unmatched.length} unmatched lines — may need manual review
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* EDI Output */}
      {ediResult && (
        <div className="mb-6 rounded-xl border-2 border-green-200 bg-green-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-700" />
              <h2 className="text-sm font-bold text-green-800">EDI 810 Generated — {selectedIds.size} Invoices</h2>
            </div>
            <div className="flex gap-2">
              <button onClick={downloadEdi} className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-green-700">
                <Download className="h-3 w-3" /> Download .edi
              </button>
              <button onClick={() => { navigator.clipboard.writeText(ediResult); alert("Copied!"); }}
                className="flex items-center gap-1 rounded-lg border border-green-300 px-3 py-1.5 text-xs text-green-700 font-medium hover:bg-green-100">
                Copy to Clipboard
              </button>
              <button onClick={() => setEdiResult(null)} className="text-xs text-green-600 hover:text-green-800 px-2">Dismiss</button>
            </div>
          </div>
          <pre className="text-[9px] font-mono bg-white rounded border border-green-200 p-2 max-h-40 overflow-auto whitespace-pre-wrap">
            {ediResult.slice(0, 2000)}{ediResult.length > 2000 ? "\n...(truncated)" : ""}
          </pre>
        </div>
      )}

      {/* Awards Table — Ready to Invoice */}
      <div className="rounded-xl border-2 border-accent bg-card-bg shadow-sm mb-6">
        <div className="px-4 py-3 border-b border-accent/20 bg-blue-50/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-accent" />
            <h2 className="text-base font-semibold">Awards — Ready to Invoice</h2>
            <span className="text-xs text-muted">{readyToInvoice.length} items from {awards.length} total awards</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGenerateEdi}
              disabled={generating || selectedIds.size === 0}
              className="flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              Generate EDI 810 ({selectedIds.size})
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size === readyToInvoice.length && readyToInvoice.length > 0} className="rounded" />
                </th>
                <th className="px-3 py-2 font-medium">Contract</th>
                <th className="px-3 py-2 font-medium">NSN</th>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium text-right">Unit Price</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
                <th className="px-3 py-2 font-medium">Gov Invoice #</th>
                <th className="px-3 py-2 font-medium">Award Date</th>
                <th className="px-3 py-2 font-medium">Winner</th>
              </tr>
            </thead>
            <tbody>
              {readyToInvoice.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-12 text-center text-muted">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No awards loaded yet</p>
                    <p className="text-xs mt-1">Awards will appear here after syncing from LamLinks</p>
                  </td>
                </tr>
              ) : readyToInvoice.map((a) => (
                <tr key={a.id} className={`border-b border-card-border/50 hover:bg-blue-50/30 ${selectedIds.has(a.id) ? "bg-blue-50/50" : ""}`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} className="rounded" />
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px]">{a.contract_number}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-accent">{a.fsc}-{a.niin}</td>
                  <td className="px-3 py-2 truncate max-w-[160px]">{a.description || "—"}</td>
                  <td className="px-3 py-2 text-right">{a.quantity}</td>
                  <td className="px-3 py-2 text-right font-mono">${(a.unit_price || 0).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono font-medium text-green-600">
                    ${a.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono font-bold text-accent">{a.govInvoice}</span>
                    {a.lineIdx > 0 && <span className="ml-1 text-[9px] text-orange-600">({String.fromCharCode(64 + a.lineIdx)})</span>}
                  </td>
                  <td className="px-3 py-2 text-muted">{formatDateShort(a.award_date)}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{a.cage || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {readyToInvoice.length > 0 && (
          <div className="px-4 py-2 border-t border-accent/20 bg-blue-50/30 flex items-center justify-between text-xs">
            <span className="text-muted">{selectedIds.size} of {readyToInvoice.length} selected</span>
            <span className="font-semibold">
              Selected total: <span className="text-accent">
                ${readyToInvoice.filter(a => selectedIds.has(a.id)).reduce((s, a) => s + a.totalAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Bottom grid: Recent submitted bids + Payment info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recently Submitted Bids (pending award) */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-4 py-3 border-b border-card-border flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-purple-500" />
            <h2 className="text-sm font-semibold">Recently Submitted Bids (Awaiting Award)</h2>
          </div>
          {submittedBids.length === 0 ? (
            <div className="p-6 text-center text-muted text-xs">
              No submitted bids yet. Approve bids in Solicitations first.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-card-border text-left text-muted">
                    <th className="px-3 py-2 font-medium">Solicitation</th>
                    <th className="px-3 py-2 font-medium">NSN</th>
                    <th className="px-3 py-2 font-medium text-right">Bid Price</th>
                    <th className="px-3 py-2 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {submittedBids.slice(0, 20).map((b, i) => (
                    <tr key={i} className="border-b border-card-border/50 hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-[10px]">{b.solicitation_number}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-accent">{b.nsn}</td>
                      <td className="px-3 py-2 text-right font-mono">${(b.final_price || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-muted">{formatDateShort(b.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment Info */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-4 py-3 border-b border-card-border flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            <h2 className="text-sm font-semibold">Invoice Workflow</h2>
          </div>
          <div className="p-4 space-y-4 text-xs">
            <div className="rounded-lg border border-card-border p-3">
              <h4 className="font-semibold mb-2">How It Works</h4>
              <ol className="list-decimal pl-4 space-y-1 text-muted">
                <li>Awards are loaded from LamLinks (k81 awards table)</li>
                <li>Select awards and click <strong>Generate EDI 810</strong></li>
                <li>Download the .edi file and import into LamLinks</li>
                <li>LamLinks submits via EDI to WAWF/iRAPT</li>
                <li>Government accepts → DFAS processes payment</li>
                <li>Import the remittance file to match payments to invoices</li>
              </ol>
            </div>

            <div className="rounded-lg border border-card-border p-3">
              <h4 className="font-semibold mb-2">Payment Schedule</h4>
              <div className="text-muted space-y-1">
                <p>DLA pays ~3 times per month via wire transfer</p>
                <p>Each payment includes 200-300 line remittance</p>
                <p>Fast Pay contracts (&lt;$35K): paid within 15 days</p>
                <p>Standard: Net 30 from proper invoice</p>
                <p className="text-orange-600 font-medium">Small depots often delay — no receiving confirmation = payment blocked</p>
              </div>
            </div>

            <div className="rounded-lg border border-card-border p-3">
              <h4 className="font-semibold mb-2">EDI Transaction Sets</h4>
              <div className="grid grid-cols-2 gap-2 text-muted">
                <div><span className="font-mono font-medium text-foreground">810</span> Invoice</div>
                <div><span className="font-mono font-medium text-foreground">856</span> Ship Notice / ASN</div>
                <div><span className="font-mono font-medium text-foreground">820</span> Remittance</div>
                <div><span className="font-mono font-medium text-foreground">997</span> Acknowledgment</div>
              </div>
            </div>

            {lastInvoiceSync && (
              <div className="text-[10px] text-muted">
                Last EDI generated: {formatDateTime(lastInvoiceSync.created_at)}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
