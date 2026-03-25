import { Upload, FileText, Database, Globe, Zap, AlertCircle } from "lucide-react";

export default function ImportPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Data Import</h1>
        <p className="text-muted mt-1">Import data from EDI files, Lamb Links, Dynamics AX, and public sources</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EDI File Import */}
        <div className="rounded-xl border-2 border-accent bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-accent/20 bg-blue-50/50 flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">EDI File Import</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted mb-4">
              Upload raw EDI files from Lamb Links. Supports transaction sets:
              840 (solicitations), 850 (orders), 810 (invoices), 856 (ASN).
            </p>
            <div className="border-2 border-dashed border-card-border rounded-lg p-8 text-center mb-4 hover:border-accent transition-colors cursor-pointer">
              <Upload className="mx-auto h-8 w-8 text-muted mb-2" />
              <p className="text-sm font-medium">Drop EDI files here or click to browse</p>
              <p className="text-xs text-muted mt-1">Accepts .edi, .x12, .txt files</p>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted bg-blue-50 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-accent mt-0.5" />
              <div>
                <p className="font-medium text-foreground">How to get EDI files:</p>
                <p>Ask Abe to re-enable EDI file forwarding in Lamb Links. Files are forwarded daily to a folder — point them here.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Supplier Catalog CSV */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
            <Database className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold">Supplier Catalog Import</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted mb-4">
              Upload CSV/Excel with supplier part numbers, NSN mappings, and pricing.
            </p>
            <div className="border-2 border-dashed border-card-border rounded-lg p-8 text-center mb-4 hover:border-green-400 transition-colors cursor-pointer">
              <Upload className="mx-auto h-8 w-8 text-muted mb-2" />
              <p className="text-sm font-medium">Drop CSV/Excel here</p>
              <p className="text-xs text-muted mt-1">.csv, .xlsx — columns: vendor, partNumber, nsn, description, cost, listPrice</p>
            </div>
            <div className="text-xs text-muted">
              <p className="font-medium text-foreground mb-1">Expected columns:</p>
              <code className="bg-gray-100 px-2 py-1 rounded text-xs block">
                vendorId, partNumber, nsnCode, description, ourCost, listPrice
              </code>
            </div>
          </div>
        </div>

        {/* USASpending.gov */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
            <Globe className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold">USASpending.gov Awards</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted mb-4">
              Pull public contract award data from USASpending.gov. Free API, no auth needed. Great for competitor research and historical pricing.
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Cage Code</label>
                <div className="flex gap-2">
                  <input type="text" defaultValue="0AG09" placeholder="e.g., 0AG09" className="flex-1 rounded-lg border border-card-border px-3 py-2 text-sm font-mono" />
                  <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors">
                    Search
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Keyword (NSN, item description)</label>
                <input type="text" placeholder="e.g., silver nitrate applicator" className="w-full rounded-lg border border-card-border px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="text-xs text-muted">
              <p>Data source: <span className="font-mono">api.usaspending.gov</span></p>
              <p>Coverage: All federal contract awards, updated daily</p>
            </div>
          </div>
        </div>

        {/* DIBBS Public Data */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
            <Globe className="h-5 w-5 text-orange-600" />
            <h2 className="text-lg font-semibold">DIBBS Award History</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted mb-4">
              Import award history from DIBBS (dibbs.bsm.dla.mil). Public data — shows who won each contract, at what price.
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Our Cage Code</label>
                <input type="text" defaultValue="0AG09" className="w-full rounded-lg border border-card-border px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Date Range</label>
                <div className="flex gap-2">
                  <input type="date" defaultValue="2025-01-01" className="flex-1 rounded-lg border border-card-border px-3 py-2 text-sm" />
                  <input type="date" defaultValue="2026-03-24" className="flex-1 rounded-lg border border-card-border px-3 py-2 text-sm" />
                </div>
              </div>
              <button className="w-full rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors">
                Pull Award History
              </button>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted bg-orange-50 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-orange-600 mt-0.5" />
              <p>Requires DIBBS login. Award data is public but must be accessed through authenticated session.</p>
            </div>
          </div>
        </div>

        {/* Lamb Links Export */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
            <Database className="h-5 w-5 text-yellow-600" />
            <h2 className="text-lg font-semibold">Lamb Links Export</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted mb-4">
              Import solicitation history, bid history, and award data exported from Lamb Links. Abe can export this from the solicitation tab.
            </p>
            <div className="border-2 border-dashed border-card-border rounded-lg p-8 text-center mb-4 hover:border-yellow-400 transition-colors cursor-pointer">
              <Upload className="mx-auto h-8 w-8 text-muted mb-2" />
              <p className="text-sm font-medium">Drop Lamb Links export here</p>
              <p className="text-xs text-muted mt-1">.csv, .xlsx — exported from solicitation/award tabs</p>
            </div>
          </div>
        </div>

        {/* Dynamics AX */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Dynamics AX Export</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted mb-4">
              Import orders, inventory levels, and invoice data from Dynamics AX. Use the custom NPI export Abe runs daily.
            </p>
            <div className="border-2 border-dashed border-card-border rounded-lg p-8 text-center mb-4 hover:border-blue-400 transition-colors cursor-pointer">
              <Upload className="mx-auto h-8 w-8 text-muted mb-2" />
              <p className="text-sm font-medium">Drop AX export here</p>
              <p className="text-xs text-muted mt-1">.csv, .xlsx — daily order/invoice export</p>
            </div>
            <div className="text-xs text-muted">
              <p className="font-medium text-foreground mb-1">Imports supported:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Daily orders (NSN, qty, contract #, ship-to)</li>
                <li>Invoice numbers (CIN format for WAF stripping)</li>
                <li>Inventory levels (for stock availability checks)</li>
                <li>PO history (vendor, cost, dates)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
