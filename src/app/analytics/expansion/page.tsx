import { Zap, TrendingUp, AlertCircle, Check, X, Building2, ChevronRight } from "lucide-react";

// Mock data matching what the /api/expansion endpoint would return
const expansionData = {
  summary: {
    activeCategories: 39,
    inactiveWithCoverage: 8,
    totalUnmappedNsns: 342,
    totalCategories: 54,
  },
  // Sorted by opportunity score
  categories: [
    // Inactive but we have supplier access — TOP OPPORTUNITIES
    { code: "7105", name: "Household Furniture", isActive: false, totalNsns: 0, nsnsWithSupplier: 0, coveragePercent: 0, uniqueVendors: 0, solicitationCount: 0, opportunityScore: 85, reason: "True Value carries furniture items. Check if they have NSNs.", potentialVendors: ["True Value"] },
    { code: "6625", name: "Electrical Measuring Instruments", isActive: false, totalNsns: 0, nsnsWithSupplier: 0, coveragePercent: 0, uniqueVendors: 0, solicitationCount: 0, opportunityScore: 72, reason: "Grainger and McMaster carry multimeters, oscilloscopes. High-margin category.", potentialVendors: ["Grainger", "McMaster-Carr"] },
    { code: "8415", name: "Clothing, Special Purpose", isActive: false, totalNsns: 0, nsnsWithSupplier: 0, coveragePercent: 0, uniqueVendors: 0, solicitationCount: 0, opportunityScore: 65, reason: "Protective clothing overlaps with safety. Medline carries surgical clothing.", potentialVendors: ["Medline Industries"] },
    { code: "9310", name: "Paper & Paperboard", isActive: false, totalNsns: 0, nsnsWithSupplier: 0, coveragePercent: 0, uniqueVendors: 0, solicitationCount: 0, opportunityScore: 55, reason: "Office paper products. Easy to source, low margins but high volume.", potentialVendors: ["True Value", "Grainger"] },
    { code: "8305", name: "Textile Fabrics", isActive: false, totalNsns: 0, nsnsWithSupplier: 0, coveragePercent: 0, uniqueVendors: 0, solicitationCount: 0, opportunityScore: 45, reason: "Medical textiles overlap. Check Medline catalog for fabric items.", potentialVendors: ["Medline Industries"] },
    // Active but with gaps — GROWTH WITHIN EXISTING
    { code: "6515", name: "Medical & Surgical Instruments", isActive: true, totalNsns: 120, nsnsWithSupplier: 45, coveragePercent: 38, uniqueVendors: 4, solicitationCount: 35, opportunityScore: 280, reason: "75 NSNs without mapped suppliers. Biggest active gap. Check NAR, Medline for coverage.", potentialVendors: ["North American Rescue", "Medline Industries", "Cardinal Health"] },
    { code: "6545", name: "Medical Sets, Kits & Outfits", isActive: true, totalNsns: 40, nsnsWithSupplier: 12, coveragePercent: 30, uniqueVendors: 2, solicitationCount: 18, opportunityScore: 130, reason: "28 unmapped NSNs. NAR and Laerdal have extensive kit lines. High margins.", potentialVendors: ["North American Rescue", "Laerdal Medical"] },
    { code: "5305", name: "Screws", isActive: true, totalNsns: 200, nsnsWithSupplier: 15, coveragePercent: 8, uniqueVendors: 1, solicitationCount: 25, opportunityScore: 425, reason: "185 unmapped NSNs! McMaster carries everything. Just need NSN mapping.", potentialVendors: ["McMaster-Carr"] },
    { code: "6640", name: "Laboratory Equipment", isActive: true, totalNsns: 90, nsnsWithSupplier: 8, coveragePercent: 9, uniqueVendors: 1, solicitationCount: 12, opportunityScore: 200, reason: "82 unmapped NSNs. VWR dominates but Grainger has lab items too.", potentialVendors: ["Grainger", "VWR International"] },
    { code: "4240", name: "Safety & Rescue Equipment", isActive: true, totalNsns: 60, nsnsWithSupplier: 20, coveragePercent: 33, uniqueVendors: 2, solicitationCount: 15, opportunityScore: 135, reason: "40 unmapped NSNs. Airgas and 3M have broad safety lines.", potentialVendors: ["Airgas", "3M Health Care"] },
    { code: "6510", name: "Surgical Dressing Materials", isActive: true, totalNsns: 45, nsnsWithSupplier: 22, coveragePercent: 49, uniqueVendors: 2, solicitationCount: 20, opportunityScore: 120, reason: "23 unmapped NSNs. Medline is primary. Check Cardinal for gaps.", potentialVendors: ["Medline Industries", "Cardinal Health"] },
    { code: "6685", name: "Pressure & Temperature Instruments", isActive: true, totalNsns: 80, nsnsWithSupplier: 5, coveragePercent: 6, uniqueVendors: 1, solicitationCount: 8, opportunityScore: 175, reason: "75 unmapped NSNs. Traeger/Drager and McMaster carry these.", potentialVendors: ["McMaster-Carr", "Traeger/Drager Medical"] },
    // Well-covered
    { code: "6135", name: "Batteries, Nonrechargeable", isActive: true, totalNsns: 30, nsnsWithSupplier: 25, coveragePercent: 83, uniqueVendors: 2, solicitationCount: 10, opportunityScore: 25, reason: "Good coverage. 5 NSNs remaining — check specialty battery vendors.", potentialVendors: [] },
    { code: "8520", name: "Toilet Soap, Shaving Prep", isActive: true, totalNsns: 20, nsnsWithSupplier: 15, coveragePercent: 75, uniqueVendors: 1, solicitationCount: 5, opportunityScore: 20, reason: "Solid coverage via United Spirit. Low volume category.", potentialVendors: [] },
  ],
};

