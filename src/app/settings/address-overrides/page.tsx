import { MapPin, Plus, AlertTriangle, Truck, Edit2, Trash2 } from "lucide-react";

// Mock data representing Abe's address override cheat sheets
// Medical products have special routing. TCN prefixes indicate overrides.
const overrides = [
  {
    id: "ov-001",
    locationName: "Naval Supply Fleet Logistics Norfolk",
    originalAddress: "1968 Gilbert St, Norfolk, VA 23511",
    overrideAddress: "Naval Medical Center Portsmouth, 620 John Paul Jones Cir, Portsmouth, VA 23708",
    tcnPrefix: "FP",
    productClassification: "Medical",
    ruleType: "MEDICAL_REDIRECT",
    notes: "All medical items with TCN starting 'FP' going to Norfolk must be redirected to Portsmouth Naval Medical. Confirmed with CO-Norfolk 2024.",
  },
  {
    id: "ov-002",
    locationName: "DLA Distribution Susquehanna",
    originalAddress: "2001 Mission Dr, New Cumberland, PA 17070",
    overrideAddress: "Walter Reed NMMC, 8901 Wisconsin Ave, Bethesda, MD 20889",
    tcnPrefix: "RV",
    productClassification: "Medical Surgical",
    ruleType: "MEDICAL_REDIRECT",
    notes: "Medical surgical items with 'RV' prefix route to Walter Reed, not the depot. Active since 2023.",
  },
  {
    id: "ov-003",
    locationName: "Fort Cavazos (Hood) Medical",
    originalAddress: "36000 Darnall Loop, Fort Cavazos, TX 76544",
    overrideAddress: "Carl R. Darnall Army Medical Center, Bldg 36000, Fort Cavazos, TX 76544",
    tcnPrefix: null,
    productClassification: "Medical",
    ruleType: "ADDRESS_CORRECTION",
    notes: "Contract says Darnall Loop but actual delivery is to the medical center main building. Same ZIP, different building.",
  },
  {
    id: "ov-004",
    locationName: "Naval Medical Center San Diego",
    originalAddress: "34800 Bob Wilson Dr, San Diego, CA 92134",
    overrideAddress: "NMCSD Warehouse, Bldg 5-W, 34800 Bob Wilson Dr, San Diego, CA 92134",
    tcnPrefix: null,
    productClassification: "Medical",
    ruleType: "BUILDING_SPECIFIC",
    notes: "All medical deliveries go to Bldg 5-W warehouse, not the main entrance. Call ahead: 619-555-0200.",
  },
  {
    id: "ov-005",
    locationName: "Any Depot",
    originalAddress: "(Any depot address)",
    overrideAddress: "(Use standard depot address)",
    tcnPrefix: "FP",
    productClassification: "Non-Medical",
    ruleType: "NO_OVERRIDE",
    notes: "Non-medical items with FP prefix go to the depot as listed. Only medical items get redirected.",
  },
];

const ruleTypeColors: Record<string, string> = {
  MEDICAL_REDIRECT: "bg-red-100 text-red-700",
  ADDRESS_CORRECTION: "bg-yellow-100 text-yellow-700",
  BUILDING_SPECIFIC: "bg-blue-100 text-blue-700",
  NO_OVERRIDE: "bg-gray-100 text-gray-500",
};

const ruleTypeLabels: Record<string, string> = {
  MEDICAL_REDIRECT: "Medical Redirect",
  ADDRESS_CORRECTION: "Address Correction",
  BUILDING_SPECIFIC: "Building Specific",
  NO_OVERRIDE: "No Override (Standard)",
};

