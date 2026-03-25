import { Receipt, Upload, Download, Clock, Check, AlertTriangle, Mail, DollarSign } from "lucide-react";

// Mock data matching Abe's actual invoicing workflow
const readyToInvoice = [
  { contract: "SPE2D1-26-C-0445", line: 1, totalLines: 1, item: "Sunscreen, Warrior SPF 50", qty: 3, amount: 899.25, axInvoice: "CIN00045521", govInvoice: "0045521", suffix: null, shippedDate: "2026-03-21", isFastPay: false },
  { contract: "SPE2D1-26-C-0444", line: 1, totalLines: 2, item: "Bandage, Elastic 4in", qty: 50, amount: 362.00, axInvoice: "CIN00045520", govInvoice: "0045520", suffix: null, shippedDate: "2026-03-21", isFastPay: false },
  { contract: "SPE2D1-26-C-0444", line: 2, totalLines: 2, item: "Bandage, Elastic 4in", qty: 50, amount: 362.00, axInvoice: "CIN00045520", govInvoice: "004552A", suffix: "A", shippedDate: "2026-03-21", isFastPay: false },
  { contract: "SPE2D1-26-C-0443", line: 1, totalLines: 1, item: "Chest Seal, Eschmann", qty: 1, amount: 32.50, axInvoice: "CIN00045519", govInvoice: "0045519", suffix: null, shippedDate: "2026-03-20", isFastPay: false },
  { contract: "SPE2D1-26-C-0442", line: 1, totalLines: 3, item: "Ointment, First Aid 1oz", qty: 7, amount: 50.75, axInvoice: "CIN00045518", govInvoice: "0045518", suffix: null, shippedDate: "2026-03-20", isFastPay: false },
  { contract: "SPE2D1-26-C-0442", line: 2, totalLines: 3, item: "Ointment, First Aid 1oz", qty: 5, amount: 36.25, axInvoice: "CIN00045518", govInvoice: "004551A", suffix: "A", shippedDate: "2026-03-20", isFastPay: false },
  { contract: "SPE2D1-26-C-0442", line: 3, totalLines: 3, item: "Ointment, First Aid 1oz", qty: 3, amount: 21.75, axInvoice: "CIN00045518", govInvoice: "004551B", suffix: "B", shippedDate: "2026-03-20", isFastPay: false },
  { contract: "SPE2D1-26-C-0441", line: 1, totalLines: 1, item: "Earplug, Foam, NRR 32dB", qty: 5, amount: 28.45, axInvoice: "CIN00045517", govInvoice: "0045517", suffix: null, shippedDate: "2026-03-20", isFastPay: true },
];

const outstandingInvoices = [
  { govInvoice: "0045100", contract: "SPE2D1-26-C-0380", item: "Silver Nitrate Applicator", amount: 46.70, submittedDate: "2026-02-15", daysPending: 37, wafStatus: "WAITING", contactingOfficer: "CO-Norfolk" },
  { govInvoice: "0045055", contract: "SPE2D1-26-C-0355", item: "Ambu Perfit ACE Collar", amount: 330.00, submittedDate: "2026-02-01", daysPending: 51, wafStatus: "MISSING_INFO", contactingOfficer: "CO-FortHood" },
  { govInvoice: "0044980", contract: "SPE2D1-26-C-0330", item: "Oxygen Bag, Portable", amount: 147.00, submittedDate: "2026-01-20", daysPending: 63, wafStatus: "WAITING", contactingOfficer: "CO-Drum" },
  { govInvoice: "0044801", contract: "SPE2D1-26-C-0290", item: "Gauze Pad, Sterile 4x4", amount: 215.00, submittedDate: "2025-12-15", daysPending: 99, wafStatus: "WAITING", contactingOfficer: "CO-Norfolk" },
  { govInvoice: "0044650", contract: "SPE2D1-25-C-0950", item: "Tongue Depressor", amount: 89.50, submittedDate: "2025-11-01", daysPending: 143, wafStatus: "MISSING_INFO", contactingOfficer: "CO-NewCumberland" },
];

const recentPayments = [
  { wireDate: "2026-03-15", amount: 12450.75, lineCount: 85, reference: "DLA-WIRE-2026-0315" },
  { wireDate: "2026-03-05", amount: 18920.30, lineCount: 120, reference: "DLA-WIRE-2026-0305" },
  { wireDate: "2026-02-25", amount: 9875.50, lineCount: 65, reference: "DLA-WIRE-2026-0225" },
];

const wafStatusColors: Record<string, string> = {
  WAITING: "bg-yellow-100 text-yellow-700",
  MISSING_INFO: "bg-red-100 text-red-700",
  PAID: "bg-green-100 text-green-700",
};

const agingColor = (days: number) => {
  if (days >= 90) return "text-red-600 font-bold";
  if (days >= 60) return "text-orange-600 font-bold";
  if (days >= 30) return "text-yellow-600";
  return "text-muted";
};

