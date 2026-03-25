import { Globe, Download, Clock, AlertCircle, Check, RefreshCw, Calendar } from "lucide-react";

// DIBBS batch download automation
// DIBBS has a built-in CSV batch download on the Welcome page after login
// This is likely what DIBBS Navigator ($55/month) uses

export default function DibbsSyncPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">DIBBS Data Sync</h1>
        <p className="text-muted mt-1">Pull solicitation and award data from DIBBS (dibbs.bsm.dla.mil)</p>
      </div>

      {/* Data Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* DIBBS Batch Download */}
        <div className="rounded-xl border-2 border-accent bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-accent/20 bg-blue-50/50 flex items-center gap-2">
            <Globe className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">DIBBS Batch Download</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted mb-4">
              DIBBS has a built-in batch download feature (CSV) on the Welcome page after login.
              Contains all open solicitations matching your FSC profile.
              DLA published the format spec: <span className="font-mono text-xs">DIBBS Batch File Format.docx</span>
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">DIBBS Username</label>
                <input type="text" placeholder="Your DIBBS login" className="w-full rounded-lg border border-card-border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">DIBBS Password</label>
                <input type="password" className="w-full rounded-lg border border-card-border px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="flex gap-3 mb-4">
              <button className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
                <Download className="h-4 w-4" />
                Download Now
              </button>
              <button className="flex items-center gap-2 rounded-lg border border-card-border px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                <Clock className="h-4 w-4" />
                Schedule Daily
              </button>
            </div>

            <div className="text-xs text-muted bg-blue-50 rounded-lg p-3">
              <p className="font-medium text-foreground mb-1">How it works:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Playwright logs into DIBBS with your credentials</li>
                <li>Navigates to Welcome page → batch download</li>
                <li>Downloads CSV of all open solicitations</li>
                <li>Parses CSV and loads into our database</li>
                <li>Runs pricing engine on new solicitations</li>
              </ol>
            </div>
          </div>
        </div>

        {/* DIBBS Award Lookup */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
            <Globe className="h-5 w-5 text-orange-600" />
            <h2 className="text-lg font-semibold">DIBBS Award History</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted mb-4">
              Look up award history on DIBBS by cage code. Public data — shows who won, at what price. Great for competitor research.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Cage Code</label>
                <div className="flex gap-2">
                  <input type="text" defaultValue="0AG09" className="flex-1 rounded-lg border border-card-border px-3 py-2 text-sm font-mono" />
                  <button className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors">
                    Look Up
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Date Range</label>
                <div className="flex gap-2">
                  <input type="number" defaultValue={15} className="w-20 rounded-lg border border-card-border px-3 py-2 text-sm" />
                  <span className="flex items-center text-sm text-muted">days</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted bg-orange-50 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-orange-600 mt-0.5" />
              <p>Requires authenticated DIBBS session. Uses Playwright to navigate the ASP.NET WebForms interface (ViewState-based, not a simple API).</p>
            </div>
          </div>
        </div>

        {/* USASpending.gov */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
            <Globe className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold">USASpending.gov</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Free API</span>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted mb-4">
              Free REST API, no authentication needed. Best source for contract award history. Updated daily.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Search by Cage Code</label>
                <div className="flex gap-2">
                  <input type="text" defaultValue="0AG09" className="flex-1 rounded-lg border border-card-border px-3 py-2 text-sm font-mono" />
                  <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors">
                    Search Awards
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Or search by keyword</label>
                <input type="text" placeholder="e.g., silver nitrate applicator" className="w-full rounded-lg border border-card-border px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded p-2"><span className="text-muted">Endpoint:</span> <span className="font-mono">api.usaspending.gov</span></div>
              <div className="bg-gray-50 rounded p-2"><span className="text-muted">Auth:</span> None required</div>
              <div className="bg-gray-50 rounded p-2"><span className="text-muted">Coverage:</span> All federal contracts</div>
              <div className="bg-gray-50 rounded p-2"><span className="text-muted">Updated:</span> Daily</div>
            </div>
          </div>
        </div>

        {/* SAM.gov */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
            <Globe className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold">SAM.gov Contract Awards</h2>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">API Key Required</span>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted mb-4">
              Replacing FPDS (dies Summer 2026). More granular than USASpending — supports CAGE code, PSC code, contract office filtering.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">SAM.gov API Key</label>
                <input type="password" placeholder="Register free at sam.gov" className="w-full rounded-lg border border-card-border px-3 py-2 text-sm font-mono" />
              </div>
              <div className="flex gap-2">
                <button className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors">
                  Save API Key
                </button>
                <button className="rounded-lg border border-card-border px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                  Test Connection
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted bg-yellow-50 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-yellow-600 mt-0.5" />
              <p><strong>Important:</strong> Most DLA DIBBS solicitations (under $25K) are NOT on SAM.gov. Use this for award history and competitor research, not for finding new bids.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Status */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sync History</h2>
          <button className="flex items-center gap-2 text-sm text-accent hover:text-accent-hover font-medium">
            <RefreshCw className="h-4 w-4" />
            Sync All Now
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-6 py-3 font-medium">Source</th>
                <th className="px-6 py-3 font-medium">Last Sync</th>
                <th className="px-6 py-3 font-medium">Records</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Next Run</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-card-border hover:bg-gray-50">
                <td className="px-6 py-3 font-medium">Lamlinks EDI Files</td>
                <td className="px-6 py-3 text-muted">Not configured</td>
                <td className="px-6 py-3">—</td>
                <td className="px-6 py-3"><span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">Setup Required</span></td>
                <td className="px-6 py-3 text-muted">—</td>
              </tr>
              <tr className="border-b border-card-border hover:bg-gray-50">
                <td className="px-6 py-3 font-medium">DIBBS Batch Download</td>
                <td className="px-6 py-3 text-muted">Not configured</td>
                <td className="px-6 py-3">—</td>
                <td className="px-6 py-3"><span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">Setup Required</span></td>
                <td className="px-6 py-3 text-muted">—</td>
              </tr>
              <tr className="border-b border-card-border hover:bg-gray-50">
                <td className="px-6 py-3 font-medium">USASpending.gov</td>
                <td className="px-6 py-3 text-muted">Never</td>
                <td className="px-6 py-3">—</td>
                <td className="px-6 py-3"><span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Ready</span></td>
                <td className="px-6 py-3 text-muted">On demand</td>
              </tr>
              <tr className="border-b border-card-border hover:bg-gray-50">
                <td className="px-6 py-3 font-medium">SAM.gov Awards</td>
                <td className="px-6 py-3 text-muted">Never</td>
                <td className="px-6 py-3">—</td>
                <td className="px-6 py-3"><span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">API Key Needed</span></td>
                <td className="px-6 py-3 text-muted">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
