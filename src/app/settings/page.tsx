import Link from "next/link";
import { Building2, MapPin, Upload, Database, Activity, Bug, Send, FileText } from "lucide-react";
import { isLamlinksWritebackLive, getSystemSetting } from "@/lib/system-settings";

export default async function SettingsPage() {
  const writebackLive = await isLamlinksWritebackLive();
  const invoiceLive = (await getSystemSetting("lamlinks_invoice_writeback_enabled")) === "true";
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted mt-1">System configuration, supplier management, and integrations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Info */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Company Info</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Cage Code</label>
              <input type="text" defaultValue="0AG09" className="w-full rounded-lg border border-card-border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Company Name</label>
              <input type="text" defaultValue="Ever Ready First Aid" className="w-full rounded-lg border border-card-border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">SAM.gov Registration</label>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Active</span>
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Integrations</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-card-border">
              <div>
                <p className="text-sm font-medium">LamLinks EDI</p>
                <p className="text-xs text-muted">EDI pipe for solicitations, quotes, WAF</p>
              </div>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">$7K/year</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-card-border">
              <div>
                <p className="text-sm font-medium">Dynamics AX (NPI Import)</p>
                <p className="text-xs text-muted">Order import, NSN to part number conversion</p>
              </div>
              <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">Manual Export</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-card-border">
              <div>
                <p className="text-sm font-medium">DIBS (Public Data)</p>
                <p className="text-xs text-muted">Award history, competitor cage code lookups</p>
              </div>
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Available</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-card-border">
              <div>
                <p className="text-sm font-medium">WAF (Invoicing)</p>
                <p className="text-xs text-muted">Government invoice submission & payment status</p>
              </div>
              <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">Via LamLinks</span>
            </div>
          </div>
        </div>

        {/* Suppliers */}
        <Link href="/settings/suppliers" className="rounded-xl border border-card-border bg-card-bg shadow-sm p-6 hover:border-accent transition-colors group">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold group-hover:text-accent">Suppliers & Catalog</h2>
            <Building2 className="h-5 w-5 text-muted group-hover:text-accent" />
          </div>
          <p className="text-sm text-muted mb-3">Manage supplier accounts, import product catalogs, map part numbers to NSNs</p>
          <div className="flex gap-4 text-xs text-muted">
            <span>15 vendors</span>
            <span>11 catalog items</span>
            <span>39 active FSC codes</span>
          </div>
        </Link>

        {/* FSC Categories */}
        <Link href="/settings/fsc-codes" className="rounded-xl border border-card-border bg-card-bg shadow-sm p-6 hover:border-accent transition-colors group">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold group-hover:text-accent">FSC Categories</h2>
            <Database className="h-5 w-5 text-muted group-hover:text-accent" />
          </div>
          <p className="text-sm text-muted mb-3">Manage which FSC codes are active in LamLinks. Find expansion opportunities.</p>
          <div className="flex gap-4 text-xs text-muted">
            <span>39 of 54 categories active</span>
            <span>Hundreds more available</span>
          </div>
        </Link>

        {/* Address Overrides */}
        <Link href="/settings/address-overrides" className="rounded-xl border border-card-border bg-card-bg shadow-sm p-6 hover:border-accent transition-colors group">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold group-hover:text-accent">Address Overrides</h2>
            <MapPin className="h-5 w-5 text-muted group-hover:text-accent" />
          </div>
          <p className="text-sm text-muted mb-3">Medical routing rules, TCN prefix overrides, depot cheat sheets</p>
          <div className="flex gap-4 text-xs text-muted">
            <span>10 shipping locations</span>
            <span>0 override rules</span>
          </div>
        </Link>

        {/* Data Import */}
        <Link href="/settings/import" className="rounded-xl border border-card-border bg-card-bg shadow-sm p-6 hover:border-accent transition-colors group">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold group-hover:text-accent">Data Import</h2>
            <Upload className="h-5 w-5 text-muted group-hover:text-accent" />
          </div>
          <p className="text-sm text-muted mb-3">Import EDI files, LamLinks exports, Dynamics AX data, bid history</p>
          <div className="flex gap-4 text-xs text-muted">
            <span>EDI parser ready</span>
            <span>CSV/Excel upload</span>
          </div>
        </Link>

        {/* User Activity */}
        <Link href="/settings/activity" className="rounded-xl border border-card-border bg-card-bg shadow-sm p-6 hover:border-accent transition-colors group">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold group-hover:text-accent">User Activity</h2>
            <Activity className="h-5 w-5 text-muted group-hover:text-accent" />
          </div>
          <p className="text-sm text-muted mb-3">Track page views, bid decisions, logins, searches, and all user interactions</p>
          <div className="flex gap-4 text-xs text-muted">
            <span>Real-time feed</span>
            <span>Per-user breakdown</span>
            <span>7-day history</span>
          </div>
        </Link>

        {/* LamLinks Bid Write-Back Toggle */}
        <Link
          href="/settings/lamlinks-writeback"
          className={`rounded-xl border-2 ${writebackLive ? "border-green-400 bg-green-50/30" : "border-card-border bg-card-bg"} shadow-sm p-6 hover:border-accent transition-colors group`}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold group-hover:text-accent">LamLinks Bid Write-Back</h2>
            <Send className={`h-5 w-5 ${writebackLive ? "text-green-600" : "text-muted"} group-hover:text-accent`} />
          </div>
          <p className="text-sm text-muted mb-3">Controls whether DIBS Submit actually transmits bids into LamLinks for DLA.</p>
          <div className="flex gap-4 text-xs">
            {writebackLive ? (
              <span className="text-green-700 font-medium">🟢 LIVE — bids transmit to LamLinks</span>
            ) : (
              <span className="text-gray-600 font-medium">⚪ SIMULATED — DIBS-local only</span>
            )}
          </div>
        </Link>

        {/* LamLinks Invoice Write-Back Toggle */}
        <Link
          href="/settings/lamlinks-invoice-writeback"
          className={`rounded-xl border-2 ${invoiceLive ? "border-green-400 bg-green-50/30" : "border-amber-200 bg-amber-50/20"} shadow-sm p-6 hover:border-accent transition-colors group`}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold group-hover:text-accent">LamLinks Invoice Write-Back</h2>
            <FileText className={`h-5 w-5 ${invoiceLive ? "text-green-600" : "text-amber-600"} group-hover:text-accent`} />
          </div>
          <p className="text-sm text-muted mb-3">Write invoices into LamLinks&apos; kad/kae tables — skip Yosef&apos;s manual desktop-app click-through.</p>
          <div className="flex gap-4 text-xs">
            {invoiceLive ? (
              <span className="text-green-700 font-medium">🟢 LIVE — invoices write to LamLinks</span>
            ) : (
              <span className="text-amber-700 font-medium">⏳ PRE-LIVE — pending Q7 confirmation with Yosef</span>
            )}
          </div>
        </Link>

        {/* Bug Management (Admin Only) */}
        <Link href="/settings/bugs" className="rounded-xl border-2 border-red-200 bg-red-50/30 shadow-sm p-6 hover:border-red-400 transition-colors group">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold group-hover:text-red-700">Bug Management</h2>
            <Bug className="h-5 w-5 text-red-400 group-hover:text-red-600" />
          </div>
          <p className="text-sm text-muted mb-3">Review, respond, and resolve bug reports. Conversation threads with AI analysis. Admin only.</p>
          <div className="flex gap-4 text-xs text-muted">
            <span>GitHub Issues</span>
            <span>Respond from site</span>
            <span>Close/Reopen</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
