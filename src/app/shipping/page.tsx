import { Truck, Package, MapPin, DollarSign, AlertTriangle, Clock, Combine, Check } from "lucide-react";

// Mock data — shipping consolidation is the biggest cost savings opportunity
// ~50% of medical shipments go to 3 depots: New Cumberland PA, San Joaquin CA, Norfolk VA

const todaysShipments = [
  // Norfolk VA cluster — consolidation opportunity!
  { id: "shp-001", contract: "SPE2D1-26-C-0445", item: "Sunscreen, Warrior SPF 50", qty: 3, destination: "Norfolk, VA", zip: "23511", isDepot: false, isNavy: true, weight: 2.5, tcn: "NV87654001", status: "READY", estShipping: 12.50 },
  { id: "shp-002", contract: "SPE2D1-26-C-0444", item: "Bandage, Elastic 4in", qty: 50, destination: "Norfolk, VA", zip: "23511", isDepot: false, isNavy: true, weight: 8.0, tcn: "NV87654002", status: "READY", estShipping: 18.00 },
  { id: "shp-003", contract: "SPE2D1-26-C-0434", item: "Oxygen Bag, Portable", qty: 1, destination: "Norfolk, VA", zip: "23511", isDepot: false, isNavy: true, weight: 3.5, tcn: "VA23511001", status: "LABELS_PRINTED", estShipping: 14.00 },

  // New Cumberland PA cluster — consolidation opportunity!
  { id: "shp-004", contract: "SPE2D1-26-C-0440", item: "Bandage, Elastic 4in", qty: 100, destination: "New Cumberland, PA", zip: "17070", isDepot: true, isNavy: false, weight: 15.0, tcn: "PA17070001", status: "READY", estShipping: 16.50 },
  { id: "shp-005", contract: "SPE2D1-26-C-0437", item: "Chest Seal, Eschmann", qty: 2, destination: "New Cumberland, PA", zip: "17070", isDepot: true, isNavy: false, weight: 0.5, tcn: "PA17070002", status: "READY", estShipping: 9.50 },

  // Individual shipments
  { id: "shp-006", contract: "SPE2D1-26-C-0443", item: "Silver Nitrate Applicator", qty: 2, destination: "Fort Hood, TX", zip: "76544", isDepot: false, isNavy: false, weight: 0.8, tcn: "FP12345002", status: "READY", estShipping: 11.00 },
  { id: "shp-007", contract: "SPE2D1-26-C-0439", item: "Collar, Cervical, Ambu ACE", qty: 1, destination: "San Diego, CA", zip: "92134", isDepot: false, isNavy: true, weight: 1.2, tcn: "CA92134001", status: "READY", estShipping: 15.50 },
  { id: "shp-008", contract: "SPE2D1-26-C-0438", item: "Screw, Hex Head SS", qty: 3, destination: "Fresno, CA", zip: "93703", isDepot: false, isNavy: false, weight: 5.0, tcn: "CA93703001", status: "READY", estShipping: 14.00, fobOrigin: true },
  { id: "shp-009", contract: "SPE2D1-26-C-0436", item: "Earplug, Foam, NRR 32dB", qty: 5, destination: "Fort Drum, NY", zip: "13602", isDepot: false, isNavy: false, weight: 3.0, tcn: "NY13602001", status: "LABELS_PRINTED", estShipping: 10.50 },
  { id: "shp-010", contract: "SPE2D1-26-C-0435", item: "Refrigerator, 5.5cf", qty: 1, destination: "Honolulu, HI", zip: "96859", isDepot: false, isNavy: false, weight: 85.0, tcn: "HI96859001", status: "READY", estShipping: 145.00, needsPallet: true },
];

// Group by destination for consolidation analysis
const destinationGroups: Record<string, typeof todaysShipments> = {};
todaysShipments.forEach(s => {
  const key = `${s.destination} (${s.zip})`;
  if (!destinationGroups[key]) destinationGroups[key] = [];
  destinationGroups[key].push(s);
});

const consolidationOpps = Object.entries(destinationGroups)
  .filter(([_, shipments]) => shipments.length >= 2)
  .map(([dest, shipments]) => {
    const individualCost = shipments.reduce((s, sh) => s + sh.estShipping, 0);
    const totalWeight = shipments.reduce((s, sh) => s + sh.weight, 0);
    const consolidatedCost = Math.round((8.50 + totalWeight * 0.45) * 100) / 100; // rough estimate
    const savings = Math.round((individualCost - consolidatedCost) * 100) / 100;
    return { dest, shipments, individualCost, consolidatedCost, savings, totalWeight };
  })
  .sort((a, b) => b.savings - a.savings);

const statusColors: Record<string, string> = {
  READY: "bg-blue-100 text-blue-700",
  LABELS_PRINTED: "bg-purple-100 text-purple-700",
  SHIPPED: "bg-green-100 text-green-700",
  DELIVERED: "bg-gray-100 text-gray-500",
};