const scoreColor = (score: number) => {
  if (score >= 200) return "text-red-600 bg-red-50 font-bold";
  if (score >= 100) return "text-orange-600 bg-orange-50";
  if (score >= 50) return "text-yellow-600 bg-yellow-50";
  return "text-gray-500 bg-gray-50";
};

export default function ExpansionPage() {
  const { summary, categories } = expansionData;
  const inactive = categories.filter(c => !c.isActive);
  const activeGaps = categories.filter(c => c.isActive && c.coveragePercent < 50);
  const wellCovered = categories.filter(c => c.isActive && c.coveragePercent >= 50);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Category Expansion Engine</h1>
        <p className="text-muted mt-1">Find new revenue by expanding into FSC categories where we have supplier access</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-card-border bg-card-bg p-5 shadow-sm">
          <p className="text-sm text-muted">Active Categories</p>
          <p className="text-3xl font-bold mt-1">{summary.activeCategories}</p>
          <p className="text-xs text-muted mt-1">of {summary.totalCategories} total</p>
        </div>
        <div className="rounded-xl border-2 border-green-300 bg-green-50 p-5 shadow-sm">
          <p className="text-sm text-green-700 font-medium">New Category Opportunities</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{inactive.length}</p>
          <p className="text-xs text-green-600 mt-1">Inactive but we have suppliers</p>
        </div>
        <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-5 shadow-sm">
          <p className="text-sm text-orange-700 font-medium">Unmapped NSNs</p>
          <p className="text-3xl font-bold text-orange-700 mt-1">{summary.totalUnmappedNsns}</p>
          <p className="text-xs text-orange-600 mt-1">In active categories</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-5 shadow-sm">
          <p className="text-sm text-muted">Growth Potential</p>
          <p className="text-3xl font-bold text-accent mt-1">{activeGaps.length}</p>
          <p className="text-xs text-muted mt-1">Active categories under 50% coverage</p>
        </div>
      </div>

      {/* New Category Opportunities */}
      <div className="rounded-xl border-2 border-green-200 bg-card-bg shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-green-200 bg-green-50/50 flex items-center gap-2">
          <Zap className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold text-green-800">New Category Opportunities</h2>
          <span className="text-xs text-green-600 ml-2">Add these to Lam Links to see new solicitations</span>
        </div>
        <div className="divide-y divide-card-border">
          {inactive.map((cat) => (
            <div key={cat.code} className="px-6 py-4 hover:bg-green-50/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono font-bold text-lg">{cat.code}</span>
                    <span className="font-semibold">{cat.name}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${scoreColor(cat.opportunityScore)}`}>
                      Score: {cat.opportunityScore}
                    </span>
                  </div>
                  <p className="text-sm text-muted mb-2">{cat.reason}</p>
                  {cat.potentialVendors.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3 w-3 text-muted" />
                      <span className="text-xs text-muted">Potential suppliers:</span>
                      {cat.potentialVendors.map((v, i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{v}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors">
                  Investigate <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Categories with Gaps */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold">Growth Within Active Categories</h2>
          <span className="text-xs text-muted ml-2">Under 50% supplier coverage</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-6 py-3 font-medium">FSC</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Coverage</th>
                <th className="px-6 py-3 font-medium">Unmapped NSNs</th>
                <th className="px-6 py-3 font-medium">Vendors</th>
                <th className="px-6 py-3 font-medium">Score</th>
                <th className="px-6 py-3 font-medium">Top Suppliers to Check</th>
              </tr>
            </thead>
            <tbody>
              {activeGaps.map((cat) => (
                <tr key={cat.code} className="border-b border-card-border last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono font-bold">{cat.code}</td>
                  <td className="px-6 py-3 font-medium">{cat.name}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full max-w-[80px]">
                        <div
                          className={`h-2 rounded-full ${cat.coveragePercent >= 30 ? "bg-yellow-400" : "bg-red-400"}`}
                          style={{ width: `${cat.coveragePercent}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{cat.coveragePercent}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="font-bold text-orange-600">{cat.totalNsns - cat.nsnsWithSupplier}</span>
                    <span className="text-muted"> / {cat.totalNsns}</span>
                  </td>
                  <td className="px-6 py-3">{cat.uniqueVendors}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${scoreColor(cat.opportunityScore)}`}>
                      {cat.opportunityScore}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {cat.potentialVendors.slice(0, 3).map((v, i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{v}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Well-Covered Categories */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
          <Check className="h-5 w-5 text-green-500" />
          <h2 className="text-lg font-semibold">Well-Covered Categories</h2>
          <span className="text-xs text-muted ml-2">50%+ supplier coverage</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-6 py-3 font-medium">FSC</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Coverage</th>
                <th className="px-6 py-3 font-medium">Solicitations</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {wellCovered.map((cat) => (
                <tr key={cat.code} className="border-b border-card-border last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono font-bold">{cat.code}</td>
                  <td className="px-6 py-3">{cat.name}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full max-w-[80px]">
                        <div className="h-2 rounded-full bg-green-400" style={{ width: `${cat.coveragePercent}%` }} />
                      </div>
                      <span className="text-xs font-medium text-green-600">{cat.coveragePercent}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">{cat.solicitationCount}</td>
                  <td className="px-6 py-3"><span className="text-xs text-green-600 font-medium">Healthy</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
