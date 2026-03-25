import Link from "next/link";
import { ShoppingCart, Package, AlertTriangle, Check, Truck, Clock, Filter, ArrowRight } from "lucide-react";

// Mock data matching Abe's order processing workflow
// After importing from AX via NPI, he scrolls through each order one by one
// This page replaces that with a smart grouped view

const orders = [
  // Stock items — can ship immediately
  { id: "ord-001", contract: "SPE2D1-26-C-0445", nsn: "8520-01-567-8902", item: "Sunscreen, Warrior SPF 50, 4oz", qty: 3, unitPrice: 299.75, total: 899.25, qup: "12", tcn: "FP12345001", shipTo: "Norfolk, VA", shipBy: "2026-04-07", status: "IN_STOCK", isStock: true, vendor: null, expectedCost: null },
  { id: "ord-002", contract: "SPE2D1-26-C-0444", nsn: "6510-01-123-4567", item: "Bandage, Elastic 4in x 5yd", qty: 50, unitPrice: 14.48, total: 724.00, qup: "10", tcn: "NV87654001", shipTo: "Norfolk, VA", shipBy: "2026-04-05", status: "IN_STOCK", isStock: true, vendor: null, expectedCost: null },
  { id: "ord-003", contract: "SPE2D1-26-C-0443", nsn: "6515-01-234-5678", item: "Applicator, Silver Nitrate", qty: 2, unitPrice: 23.35, total: 46.70, qup: "1", tcn: "FP12345002", shipTo: "Fort Hood, TX", shipBy: "2026-04-10", status: "IN_STOCK", isStock: true, vendor: null, expectedCost: null },

  // Need to order — same vendor (Medline) — consolidation opportunity!
  { id: "ord-004", contract: "SPE2D1-26-C-0442", nsn: "6510-01-456-7890", item: "Ointment, First Aid, 1oz", qty: 7, unitPrice: 7.25, total: 50.75, qup: "12", tcn: "NV87654002", shipTo: "Norfolk, VA", shipBy: "2026-04-08", status: "RECEIVED", isStock: false, vendor: "Medline Industries", expectedCost: 2.10 },
  { id: "ord-005", contract: "SPE2D1-26-C-0441", nsn: "6510-01-456-7890", item: "Ointment, First Aid, 1oz", qty: 5, unitPrice: 7.25, total: 36.25, qup: "12", tcn: "KY11111001", shipTo: "Fort Campbell, KY", shipBy: "2026-04-08", status: "RECEIVED", isStock: false, vendor: "Medline Industries", expectedCost: 2.10 },
  { id: "ord-006", contract: "SPE2D1-26-C-0440", nsn: "6510-01-123-4567", item: "Bandage, Elastic 4in", qty: 100, unitPrice: 14.48, total: 1448.00, qup: "10", tcn: "PA17070001", shipTo: "New Cumberland, PA", shipBy: "2026-04-12", status: "RECEIVED", isStock: false, vendor: "Medline Industries", expectedCost: 8.50 },

  // Need to order — different vendors
  { id: "ord-007", contract: "SPE2D1-26-C-0439", nsn: "6545-01-901-2345", item: "Collar, Cervical, Ambu ACE", qty: 1, unitPrice: 280.00, total: 280.00, qup: "1", tcn: "CA92134001", shipTo: "San Diego, CA", shipBy: "2026-04-15", status: "RECEIVED", isStock: false, vendor: "North American Rescue", expectedCost: 93.98 },
  { id: "ord-008", contract: "SPE2D1-26-C-0438", nsn: "5305-01-890-1234", item: "Screw, Hex Head SS 1/4-20x1", qty: 3, unitPrice: 86.48, total: 259.44, qup: "1", tcn: "CA93703001", shipTo: "Fresno, CA", shipBy: "2026-04-10", status: "RECEIVED", isStock: false, vendor: "McMaster-Carr", expectedCost: 73.58 },
  { id: "ord-009", contract: "SPE2D1-26-C-0437", nsn: "6515-01-567-8901", item: "Chest Seal, Hyfin, Eschmann", qty: 2, unitPrice: 33.40, total: 66.80, qup: "1", tcn: "PA17070002", shipTo: "New Cumberland, PA", shipBy: "2026-04-08", status: "SOURCING", isStock: false, vendor: "Medline Industries", expectedCost: 18.00 },

  // Already ordered
  { id: "ord-010", contract: "SPE2D1-26-C-0436", nsn: "4240-01-678-9012", item: "Earplug, Foam, NRR 32dB", qty: 5, unitPrice: 5.69, total: 28.45, qup: "100", tcn: "NY13602001", shipTo: "Fort Drum, NY", shipBy: "2026-04-06", status: "PO_PLACED", isStock: false, vendor: "Airgas", expectedCost: 4.95 },
  { id: "ord-011", contract: "SPE2D1-26-C-0435", nsn: "4110-01-345-6780", item: "Refrigerator, Undercounter, 5.5cf", qty: 1, unitPrice: 450.00, total: 450.00, qup: "1", tcn: "HI96859001", shipTo: "Honolulu, HI", shipBy: "2026-04-20", status: "PO_PLACED", isStock: false, vendor: "Avanti Products", expectedCost: 285.00 },

  // Packing
  { id: "ord-012", contract: "SPE2D1-26-C-0434", nsn: "6515-01-789-0123", item: "Oxygen Bag, Portable", qty: 1, unitPrice: 150.78, total: 150.78, qup: "1", tcn: "VA23511001", shipTo: "Norfolk, VA", shipBy: "2026-03-30", status: "PACKING", isStock: false, vendor: "Grainger", expectedCost: 105.00 },
];

