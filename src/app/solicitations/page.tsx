import Link from "next/link";
import { FileSearch, TrendingUp, TrendingDown, Minus, AlertTriangle, DollarSign, Truck } from "lucide-react";

// Mock data matching Abe's actual workflow from the demo
const solicitations = [
  {
    id: "SPE2D1-26-Q-0901", nsn: "6515-01-234-5678", item: "Applicator, Silver Nitrate, 100/vial",
    fsc: "6515", qty: 2, uom: "EA", fob: "DEST", due: "2026-03-31", status: "NEW", bread: true,
    lastWinPrice: 23.35, lastWinner: "Us", ourCost: 13.50, suggestedPrice: 23.29,
    suggestedDays: 50, strategy: "INCREMENT", competitorCount: 1, shipTo: "Fort Hood, TX",
  },
  {
    id: "SPE2D1-26-Q-0902", nsn: "6510-01-456-7890", item: "Ointment, First Aid, 1oz Tube",
    fsc: "6510", qty: 7, uom: "TB", fob: "DEST", due: "2026-04-02", status: "NEW", bread: true,
    lastWinPrice: 7.24, lastWinner: "Us", ourCost: 2.10, suggestedPrice: 7.25,
    suggestedDays: 50, strategy: "INCREMENT", competitorCount: 0, shipTo: "Norfolk, VA (3) / Ft Campbell, KY (4)",
  },
  {
    id: "SPE2D1-26-Q-0903", nsn: "5305-01-890-1234", item: "Screw, Machine, Hex Head, SS, 1/4-20x1",
    fsc: "5305", qty: 3, uom: "PK", fob: "ORIG", due: "2026-04-01", status: "NEW", bread: false,
    lastWinPrice: 86.44, lastWinner: "Us", ourCost: 73.58, suggestedPrice: 86.48,
    suggestedDays: 60, strategy: "NEW_ITEM", competitorCount: 2, shipTo: "Fresno, CA",
  },
  {
    id: "SPE2D1-26-Q-0904", nsn: "6545-01-901-2345", item: "Collar, Cervical, Ambu Perfit ACE",
    fsc: "6545", qty: 1, uom: "EA", fob: "DEST", due: "2026-04-03", status: "REVIEWING", bread: true,
    lastWinPrice: 300.50, lastWinner: "Unknown", ourCost: 93.98, suggestedPrice: 280.00,
    suggestedDays: 45, strategy: "OPPORTUNITY", competitorCount: 1, shipTo: "San Diego, CA",
    alert: "Lost at $180 to someone at $300+ — huge pricing opportunity!",
  },
  {
    id: "SPE2D1-26-Q-0905", nsn: "6515-01-567-8901", item: "Chest Seal, Hyfin, Eschmann",
    fsc: "6515", qty: 1, uom: "EA", fob: "DEST", due: "2026-04-05", status: "NEW", bread: true,
    lastWinPrice: 32.50, lastWinner: "Us", ourCost: 18.00, suggestedPrice: 33.40,
    suggestedDays: 50, strategy: "INCREMENT", competitorCount: 0, shipTo: "New Cumberland, PA",
  },
  {
    id: "SPE2D1-26-Q-0906", nsn: "4240-01-678-9012", item: "Earplug, Foam, Disposable, NRR 32dB",
    fsc: "4240", qty: 5, uom: "BX", fob: "DEST", due: "2026-04-02", status: "BID_SUBMITTED", bread: false,
    lastWinPrice: 5.69, lastWinner: "Us", ourCost: 4.95, suggestedPrice: 5.69,
    suggestedDays: 50, strategy: "HOLD", competitorCount: 0, shipTo: "Ft Drum, NY",
  },
  {
    id: "SPE2D1-26-Q-0907", nsn: "8520-01-567-8902", item: "Sunscreen, SPF 50, Warrior, 4oz",
    fsc: "8520", qty: 3, uom: "EA", fob: "DEST", due: "2026-04-04", status: "NEW", bread: false,
    lastWinPrice: 300.00, lastWinner: "United Spirit", ourCost: 245.00, suggestedPrice: 299.75,
    suggestedDays: 50, strategy: "MANUFACTURER", competitorCount: 1, shipTo: "Norfolk, VA",
    alert: "Competing with manufacturer. Undercut by pennies.",
  },
  {
    id: "SPE2D1-26-Q-0908", nsn: "6515-01-789-0123", item: "Bag, Oxygen, Portable, with Mask",
    fsc: "6515", qty: 1, uom: "EA", fob: "DEST", due: "2026-04-01", status: "NEW", bread: true,
    lastWinPrice: 151.50, lastWinner: "Competitor", ourCost: 105.00, suggestedPrice: 150.78,
    suggestedDays: 50, strategy: "COMPETE", competitorCount: 1, shipTo: "Honolulu, HI",
    alert: "Lost by $0.50 last time. Come back down.",
  },
];

const strategyIcons: Record<string, { icon: typeof TrendingUp; color: string; label: string }> = {
  INCREMENT: { icon: TrendingUp, color: "text-green-600", label: "Increment Up" },
  COMPETE: { icon: TrendingDown, color: "text-red-600", label: "Compete Down" },
  HOLD: { icon: Minus, color: "text-blue-600", label: "Hold Price" },
  NEW_ITEM: { icon: DollarSign, color: "text-purple-600", label: "New Item" },
  MANUFACTURER: { icon: AlertTriangle, color: "text-orange-600", label: "Mfr Direct" },
  OPPORTUNITY: { icon: TrendingUp, color: "text-green-700", label: "Price Opportunity!" },
};

const statusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  REVIEWING: "bg-yellow-100 text-yellow-700",
  BID_SUBMITTED: "bg-purple-100 text-purple-700",
};

export default function SolicitationsPage() {
  const newCount = solicitations.filter(s => s.status === "NEW").length;
  const opportunities = solicitations.filter(s => s.alert).length;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Solicitations</h1>
          <p className="text-muted mt-1">Daily bid review — {newCount} new, {opportunities} with alerts</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
            <FileSearch className="h-4 w-4" />
            Import from Lam Links
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
            Export Batch Quotes
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3 flex-wrap">
        <select className="rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm">
          <option>All Statuses</option>
          <option>New</option>
          <option>Reviewing</option>
          <option>Bid Submitted</option>
        </select>
        <select className="rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm">
          <option>All FSC Codes</option>
          <option>6515 - Medical Instruments</option>
          <option>6510 - Surgical Dressings</option>
          <option>5305 - Screws</option>
          <option>4240 - Safety Equipment</option>
          <option>6545 - Medical Kits</option>
        </select>
        <select className="rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm">
          <option>All FOB Terms</option>
          <option>Destination (we pay freight)</option>
          <option>Origin (gov pays freight)</option>
        </select>
        <select className="rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm">
          <option>All Strategies</option>
          <option>Increment</option>
          <option>Compete</option>
          <option>Manufacturer</option>
          <option>Opportunity</option>
        </select>
        <label className="flex items-center gap-2 px-3 py-2 text-sm">
          <input type="checkbox" className="rounded" defaultChecked />
          Bread & Butter Only
        </label>
        <input
          type="text"
          placeholder="Search NSN, solicitation #, or item..."
          className="flex-1 min-w-[250px] rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm"
        />
      </div>

      {/* Solicitation Cards */}
      <div className="space-y-3">
        {solicitations.map((s) => {
          const strat = strategyIcons[s.strategy];
          const StratIcon = strat.icon;
          const margin = s.suggestedPrice && s.ourCost ? ((s.suggestedPrice - s.ourCost) / s.suggestedPrice * 100).toFixed(0) : "?";
          const marginTotal = s.suggestedPrice && s.ourCost ? ((s.suggestedPrice - s.ourCost) * s.qty).toFixed(2) : "?";

          return (
            <Link href={`/solicitations/${s.id}`} key={s.id} className={`block rounded-xl border bg-card-bg shadow-sm overflow-hidden hover:shadow-md transition-shadow ${s.alert ? "border-warning" : "border-card-border"}`}>
              {s.alert && (
                <div className="bg-yellow-50 px-6 py-2 text-xs font-medium text-yellow-800 flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3" />
                  {s.alert}
                </div>
              )}
              <div className="px-6 py-4">
                <div className="flex items-start justify-between">
                  {/* Left: Item Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[s.status]}`}>
                        {s.status.replace("_", " ")}
                      </span>
                      {s.bread && (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700">Bread & Butter</span>
                      )}
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${strat.color}`}>
                        <StratIcon className="h-3 w-3" />
                        {strat.label}
                      </span>
                      <span className="text-xs text-muted">{s.fob === "DEST" ? "FOB Dest" : "FOB Origin"}</span>
                    </div>
                    <h3 className="text-sm font-semibold">{s.item}</h3>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted">
                      <span className="font-mono">{s.id}</span>
                      <span className="font-mono text-accent">{s.nsn}</span>
                      <span>FSC {s.fsc}</span>
                      <span>{s.qty} {s.uom}</span>
                      <span>Due {s.due}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted">
                      <Truck className="h-3 w-3" />
                      {s.shipTo}
                    </div>
                  </div>

                  {/* Right: Pricing */}
                  <div className="text-right ml-6 min-w-[200px]">
                    <div className="flex items-center justify-end gap-4 text-xs text-muted mb-2">
                      <div>
                        <span>Last: </span>
                        <span className="font-mono font-medium text-foreground">${s.lastWinPrice.toFixed(2)}</span>
                        <span className="ml-1">({s.lastWinner === "Us" ? "Won" : "Lost"})</span>
                      </div>
                      <div>
                        <span>Cost: </span>
                        <span className="font-mono font-medium text-foreground">${s.ourCost.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <div>
                        <div className="text-xs text-muted">Suggested</div>
                        <div className="text-lg font-bold font-mono text-accent">${s.suggestedPrice.toFixed(2)}</div>
                        <div className="text-xs text-muted">{s.suggestedDays} days / {margin}% margin</div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <input
                          type="number"
                          defaultValue={s.suggestedPrice.toFixed(2)}
                          step="0.01"
                          className="w-24 rounded border border-card-border px-2 py-1 text-sm font-mono text-right"
                        />
                        <input
                          type="number"
                          defaultValue={s.suggestedDays}
                          className="w-24 rounded border border-card-border px-2 py-1 text-xs font-mono text-right"
                          placeholder="Days"
                        />
                      </div>
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      Est. profit: ${marginTotal} ({s.competitorCount === 0 ? "No competition" : `${s.competitorCount} competitor${s.competitorCount > 1 ? "s" : ""}`})
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