export default function AddressOverridesPage() {
  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Address Overrides</h1>
          <p className="text-muted mt-1">Medical routing rules and shipping address cheat sheets — Abe's institutional knowledge digitized</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
          <Plus className="h-4 w-4" />
          Add Override Rule
        </button>
      </div>

      {/* How It Works */}
      <div className="mb-6 rounded-xl border border-card-border bg-blue-50/50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">How Address Overrides Work</p>
            <p className="text-muted">
              When orders are imported, the system checks each contract's ship-to address against these rules.
              If a match is found (by location, TCN prefix, or product classification), the override address is used instead.
              This replicates Abe's manual process of reviewing addresses on each order.
            </p>
            <div className="mt-2 flex gap-4 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200" /> Medical Redirect — different facility entirely</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-200" /> Address Correction — same area, different address</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200" /> Building Specific — same address, specific building</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Total Rules</p>
          <p className="text-2xl font-bold mt-1">{overrides.length}</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Medical Redirects</p>
          <p className="text-2xl font-bold mt-1 text-red-600">{overrides.filter(o => o.ruleType === "MEDICAL_REDIRECT").length}</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">TCN Prefix Rules</p>
          <p className="text-2xl font-bold mt-1">{overrides.filter(o => o.tcnPrefix).length}</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Locations Covered</p>
          <p className="text-2xl font-bold mt-1">{new Set(overrides.map(o => o.locationName)).size}</p>
        </div>
      </div>

      {/* Override Rules */}
      <div className="space-y-4">
        {overrides.map(override => (
          <div key={override.id} className="rounded-xl border border-card-border bg-card-bg shadow-sm">
            <div className="px-6 py-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <MapPin className="h-5 w-5 text-muted" />
                    <span className="font-semibold">{override.locationName}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ruleTypeColors[override.ruleType]}`}>
                      {ruleTypeLabels[override.ruleType]}
                    </span>
                    {override.tcnPrefix && (
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
                        TCN: {override.tcnPrefix}*
                      </span>
                    )}
                    {override.productClassification && (
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700">
                        {override.productClassification}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Edit">
                    <Edit2 className="h-4 w-4 text-muted" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="rounded-lg bg-red-50/50 border border-red-200 p-3">
                  <p className="text-xs font-medium text-red-600 mb-1">Contract Says (Original)</p>
                  <p className="text-sm">{override.originalAddress}</p>
                </div>
                <div className="rounded-lg bg-green-50/50 border border-green-200 p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Truck className="h-3 w-3 text-green-600" />
                    <p className="text-xs font-medium text-green-600">Actually Ship To (Override)</p>
                  </div>
                  <p className="text-sm">{override.overrideAddress}</p>
                </div>
              </div>

              {override.notes && (
                <p className="text-xs text-muted bg-gray-50 rounded-lg px-3 py-2">{override.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Override Form */}
      <div className="mt-8 rounded-xl border-2 border-dashed border-card-border bg-card-bg p-6">
        <h3 className="text-lg font-semibold mb-4">Add New Override Rule</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Shipping Location</label>
            <select className="w-full rounded-lg border border-card-border px-3 py-2 text-sm">
              <option>Select location...</option>
              <option>Naval Supply Fleet Logistics Norfolk</option>
              <option>DLA Distribution Susquehanna</option>
              <option>Fort Cavazos (Hood) Medical</option>
              <option>Naval Medical Center San Diego</option>
              <option>Fort Liberty Medical Supply</option>
              <option>Tripler Army Medical Center</option>
              <option>Fort Drum Medical Activity</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Rule Type</label>
            <select className="w-full rounded-lg border border-card-border px-3 py-2 text-sm">
              <option>Medical Redirect</option>
              <option>Address Correction</option>
              <option>Building Specific</option>
              <option>No Override (Standard)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">TCN Prefix (optional)</label>
            <input type="text" placeholder="e.g., FP, RV" className="w-full rounded-lg border border-card-border px-3 py-2 text-sm font-mono" maxLength={4} />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Product Classification</label>
            <select className="w-full rounded-lg border border-card-border px-3 py-2 text-sm">
              <option>Medical</option>
              <option>Medical Surgical</option>
              <option>Non-Medical</option>
              <option>All Products</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-muted mb-1">Override Address</label>
            <input type="text" placeholder="Full address for actual delivery" className="w-full rounded-lg border border-card-border px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-muted mb-1">Notes</label>
            <textarea placeholder="Why this override exists, who confirmed it, when..." className="w-full rounded-lg border border-card-border px-3 py-2 text-sm" rows={2} />
          </div>
          <div className="col-span-2">
            <button className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
              Save Override Rule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