const statusConfig: Record<string, { label: string; color: string; icon: typeof Check }> = {
  RECEIVED: { label: "New", color: "bg-blue-100 text-blue-700", icon: ShoppingCart },
  SOURCING: { label: "Sourcing", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  IN_STOCK: { label: "In Stock", color: "bg-green-100 text-green-700", icon: Check },
  PO_PLACED: { label: "PO Placed", color: "bg-orange-100 text-orange-700", icon: Package },
  PACKING: { label: "Packing", color: "bg-indigo-100 text-indigo-700", icon: Package },
  SHIPPED: { label: "Shipped", color: "bg-green-100 text-green-700", icon: Truck },
};

export default function OrdersPage() {
  const stockOrders = orders.filter(o => o.isStock);
  const needsOrdering = orders.filter(o => o.status === "RECEIVED" || o.status === "SOURCING");
  const inProgress = orders.filter(o => o.status === "PO_PLACED" || o.status === "PACKING");

  // Find consolidation opportunities (same vendor, same item)
  const vendorGroups: Record<string, typeof orders> = {};
  needsOrdering.forEach(o => {
    if (o.vendor) {
      if (!vendorGroups[o.vendor]) vendorGroups[o.vendor] = [];
      vendorGroups[o.vendor].push(o);
    }
  });
  const consolidationOpps = Object.entries(vendorGroups).filter(([_, orders]) => orders.length >= 2);

  return (
    <div className="p-8">
      <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-700">
        Demo data — will connect to D365 sales orders (account DD219) for live order data
      </div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted mt-1">{orders.length} orders — {stockOrders.length} in stock, {needsOrdering.length} need ordering, {inProgress.length} in progress</p>
        </div>
        <div className="flex gap-3">
          <button disabled className="flex items-center gap-2 rounded-lg border border-card-border bg-card-bg px-4 py-2.5 text-sm font-medium opacity-50 cursor-not-allowed" title="Coming soon — will sync orders from D365">
            <Filter className="h-4 w-4" />
            Import from AX
            <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Soon</span>
          </button>
        </div>
      </div>

      {/* Pipeline Summary */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: "New", count: orders.filter(o => o.status === "RECEIVED").length, color: "border-blue-300 bg-blue-50" },
          { label: "Sourcing", count: orders.filter(o => o.status === "SOURCING").length, color: "border-yellow-300 bg-yellow-50" },
          { label: "In Stock", count: stockOrders.length, color: "border-green-300 bg-green-50" },
          { label: "PO Placed", count: orders.filter(o => o.status === "PO_PLACED").length, color: "border-orange-300 bg-orange-50" },
          { label: "Packing", count: orders.filter(o => o.status === "PACKING").length, color: "border-indigo-300 bg-indigo-50" },
        ].map(step => (
          <div key={step.label} className={`rounded-lg border-2 p-3 text-center ${step.color}`}>
            <div className="text-2xl font-bold">{step.count}</div>
            <div className="text-xs font-medium">{step.label}</div>
          </div>
        ))}
      </div>

      {/* Consolidation Alert */}
      {consolidationOpps.length > 0 && (
        <div className="mb-6 rounded-xl border-2 border-green-300 bg-green-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-5 w-5 text-green-700" />
            <h2 className="text-lg font-semibold text-green-800">Consolidation Opportunities</h2>
          </div>
          <div className="space-y-3">
            {consolidationOpps.map(([vendor, vendorOrders]) => {
              const totalQty = vendorOrders.reduce((s, o) => s + o.qty, 0);
              const totalCost = vendorOrders.reduce((s, o) => s + (o.expectedCost ?? 0) * o.qty, 0);
              return (
                <div key={vendor} className="flex items-center justify-between bg-white rounded-lg p-4 border border-green-200">
                  <div>
                    <div className="font-semibold">{vendor}</div>
                    <div className="text-sm text-muted">
                      {vendorOrders.length} orders, {totalQty} total units — combine into 1 PO
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {vendorOrders.map(o => o.item).filter((v, i, a) => a.indexOf(v) === i).join(", ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-mono font-bold">${totalCost.toFixed(2)}</div>
                      <div className="text-xs text-muted">est. cost</div>
                    </div>
                    <button className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors">
                      Create PO <ArrowRight className="h-4 w-4" /><span className="text-xs bg-yellow-100 text-yellow-700 px-1 rounded">Soon</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stock Orders — Ready to Process */}
      {stockOrders.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              <h2 className="text-lg font-semibold">In Stock — Ready to Process ({stockOrders.length})</h2>
            </div>
            <button className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
              Confirm All & Send to Warehouse <span className="text-xs bg-yellow-100 text-yellow-700 px-1 rounded ml-1">Soon</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-muted">
                  <th className="px-4 py-3 font-medium w-8"><input type="checkbox" defaultChecked className="rounded" /></th>
                  <th className="px-4 py-3 font-medium">Contract</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">QUP</th>
                  <th className="px-4 py-3 font-medium">Ship To</th>
                  <th className="px-4 py-3 font-medium">Ship By</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {stockOrders.map(o => (
                  <tr key={o.id} className="border-b border-card-border last:border-0 hover:bg-green-50/30">
                    <td className="px-4 py-3"><input type="checkbox" defaultChecked className="rounded" /></td>
                    <td className="px-4 py-3 font-mono text-xs">{o.contract}</td>
                    <td className="px-4 py-3">{o.item}</td>
                    <td className="px-4 py-3">{o.qty}</td>
                    <td className="px-4 py-3 font-mono text-xs">{o.qup}</td>
                    <td className="px-4 py-3 text-xs">{o.shipTo}</td>
                    <td className="px-4 py-3 text-muted">{o.shipBy}</td>
                    <td className="px-4 py-3 text-right font-mono">${o.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Orders Needing Purchasing */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Needs Ordering ({needsOrdering.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Contract</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium text-right">Our Cost</th>
                <th className="px-4 py-3 font-medium text-right">Sell Price</th>
                <th className="px-4 py-3 font-medium text-right">Margin</th>
                <th className="px-4 py-3 font-medium">Ship To</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {needsOrdering.map(o => {
                const margin = o.expectedCost ? Math.round((1 - o.expectedCost / o.unitPrice) * 100) : null;
                return (
                  <tr key={o.id} className="border-b border-card-border last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{o.contract}</td>
                    <td className="px-4 py-3">{o.item}</td>
                    <td className="px-4 py-3">{o.qty}</td>
                    <td className="px-4 py-3 font-medium text-xs">{o.vendor ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{o.expectedCost ? `$${o.expectedCost.toFixed(2)}` : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">${o.unitPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">{margin !== null ? `${margin}%` : "—"}</td>
                    <td className="px-4 py-3 text-xs">{o.shipTo}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig[o.status].color}`}>
                        {statusConfig[o.status].label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* In Progress */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
          <Package className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold">In Progress ({inProgress.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Contract</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Ship To</th>
                <th className="px-4 py-3 font-medium">Ship By</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {inProgress.map(o => (
                <tr key={o.id} className="border-b border-card-border last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{o.contract}</td>
                  <td className="px-4 py-3">{o.item}</td>
                  <td className="px-4 py-3">{o.qty}</td>
                  <td className="px-4 py-3 text-xs">{o.vendor}</td>
                  <td className="px-4 py-3 text-xs">{o.shipTo}</td>
                  <td className="px-4 py-3 text-muted">{o.shipBy}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig[o.status].color}`}>
                      {statusConfig[o.status].label}
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
