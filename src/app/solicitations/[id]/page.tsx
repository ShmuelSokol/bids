import Link from "next/link";
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, Truck, Clock,
  AlertTriangle, Building2, History, Package,
} from "lucide-react";

// Mock data for a single solicitation detail — will be replaced with DB query
const solicitation = {
  id: "SPE2D1-26-Q-0901",
  nsn: "6515-01-234-5678",
  item: "Applicator, Silver Nitrate, 100/vial",
  fsc: "6515 - Medical & Surgical Instruments",
  qty: 2,
  uom: "EA",
  fob: "DESTINATION",
  due: "2026-03-31",
  status: "NEW",
  isBreadAndButter: true,
  shipTo: [
    { line: 1, qty: 1, destination: "Fort Hood, TX", zip: "76544", tcn: "FP12345678" },
    { line: 2, qty: 1, destination: "Norfolk, VA", zip: "23511", tcn: "NV87654321" },
  ],
};

const pricingSuggestion = {
  suggestedPrice: 23.29,
  suggestedLeadTimeDays: 50,
  strategy: "INCREMENT",
  rationale: "Won 3x consecutively. Incrementing 2%. Competitor undercut once at $21.10 but appears to be a fluke.",
  marginPercent: 42,
  estimatedProfit: 19.58,
  flags: [] as string[],
};

const suppliers = [
  { vendor: "Medline Industries", part: "MDS20225", cost: 13.50, list: 18.00, inStock: true, pricing: "NEGOTIATED" },
  { vendor: "Cardinal Health", part: "CH-SNA-100", cost: 14.20, list: 19.50, inStock: false, pricing: "CONTRACT" },
];

const bidHistory = [
  { date: "2026-02-26", winner: "Midland Scientific", cage: "MDS01", price: 21.10, ours: 23.35, qty: 1, won: false, dest: "San Diego, CA" },
  { date: "2026-01-10", winner: "Ever Ready First Aid", cage: "0AG09", price: 23.35, ours: 23.35, qty: 2, won: true, dest: "Norfolk, VA" },
  { date: "2025-11-20", winner: "Ever Ready First Aid", cage: "0AG09", price: 23.44, ours: 23.44, qty: 1, won: true, dest: "New Cumberland, PA" },
  { date: "2025-09-15", winner: "Ever Ready First Aid", cage: "0AG09", price: 21.95, ours: 21.95, qty: 2, won: true, dest: "Fort Liberty, NC" },
  { date: "2025-06-01", winner: "Ever Ready First Aid", cage: "0AG09", price: 20.50, ours: 20.50, qty: 3, won: true, dest: "Norfolk, VA" },
  { date: "2025-03-12", winner: "Ever Ready First Aid", cage: "0AG09", price: 19.99, ours: 19.99, qty: 1, won: true, dest: "Fort Drum, NY" },
];

const competitorActivity = [
  { cage: "MDS01", name: "Midland Scientific", lastPrice: 21.10, lastDate: "2026-02-26", totalWins: 1, avgPrice: 21.10 },
  { cage: "6P7Q8", name: "VWR International", lastPrice: null, lastDate: null, totalWins: 0, avgPrice: null },
];

