import { Database, Check, X } from "lucide-react";

const fscCategories = [
  { code: "6510", name: "Surgical Dressing Materials", active: true, nsnCount: 45, bidVolume: "High" },
  { code: "6515", name: "Medical & Surgical Instruments", active: true, nsnCount: 120, bidVolume: "High" },
  { code: "6520", name: "Dental Instruments & Supplies", active: true, nsnCount: 30, bidVolume: "Medium" },
  { code: "6530", name: "Hospital Furniture & Equipment", active: true, nsnCount: 25, bidVolume: "Medium" },
  { code: "6532", name: "Hospital & Surgical Clothing", active: true, nsnCount: 18, bidVolume: "Medium" },
  { code: "6545", name: "Medical Sets, Kits & Outfits", active: true, nsnCount: 40, bidVolume: "High" },
  { code: "6550", name: "In Vitro Diagnostics", active: true, nsnCount: 55, bidVolume: "Medium" },
  { code: "6505", name: "Drugs & Biologicals", active: true, nsnCount: 35, bidVolume: "Low" },
  { code: "4240", name: "Safety & Rescue Equipment", active: true, nsnCount: 60, bidVolume: "High" },
  { code: "5305", name: "Screws", active: true, nsnCount: 200, bidVolume: "High" },
  { code: "6685", name: "Pressure & Temperature Instruments", active: true, nsnCount: 80, bidVolume: "Medium" },
  { code: "6640", name: "Laboratory Equipment", active: true, nsnCount: 90, bidVolume: "Medium" },
  { code: "6135", name: "Batteries, Nonrechargeable", active: true, nsnCount: 30, bidVolume: "Medium" },
  { code: "4110", name: "Refrigeration Equipment", active: true, nsnCount: 15, bidVolume: "Low" },
  { code: "8520", name: "Toilet Soap, Shaving Prep", active: true, nsnCount: 20, bidVolume: "Low" },
  { code: "7310", name: "Food Cooking & Serving Equipment", active: true, nsnCount: 25, bidVolume: "Low" },
  // Inactive but potential
  { code: "1005", name: "Guns, through 30mm", active: false, nsnCount: 0, bidVolume: "N/A" },
  { code: "6625", name: "Electrical Measuring Instruments", active: false, nsnCount: 0, bidVolume: "N/A" },
  { code: "7105", name: "Household Furniture", active: false, nsnCount: 0, bidVolume: "N/A" },
  { code: "8415", name: "Clothing, Special Purpose", active: false, nsnCount: 0, bidVolume: "N/A" },
];

const volumeColors: Record<string, string> = {
  High: "text-green-600 bg-green-50",
  Medium: "text-yellow-600 bg-yellow-50",
  Low: "text-orange-600 bg-orange-50",
  "N/A": "text-gray-400 bg-gray-50",
};

export default function FscCodesPage() {
  const active = fscCategories.filter(f => f.active);
  const inactive = fscCategories.filter(f => !f.active);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">FSC Categories</h1>
          <p className="text-muted mt-1">Manage which Federal Supply Classifications we bid on in Lamb Links</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
          <Database className="h-4 w-4" />
          Add Category
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Active Categories</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{active.length}</p>
          <p className="text-xs text-muted mt-1">Registered in Lamb Links</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Total NSNs Tracked</p>
          <p className="text-2xl font-bold mt-1">{active.reduce((sum, f) => sum + f.nsnCount, 0)}</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Expansion Potential</p>
          <p className="text-2xl font-bold mt-1 text-accent">100+</p>
          <p className="text-xs text-muted mt-1">Categories with supplier overlap</p>
        </div>
      </div>

      {/* Active Categories */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-card-border">
          <h2 className="text-lg font-semibold">Active Categories ({active.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">FSC Code</th>
                <th className="px-6 py-3 font-medium">Category Name</th>
                <th className="px-6 py-3 font-medium">NSNs Tracked</th>
                <th className="px-6 py-3 font-medium">Bid Volume</th>
              </tr>
            </thead>
            <tbody>
              {active.map((f) => (
                <tr key={f.code} className="border-b border-card-border last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3"><Check className="h-4 w-4 text-green-600" /></td>
                  <td className="px-6 py-3 font-mono font-bold">{f.code}</td>
                  <td className="px-6 py-3">{f.name}</td>
                  <td className="px-6 py-3">{f.nsnCount}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${volumeColors[f.bidVolume]}`}>
                      {f.bidVolume}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inactive / Potential */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="px-6 py-4 border-b border-card-border">
          <h2 className="text-lg font-semibold">Not Active — Expansion Candidates</h2>
          <p className="text-xs text-muted mt-1">Categories we could add to Lamb Links if we have supplier access</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">FSC Code</th>
                <th className="px-6 py-3 font-medium">Category Name</th>
                <th className="px-6 py-3 font-medium">Supplier Overlap</th>
                <th className="px-6 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {inactive.map((f) => (
                <tr key={f.code} className="border-b border-card-border last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3"><X className="h-4 w-4 text-gray-300" /></td>
                  <td className="px-6 py-3 font-mono">{f.code}</td>
                  <td className="px-6 py-3">{f.name}</td>
                  <td className="px-6 py-3 text-muted">Check suppliers</td>
                  <td className="px-6 py-3">
                    <button className="text-xs text-accent hover:text-accent-hover font-medium">Analyze</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