export default function ShippingPage() {
  const totalShipments = todaysShipments.length;
  const readyCount = todaysShipments.filter(s => s.status === "READY").length;
  const totalShippingCost = todaysShipments.filter(s => !(s as any).fobOrigin).reduce((s, sh) => s + sh.estShipping, 0);
  const potentialSavings = consolidationOpps.reduce((s, c) => s + c.savings, 0);

  return (
    <div className="p-8">
      <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-700">Demo data — will connect to D365 shipment tracking</div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shipping</h1>
          <p className="text-muted mt-1">Manage shipments, consolidation, labels, and compliance</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
            Print All Labels
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
            <Truck className="h-4 w-4" />
            Ship All Ready
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Today's Shipments</p>
          <p className="text-2xl font-bold mt-1">{totalShipments}</p>
          <p className="text-xs text-muted">{readyCount} ready to ship</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Est. Freight Cost</p>
          <p className="text-2xl font-bold mt-1">${totalShippingCost.toFixed(2)}</p>
          <p className="text-xs text-muted">FOB destination only</p>
        </div>
        <div className="rounded-lg border-2 border-green-300 bg-green-50 p-4">
          <p className="text-sm text-green-700 font-medium">Consolidation Savings</p>
          <p className="text-2xl font-bold text-green-700 mt-1">${potentialSavings.toFixed(2)}</p>
          <p className="text-xs text-green-600">{consolidationOpps.length} opportunities today</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Top Destinations</p>
          <p className="text-2xl font-bold mt-1">3 depots</p>
          <p className="text-xs text-muted">Norfolk, New Cumberland, San Joaquin</p>
        </div>
      </div>

      {/* Consolidation Opportunities */}
      {consolidationOpps.length > 0 && (
        <div className="rounded-xl border-2 border-green-300 bg-green-50/50 shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-green-200 flex items-center gap-2">
            <Combine className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-green-800">Consolidation Opportunities</h2>
            <span className="text-xs text-green-600 ml-2">Ship multiple orders to same depot in one master carton</span>
          </div>
          <div className="divide-y divide-green-200">
            {consolidationOpps.map((opp) => (
              <div key={opp.dest} className="px-6 py-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4 text-green-600" />
                      <span className="font-semibold">{opp.dest}</span>
                      <span className="text-xs text-muted">{opp.shipments.length} shipments, {opp.totalWeight.toFixed(1)} lbs</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-xs">
                      <div className="text-muted line-through">Individual: ${opp.individualCost.toFixed(2)}</div>
                      <div className="text-green-700 font-bold">Combined: ${opp.consolidatedCost.toFixed(2)}</div>
                      <div className="text-green-600 font-semibold">Save ${opp.savings.toFixed(2)}</div>
                    </div>
                    <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors">
                      Consolidate
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {opp.shipments.map(sh => (
                    <div key={sh.id} className="flex items-center justify-between bg-white rounded px-3 py-2 text-xs border border-green-200">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-muted">{sh.contract}</span>
                        <span>{sh.item}</span>
                        <span className="text-muted">×{sh.qty}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-muted">TCN: {sh.tcn}</span>
                        <span className="text-muted">{sh.weight} lbs</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${statusColors[sh.status]}`}>
                          {sh.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Shipments */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="px-6 py-4 border-b border-card-border">
          <h2 className="text-lg font-semibold">All Shipments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-4 py-3 font-medium w-8"><input type="checkbox" className="rounded" /></th>
                <th className="px-4 py-3 font-medium">Contract</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Destination</th>
                <th className="px-4 py-3 font-medium">TCN</th>
                <th className="px-4 py-3 font-medium">Weight</th>
                <th className="px-4 py-3 font-medium text-right">Est. Freight</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {todaysShipments.map(sh => (
                <tr key={sh.id} className={`border-b border-card-border last:border-0 hover:bg-gray-50 ${(sh as any).needsPallet ? "bg-orange-50/30" : ""}`}>
                  <td className="px-4 py-3"><input type="checkbox" className="rounded" /></td>
                  <td className="px-4 py-3 font-mono text-xs">{sh.contract}</td>
                  <td className="px-4 py-3">
                    {sh.item}
                    {(sh as any).needsPallet && <span className="ml-2 text-xs text-orange-600 font-medium">PALLET</span>}
                  </td>
                  <td className="px-4 py-3">{sh.qty}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex items-center gap-1">
                      {sh.isDepot && <span className="text-xs bg-blue-50 text-blue-600 px-1 rounded">DEPOT</span>}
                      {sh.isNavy && <span className="text-xs bg-indigo-50 text-indigo-600 px-1 rounded">NAVY</span>}
                      {sh.destination}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{sh.tcn}</td>
                  <td className="px-4 py-3">{sh.weight} lbs</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {(sh as any).fobOrigin ? <span className="text-xs text-muted">GOV PAYS</span> : `$${sh.estShipping.toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[sh.status]}`}>
                      {sh.status.replace("_", " ")}
                    </span>
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