export default function InvoicingPage() {
  const totalReady = readyToInvoice.length;
  const totalAmount = readyToInvoice.reduce((s, inv) => s + inv.amount, 0);
  const fastPayCount = readyToInvoice.filter(inv => inv.isFastPay).length;
  const outstandingTotal = outstandingInvoices.reduce((s, inv) => s + inv.amount, 0);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoicing</h1>
          <p className="text-muted mt-1">Generate invoices, submit to WAF, track payments</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
            <Upload className="h-4 w-4" />
            Import Remittance
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
            <Download className="h-4 w-4" />
            Export from AX
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-card-border bg-card-bg p-5 shadow-sm">
          <p className="text-sm text-muted">Ready to Invoice</p>
          <p className="text-3xl font-bold mt-1">{totalReady}</p>
          <p className="text-xs text-muted mt-1">${totalAmount.toFixed(2)} total</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-5 shadow-sm">
          <p className="text-sm text-muted">Fast Pay</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{fastPayCount}</p>
          <p className="text-xs text-muted mt-1">Paid within 15 days</p>
        </div>
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5 shadow-sm">
          <p className="text-sm text-red-700 font-medium">Outstanding</p>
          <p className="text-3xl font-bold text-red-700 mt-1">{outstandingInvoices.length}</p>
          <p className="text-xs text-red-600 mt-1">${outstandingTotal.toFixed(2)} unpaid</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-5 shadow-sm">
          <p className="text-sm text-muted">Last Payment</p>
          <p className="text-3xl font-bold text-accent mt-1">${(recentPayments[0]?.amount ?? 0).toLocaleString()}</p>
          <p className="text-xs text-muted mt-1">{recentPayments[0]?.wireDate}</p>
        </div>
      </div>

      {/* Batch Invoice Generator */}
      <div className="rounded-xl border-2 border-accent bg-card-bg shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-accent/20 bg-blue-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">Batch Invoice — Ready to Submit</h2>
            <span className="text-xs text-muted">Auto-generated invoice numbers from AX export</span>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 rounded-lg border border-accent/30 bg-white px-3 py-2 text-sm font-medium text-accent hover:bg-blue-50 transition-colors">
              <Download className="h-4 w-4" />
              Export for LamLinks
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
              <Check className="h-4 w-4" />
              Submit All to WAF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-4 py-3 font-medium w-8"><input type="checkbox" defaultChecked className="rounded" /></th>
                <th className="px-4 py-3 font-medium">Contract</th>
                <th className="px-4 py-3 font-medium">Ln</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">AX Invoice</th>
                <th className="px-4 py-3 font-medium">Gov Invoice #</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Shipped</th>
                <th className="px-4 py-3 font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {readyToInvoice.map((inv, i) => (
                <tr key={i} className={`border-b border-card-border last:border-0 hover:bg-blue-50/30 ${inv.isFastPay ? "bg-green-50/30" : ""}`}>
                  <td className="px-4 py-3"><input type="checkbox" defaultChecked className="rounded" /></td>
                  <td className="px-4 py-3 font-mono text-xs">{inv.contract}</td>
                  <td className="px-4 py-3 text-center">{inv.line}/{inv.totalLines}</td>
                  <td className="px-4 py-3">{inv.item}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{inv.axInvoice}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-accent">{inv.govInvoice}</span>
                    {inv.suffix && <span className="ml-1 text-xs text-orange-600">({inv.suffix})</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">${inv.amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted">{inv.shippedDate}</td>
                  <td className="px-4 py-3">
                    {inv.isFastPay ? (
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Fast Pay</span>
                    ) : (
                      <span className="text-xs text-muted">Standard</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-accent/20 bg-blue-50/30 flex items-center justify-between text-sm">
          <span className="text-muted">{totalReady} invoices selected</span>
          <span className="font-semibold">Total: <span className="text-accent">${totalAmount.toFixed(2)}</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outstanding Invoices */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-semibold">Outstanding Invoices</h2>
            </div>
            <button className="flex items-center gap-2 text-sm text-accent hover:text-accent-hover font-medium">
              <Mail className="h-4 w-4" />
              Batch Email COs
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-muted">
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 font-medium">WAF Status</th>
                </tr>
              </thead>
              <tbody>
                {outstandingInvoices.map((inv, i) => (
                  <tr key={i} className="border-b border-card-border last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{inv.govInvoice}</td>
                    <td className="px-4 py-3">{inv.item}</td>
                    <td className="px-4 py-3 text-right font-mono">${inv.amount.toFixed(2)}</td>
                    <td className={`px-4 py-3 ${agingColor(inv.daysPending)}`}>{inv.daysPending}d</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${wafStatusColors[inv.wafStatus]}`}>
                        {inv.wafStatus.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Payments */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">Recent Payments</h2>
          </div>
          <div className="p-6 space-y-4">
            {recentPayments.map((pmt, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-card-border">
                <div>
                  <div className="font-semibold text-green-600">${pmt.amount.toLocaleString()}</div>
                  <div className="text-xs text-muted">{pmt.wireDate} / {pmt.lineCount} lines</div>
                  <div className="text-xs font-mono text-muted">{pmt.reference}</div>
                </div>
                <button className="text-xs text-accent hover:text-accent-hover font-medium">
                  Match Invoices
                </button>
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-card-border">
            <h3 className="text-sm font-semibold mb-3">Payment Schedule</h3>
            <div className="text-xs text-muted space-y-1">
              <p>Government pays ~3 times per month via wire</p>
              <p>Each payment includes 200-300 line remittance</p>
              <p>Remit format: stripped invoice # (no CIN prefix)</p>
              <p>Small depots often delay — no receiving confirmation = payment blocked</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
