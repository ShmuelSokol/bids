import { Building2, Upload, ExternalLink, AlertTriangle } from "lucide-react";

// Mock data matching seed — will be replaced with DB queries
const vendors = [
  { id: "v-mcmaster", name: "McMaster-Carr", cageCode: null, pricingType: "LIST", sellsDirect: false, catalogCount: 1, website: "mcmaster.com", notes: "Everyone pays same price. 15-20% markup." },
  { id: "v-grainger", name: "Grainger", cageCode: null, pricingType: "LIST", sellsDirect: false, catalogCount: 1, website: "grainger.com" },
  { id: "v-medline", name: "Medline Industries", cageCode: "3J4K5", pricingType: "NEGOTIATED", sellsDirect: true, catalogCount: 3, website: "medline.com" },
  { id: "v-cardinal", name: "Cardinal Health", cageCode: "7L8M9", pricingType: "CONTRACT", sellsDirect: true, catalogCount: 0, website: "cardinalhealth.com", notes: "Prime contractor" },
  { id: "v-mckesson", name: "McKesson Medical", cageCode: "1N2O3", pricingType: "CONTRACT", sellsDirect: true, catalogCount: 0, website: "mckesson.com", notes: "Prime contractor" },
  { id: "v-nar", name: "North American Rescue", cageCode: "5R6S7", pricingType: "NEGOTIATED", sellsDirect: true, catalogCount: 2, website: "narescue.com", notes: "Sells direct but misses quotes" },
  { id: "v-united", name: "United Spirit", cageCode: "8T9U0", pricingType: "NEGOTIATED", sellsDirect: true, catalogCount: 1, notes: "Warrior sunscreen. Buy by skid." },
  { id: "v-laerdal", name: "Laerdal Medical", cageCode: "2V3W4", pricingType: "NEGOTIATED", sellsDirect: true, catalogCount: 1, website: "laerdal.com" },
  { id: "v-vwr", name: "VWR International", cageCode: "6P7Q8", pricingType: "LIST", sellsDirect: true, catalogCount: 0, website: "vwr.com", notes: "Aggressive gov pricing" },
  { id: "v-armstrong", name: "Armstrong Medical", cageCode: "9X0Y1", pricingType: "NEGOTIATED", sellsDirect: true, catalogCount: 0, notes: "BLOCKED - sells direct only" },
  { id: "v-3m", name: "3M Health Care", cageCode: "4P5Q6", pricingType: "NEGOTIATED", sellsDirect: true, catalogCount: 0, website: "3m.com" },
  { id: "v-avanti", name: "Avanti Products", cageCode: null, pricingType: "CONTRACT", sellsDirect: false, catalogCount: 1, notes: "Refrigerators. Buy 100-200 direct." },
  { id: "v-airgas", name: "Airgas", cageCode: null, pricingType: "LIST", sellsDirect: false, catalogCount: 1, website: "airgas.com" },
];

const pricingTypeColors: Record<string, string> = {
  LIST: "bg-blue-50 text-blue-700",
  NEGOTIATED: "bg-green-50 text-green-700",
  CONTRACT: "bg-purple-50 text-purple-700",
};

export default function SuppliersPage() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suppliers & Catalog</h1>
          <p className="text-muted mt-1">Manage vendor accounts and product catalogs for bidding</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
            <Upload className="h-4 w-4" />
            Import Catalog CSV
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
            <Building2 className="h-4 w-4" />
            Add Vendor
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Total Vendors</p>
          <p className="text-2xl font-bold mt-1">{vendors.length}</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Catalog Items</p>
          <p className="text-2xl font-bold mt-1">11</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">NSNs Mapped</p>
          <p className="text-2xl font-bold mt-1">11</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Sells Direct</p>
          <p className="text-2xl font-bold mt-1 text-warning">{vendors.filter(v => v.sellsDirect).length}</p>
        </div>
      </div>

      {/* Vendor Table */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-6 py-3 font-medium">Vendor</th>
                <th className="px-6 py-3 font-medium">Cage Code</th>
                <th className="px-6 py-3 font-medium">Pricing</th>
                <th className="px-6 py-3 font-medium">Catalog Items</th>
                <th className="px-6 py-3 font-medium">Direct to Gov</th>
                <th className="px-6 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="border-b border-card-border last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{v.name}</span>
                      {v.website && (
                        <ExternalLink className="h-3 w-3 text-muted" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 font-mono text-xs">{v.cageCode || "—"}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${pricingTypeColors[v.pricingType]}`}>
                      {v.pricingType}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {v.catalogCount > 0 ? (
                      <span className="text-accent font-medium">{v.catalogCount} items</span>
                    ) : (
                      <span className="text-muted">No catalog</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {v.sellsDirect ? (
                      <span className="flex items-center gap-1 text-warning text-xs font-medium">
                        <AlertTriangle className="h-3 w-3" /> Yes
                      </span>
                    ) : (
                      <span className="text-green-600 text-xs font-medium">No</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-xs text-muted max-w-xs truncate">{v.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Catalog Preview */}
      <div className="mt-8 rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Supplier Catalog</h2>
          <span className="text-xs text-muted">11 items mapped to NSNs</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-6 py-3 font-medium">Vendor</th>
                <th className="px-6 py-3 font-medium">Part Number</th>
                <th className="px-6 py-3 font-medium">NSN</th>
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium text-right">Our Cost</th>
                <th className="px-6 py-3 font-medium text-right">List Price</th>
              </tr>
            </thead>
            <tbody>
              {[
                { vendor: "McMaster-Carr", part: "91251A144", nsn: "5305-01-890-1234", desc: "Screw, Hex Head SS 1/4-20x1", cost: 73.58, list: 73.58 },
                { vendor: "Medline", part: "MDS20225", nsn: "6515-01-234-5678", desc: "Silver Nitrate Applicator", cost: 13.50, list: 18.00 },
                { vendor: "Medline", part: "MDS077004", nsn: "6510-01-123-4567", desc: "Elastic Bandage, 4in", cost: 8.50, list: 14.00 },
                { vendor: "NAR", part: "30-0023", nsn: "6545-01-901-2345", desc: "Ambu Perfit ACE Collar", cost: 93.98, list: 115.00 },
                { vendor: "Laerdal", part: "375125", nsn: "6545-01-901-2345", desc: "Ambu Perfit ACE Collar", cost: 140.00, list: 165.00 },
                { vendor: "United Spirit", part: "WS-SPF50-4", nsn: "8520-01-567-8902", desc: "Warrior Sunscreen SPF 50", cost: 245.00, list: 300.00 },
                { vendor: "Grainger", part: "3KN97", nsn: "6515-01-789-0123", desc: "Oxygen Bag, Portable", cost: 105.00, list: 147.00 },
                { vendor: "Avanti", part: "AR5102SS", nsn: "4110-01-345-6780", desc: "Refrigerator, 5.5cf", cost: 285.00, list: 399.00 },
              ].map((item, i) => (
                <tr key={i} className="border-b border-card-border last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium">{item.vendor}</td>
                  <td className="px-6 py-3 font-mono text-xs">{item.part}</td>
                  <td className="px-6 py-3 font-mono text-xs text-accent">{item.nsn}</td>
                  <td className="px-6 py-3">{item.desc}</td>
                  <td className="px-6 py-3 text-right font-mono">${item.cost.toFixed(2)}</td>
                  <td className="px-6 py-3 text-right font-mono text-muted">${item.list.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