export default function SolicitationDetailPage() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/solicitations" className="flex items-center gap-1 text-sm text-muted hover:text-accent mb-3">
          <ArrowLeft className="h-4 w-4" />
          Back to Solicitations
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{solicitation.item}</h1>
              <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">{solicitation.status}</span>
              {solicitation.isBreadAndButter && (
                <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Bread & Butter</span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted">
              <span className="font-mono">{solicitation.id}</span>
              <span className="font-mono text-accent">{solicitation.nsn}</span>
              <span>{solicitation.fsc}</span>
              <span>{solicitation.qty} {solicitation.uom}</span>
              <span>FOB {solicitation.fob === "DESTINATION" ? "Destination" : "Origin"}</span>
              <span>Due {solicitation.due}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Pricing & Bid Entry */}
        <div className="lg:col-span-1 space-y-6">
          {/* AI Pricing Suggestion */}
          <div className="rounded-xl border-2 border-accent bg-blue-50/50 p-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">AI Suggestion</h2>
              <span className="text-xs font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5">{pricingSuggestion.strategy}</span>
            </div>
            <div className="text-3xl font-bold text-accent mb-1">${pricingSuggestion.suggestedPrice.toFixed(2)}</div>
            <div className="text-sm text-muted mb-3">
              {pricingSuggestion.suggestedLeadTimeDays} days / {pricingSuggestion.marginPercent}% margin / ${pricingSuggestion.estimatedProfit.toFixed(2)} profit
            </div>
            <p className="text-sm mb-4">{pricingSuggestion.rationale}</p>
            {pricingSuggestion.flags.map((f, i) => (
              <div key={i} className="flex items-center gap-1 text-xs text-yellow-700 mb-1">
                <AlertTriangle className="h-3 w-3" /> {f}
              </div>
            ))}
          </div>

          {/* Bid Entry Form */}
          <div className="rounded-xl border border-card-border bg-card-bg p-6">
            <h2 className="text-lg font-semibold mb-4">Place Bid</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Unit Price ($)</label>
                <input type="number" step="0.01" defaultValue={pricingSuggestion.suggestedPrice.toFixed(2)}
                  className="w-full rounded-lg border border-card-border px-3 py-2 text-lg font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Lead Time (days)</label>
                <input type="number" defaultValue={pricingSuggestion.suggestedLeadTimeDays}
                  className="w-full rounded-lg border border-card-border px-3 py-2 font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Notes</label>
                <textarea className="w-full rounded-lg border border-card-border px-3 py-2 text-sm" rows={2}
                  placeholder="Optional pricing rationale..." />
              </div>
              <div className="flex gap-3">
                <button className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
                  Save Bid
                </button>
                <button className="rounded-lg border border-card-border px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                  Skip
                </button>
              </div>
            </div>
          </div>

          {/* Ship-to Locations */}
          <div className="rounded-xl border border-card-border bg-card-bg p-6">
            <div className="flex items-center gap-2 mb-3">
              <Truck className="h-5 w-5 text-muted" />
              <h2 className="text-lg font-semibold">Ship-to Locations</h2>
            </div>
            <div className="space-y-2">
              {solicitation.shipTo.map((loc) => (
                <div key={loc.line} className="flex items-center justify-between p-3 rounded-lg border border-card-border text-sm">
                  <div>
                    <div className="font-medium">Line {loc.line}: {loc.destination}</div>
                    <div className="text-xs text-muted font-mono">TCN: {loc.tcn} / ZIP: {loc.zip}</div>
                  </div>
                  <div className="text-sm font-medium">{loc.qty} {solicitation.uom}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: History & Intelligence */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier Sources */}
          <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
            <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted" />
              <h2 className="text-lg font-semibold">Supplier Sources</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-left text-muted">
                    <th className="px-6 py-3 font-medium">Vendor</th>
                    <th className="px-6 py-3 font-medium">Part #</th>
                    <th className="px-6 py-3 font-medium">Pricing Type</th>
                    <th className="px-6 py-3 font-medium text-right">Our Cost</th>
                    <th className="px-6 py-3 font-medium text-right">List Price</th>
                    <th className="px-6 py-3 font-medium">In Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s, i) => (
                    <tr key={i} className="border-b border-card-border last:border-0">
                      <td className="px-6 py-3 font-medium">{s.vendor}</td>
                      <td className="px-6 py-3 font-mono text-xs">{s.part}</td>
                      <td className="px-6 py-3 text-xs">{s.pricing}</td>
                      <td className="px-6 py-3 text-right font-mono font-bold">${s.cost.toFixed(2)}</td>
                      <td className="px-6 py-3 text-right font-mono text-muted">${s.list.toFixed(2)}</td>
                      <td className="px-6 py-3">{s.inStock ? <span className="text-green-600 text-xs font-medium">Yes</span> : <span className="text-muted text-xs">No</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Procurement History (replaces 12 tabs!) */}
          <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
            <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
              <History className="h-5 w-5 text-muted" />
              <h2 className="text-lg font-semibold">Procurement History</h2>
              <span className="text-xs text-muted">({bidHistory.length} awards)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-left text-muted">
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Winner</th>
                    <th className="px-6 py-3 font-medium">Cage</th>
                    <th className="px-6 py-3 font-medium text-right">Win Price</th>
                    <th className="px-6 py-3 font-medium text-right">Our Bid</th>
                    <th className="px-6 py-3 font-medium">Qty</th>
                    <th className="px-6 py-3 font-medium">Destination</th>
                    <th className="px-6 py-3 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {bidHistory.map((h, i) => (
                    <tr key={i} className={`border-b border-card-border last:border-0 ${h.won ? "" : "bg-red-50/50"}`}>
                      <td className="px-6 py-3 text-muted">{h.date}</td>
                      <td className="px-6 py-3 font-medium">{h.winner}</td>
                      <td className="px-6 py-3 font-mono text-xs">{h.cage}</td>
                      <td className="px-6 py-3 text-right font-mono font-bold">${h.price.toFixed(2)}</td>
                      <td className="px-6 py-3 text-right font-mono">${h.ours.toFixed(2)}</td>
                      <td className="px-6 py-3">{h.qty}</td>
                      <td className="px-6 py-3 text-xs text-muted">{h.dest}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${h.won ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {h.won ? "WON" : "LOST"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Competitor Intelligence */}
          <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
            <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
              <Package className="h-5 w-5 text-muted" />
              <h2 className="text-lg font-semibold">Competitor Intelligence</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-left text-muted">
                    <th className="px-6 py-3 font-medium">Competitor</th>
                    <th className="px-6 py-3 font-medium">Cage Code</th>
                    <th className="px-6 py-3 font-medium text-right">Last Price</th>
                    <th className="px-6 py-3 font-medium">Last Award</th>
                    <th className="px-6 py-3 font-medium">Total Wins</th>
                    <th className="px-6 py-3 font-medium">Threat Level</th>
                  </tr>
                </thead>
                <tbody>
                  {competitorActivity.map((c, i) => (
                    <tr key={i} className="border-b border-card-border last:border-0">
                      <td className="px-6 py-3 font-medium">{c.name}</td>
                      <td className="px-6 py-3 font-mono text-xs">{c.cage}</td>
                      <td className="px-6 py-3 text-right font-mono">{c.lastPrice ? `$${c.lastPrice.toFixed(2)}` : "—"}</td>
                      <td className="px-6 py-3 text-muted">{c.lastDate ?? "Never"}</td>
                      <td className="px-6 py-3">{c.totalWins}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.totalWins >= 2 ? "bg-red-100 text-red-700" : c.totalWins >= 1 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {c.totalWins >= 2 ? "High" : c.totalWins >= 1 ? "Medium" : "Low"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Price Trend Visual */}
          <div className="rounded-xl border border-card-border bg-card-bg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Price Trend</h2>
            <div className="flex items-end gap-2 h-32">
              {[...bidHistory].reverse().map((h, i) => {
                const maxPrice = Math.max(...bidHistory.map(b => b.price));
                const height = (h.price / maxPrice) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] font-mono">${h.price.toFixed(0)}</div>
                    <div
                      className={`w-full rounded-t-sm ${h.won ? "bg-green-400" : "bg-red-400"}`}
                      style={{ height: `${height}%` }}
                    />
                    <div className="text-[9px] text-muted">{h.date.slice(5)}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-400" /> Won</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400" /> Lost</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
