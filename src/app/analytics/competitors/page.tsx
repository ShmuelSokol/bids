import { Search, Shield, TrendingDown, TrendingUp, ExternalLink } from "lucide-react";

// Mock data — will be replaced with DIBS public data lookups
const competitors = [
  {
    cageCode: "ADS01", name: "Atlantic Diving Supply",
    awards15d: 2719, estAnnualRevenue: "$1B+", categories: ["Guns", "Diving", "Safety", "Medical", "Everything"],
    threatLevel: "Low", notes: "Huge but different market. Not competing on our bread & butter.",
    recentActivity: [
      { nsn: "1240-01-555-1234", item: "Optical Sight, Rifle", price: 1250.00, date: "2026-03-20" },
      { nsn: "4240-01-333-4567", item: "Dive Helmet, Deep Sea", price: 8500.00, date: "2026-03-19" },
    ],
  },
  {
    cageCode: "6P7Q8", name: "VWR International (Avantor)",
    awards15d: 450, estAnnualRevenue: "$50M+", categories: ["6640 Lab Equipment", "6550 Diagnostics", "6810 Chemicals"],
    threatLevel: "High", notes: "Biggest lab distributor. Aggressive pricing — undercut us on lab spoons at $8.30 vs our $24. Can't compete on their core items.",
    recentActivity: [
      { nsn: "6640-01-345-6789", item: "Spoon, Measuring, Laboratory", price: 8.30, date: "2026-03-18" },
      { nsn: "6550-01-222-3333", item: "Test Kit, Rapid Strep", price: 45.00, date: "2026-03-17" },
      { nsn: "6810-01-444-5555", item: "Alcohol, Isopropyl, 70%", price: 12.50, date: "2026-03-15" },
    ],
  },
  {
    cageCode: "MDS01", name: "Midland Scientific",
    awards15d: 85, estAnnualRevenue: "$5M", categories: ["6515 Medical Instruments", "6640 Lab Equipment"],
    threatLevel: "Medium", notes: "Recently undercut us on Silver Nitrate ($21.10 vs $23.35). Monitor closely — could be testing our prices.",
    recentActivity: [
      { nsn: "6515-01-234-5678", item: "Applicator, Silver Nitrate", price: 21.10, date: "2026-02-26" },
      { nsn: "6640-01-888-9999", item: "Flask, Erlenmeyer, 500ml", price: 15.75, date: "2026-02-20" },
    ],
  },
  {
    cageCode: "MLT01", name: "Melton Sales",
    awards15d: 54, estAnnualRevenue: "$2M", categories: ["6685 Instruments", "Yanmar Diesel Parts"],
    threatLevel: "Low", notes: "Small operator. Yanmar diesel distributor. Not competing on medical.",
    recentActivity: [
      { nsn: "6685-01-111-2222", item: "Gauge, Temperature, Yanmar", price: 85.00, date: "2026-03-15" },
    ],
  },
  {
    cageCode: "5R6S7", name: "North American Rescue",
    awards15d: 320, estAnnualRevenue: "$30M", categories: ["6515 Medical Instruments", "6545 Medical Kits"],
    threatLevel: "Medium", notes: "Manufacturer selling direct at $9.98-$20.98. They miss quotes sometimes — that's when we win. Don't try to undercut, just be present.",
    recentActivity: [
      { nsn: "6515-01-012-3456", item: "Forcep, Dressing, NAR", price: 20.98, date: "2026-03-20" },
      { nsn: "6545-01-777-8888", item: "IFAK Kit, Gen 2", price: 89.50, date: "2026-03-18" },
      { nsn: "6515-01-666-7777", item: "Tourniquet, CAT Gen 7", price: 29.99, date: "2026-03-15" },
    ],
  },
  {
    cageCode: "8T9U0", name: "United Spirit",
    awards15d: 45, estAnnualRevenue: "$3M", categories: ["8520 Personal Care", "Sunscreen"],
    threatLevel: "Low", notes: "Manufacturer. Warrior sunscreen. We buy by the skid — they appreciate our volume. We undercut by pennies ($299.75 vs $300).",
    recentActivity: [
      { nsn: "8520-01-567-8902", item: "Sunscreen, Warrior SPF 50", price: 300.00, date: "2026-03-10" },
    ],
  },
];

const threatColors: Record<string, string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Low: "bg-green-100 text-green-700",
};

export default function CompetitorsPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Competitor Intelligence</h1>
        <p className="text-muted mt-1">Monitor competitor pricing and activity from public DIBS data</p>
      </div>

      {/* Search */}
      <div className="mb-6 flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Look up cage code (e.g., ADS01)..."
            className="w-full rounded-lg border border-card-border bg-card-bg pl-10 pr-3 py-2.5 text-sm"
          />
        </div>
        <button className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
          Look Up on DIBS
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Tracked Competitors</p>
          <p className="text-2xl font-bold mt-1">{competitors.length}</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">High Threat</p>
          <p className="text-2xl font-bold mt-1 text-red-600">{competitors.filter(c => c.threatLevel === "High").length}</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Our Volume (15d)</p>
          <p className="text-2xl font-bold mt-1 text-accent">953 awards</p>
        </div>
      </div>

      {/* Competitor Cards */}
      <div className="space-y-4">
        {competitors.map((comp) => (
          <div key={comp.cageCode} className="rounded-xl border border-card-border bg-card-bg shadow-sm">
            <div className="px-6 py-4 border-b border-card-border">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-semibold">{comp.name}</h3>
                    <span className="font-mono text-xs text-muted bg-gray-100 px-2 py-0.5 rounded">{comp.cageCode}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${threatColors[comp.threatLevel]}`}>
                      {comp.threatLevel} Threat
                    </span>
                  </div>
                  <p className="text-sm text-muted">{comp.notes}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{comp.awards15d.toLocaleString()}</div>
                  <div className="text-xs text-muted">awards / 15 days</div>
                  <div className="text-xs text-muted mt-1">{comp.estAnnualRevenue} est.</div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {comp.categories.map((cat, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{cat}</span>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            {comp.recentActivity.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted text-xs">
                      <th className="px-6 py-2 font-medium">NSN</th>
                      <th className="px-6 py-2 font-medium">Item</th>
                      <th className="px-6 py-2 font-medium text-right">Price</th>
                      <th className="px-6 py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.recentActivity.map((act, i) => (
                      <tr key={i} className="border-t border-card-border hover:bg-gray-50">
                        <td className="px-6 py-2 font-mono text-xs text-accent">{act.nsn}</td>
                        <td className="px-6 py-2">{act.item}</td>
                        <td className="px-6 py-2 text-right font-mono font-medium">${act.price.toFixed(2)}</td>
                        <td className="px-6 py-2 text-muted">{act.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
