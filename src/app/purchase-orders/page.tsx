import { Package, Plus, Check, Clock, Truck, AlertTriangle } from "lucide-react";

// Mock PO data — replaces Abe's manual one-by-one PO creation in AX
const purchaseOrders = [
  {
    poNumber: "PO-GOV-2026-0312", vendor: "Medline Industries", status: "DRAFT",
    isGovernment: true, totalCost: 1035.00, lineCount: 4, createdAt: "2026-03-24",
    lines: [
      { item: "Ointment, First Aid, 1oz", nsn: "6510-01-456-7890", qty: 12, unitCost: 2.10, total: 25.20, orders: ["SPE2D1-26-C-0442", "SPE2D1-26-C-0441"] },
      { item: "Bandage, Elastic 4in", nsn: "6510-01-123-4567", qty: 100, unitCost: 8.50, total: 850.00, orders: ["SPE2D1-26-C-0440"] },
      { item: "Chest Seal, Eschmann", nsn: "6515-01-567-8901", qty: 2, unitCost: 18.00, total: 36.00, orders: ["SPE2D1-26-C-0437"] },
      { item: "Gauze Pad, Sterile 4x4", nsn: "6510-01-678-9012", qty: 50, unitCost: 2.48, total: 124.00, orders: ["SPE2D1-26-C-0433"] },
    ],
    notes: "GOVERNMENT ORDER — Route to Gov Department on receipt",
  },
  {
    poNumber: "PO-GOV-2026-0311", vendor: "North American Rescue", status: "SUBMITTED",
    isGovernment: true, totalCost: 93.98, lineCount: 1, createdAt: "2026-03-23",
    lines: [
      { item: "Collar, Cervical, Ambu ACE", nsn: "6545-01-901-2345", qty: 1, unitCost: 93.98, total: 93.98, orders: ["SPE2D1-26-C-0439"] },
    ],
    notes: "GOVERNMENT ORDER — Route to Gov Department on receipt",
  },
  {
    poNumber: "PO-GOV-2026-0310", vendor: "McMaster-Carr", status: "CONFIRMED",
    isGovernment: true, totalCost: 220.74, lineCount: 1, createdAt: "2026-03-22",
    lines: [
      { item: "Screw, Hex Head SS 1/4-20x1", nsn: "5305-01-890-1234", qty: 3, unitCost: 73.58, total: 220.74, orders: ["SPE2D1-26-C-0438"] },
    ],
    notes: "GOVERNMENT ORDER — FOB Origin, gov pays freight",
  },
  {
    poNumber: "PO-GOV-2026-0309", vendor: "Airgas", status: "RECEIVED",
    isGovernment: true, totalCost: 24.75, lineCount: 1, createdAt: "2026-03-21",
    lines: [
      { item: "Earplug, Foam, NRR 32dB", nsn: "4240-01-678-9012", qty: 5, unitCost: 4.95, total: 24.75, orders: ["SPE2D1-26-C-0436"] },
    ],
    notes: "GOVERNMENT ORDER — Route to Gov Department on receipt",
  },
  {
    poNumber: "PO-GOV-2026-0308", vendor: "Avanti Products", status: "CONFIRMED",
    isGovernment: true, totalCost: 285.00, lineCount: 1, createdAt: "2026-03-20",
    lines: [
      { item: "Refrigerator, Undercounter, 5.5cf", nsn: "4110-01-345-6780", qty: 1, unitCost: 285.00, total: 285.00, orders: ["SPE2D1-26-C-0435"] },
    ],
    notes: "GOVERNMENT ORDER — Ships on pallet. FOB Destination.",
  },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-600" },
  SUBMITTED: { label: "Submitted", color: "bg-blue-100 text-blue-700" },
  CONFIRMED: { label: "Confirmed", color: "bg-green-100 text-green-700" },
  RECEIVED: { label: "Received", color: "bg-purple-100 text-purple-700" },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-700" },
};

export default function PurchaseOrdersPage() {
  const draftCount = purchaseOrders.filter(po => po.status === "DRAFT").length;
  const totalOpen = purchaseOrders.filter(po => po.status !== "RECEIVED" && po.status !== "CANCELLED").length;
  const totalValue = purchaseOrders.reduce((s, po) => s + po.totalCost, 0);

  return (
    <div className="p-8">
      <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-700">Demo data — will connect to D365 for live purchase orders</div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-muted mt-1">Manage supplier POs — auto-consolidated from government orders</p>
        </div>
        <button disabled title="Coming soon" className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white opacity-50 cursor-not-allowed">
          <Plus className="h-4 w-4" />
          Create PO <span className="text-xs bg-yellow-100 text-yellow-700 px-1 rounded">Soon</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Draft POs</p>
          <p className="text-2xl font-bold mt-1 text-orange-600">{draftCount}</p>
          <p className="text-xs text-muted">Ready to submit</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Open POs</p>
          <p className="text-2xl font-bold mt-1">{totalOpen}</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Total Value</p>
          <p className="text-2xl font-bold mt-1">${totalValue.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <p className="text-sm text-muted">Avg Lines/PO</p>
          <p className="text-2xl font-bold mt-1">{(purchaseOrders.reduce((s, po) => s + po.lineCount, 0) / purchaseOrders.length).toFixed(1)}</p>
          <p className="text-xs text-muted">Consolidated</p>
        </div>
      </div>

      {/* PO List */}
      <div className="space-y-4">
        {purchaseOrders.map(po => (
          <div key={po.poNumber} className={`rounded-xl border bg-card-bg shadow-sm ${po.status === "DRAFT" ? "border-orange-300" : "border-card-border"}`}>
            <div className="px-6 py-4 border-b border-card-border">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono font-bold">{po.poNumber}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig[po.status].color}`}>
                      {statusConfig[po.status].label}
                    </span>
                    {po.isGovernment && (
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700">GOV</span>
                    )}
                  </div>
                  <div className="text-sm font-medium">{po.vendor}</div>
                  <div className="text-xs text-muted mt-1">{po.lineCount} line{po.lineCount > 1 ? "s" : ""} / Created {po.createdAt}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold font-mono">${po.totalCost.toFixed(2)}</div>
                  {po.status === "DRAFT" && (
                    <button className="mt-2 flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors">
                      <Check className="h-3 w-3" /> Submit PO <span className="text-xs bg-yellow-100 text-yellow-700 px-1 rounded">Soon</span>
                    </button>
                  )}
                </div>
              </div>
              {po.notes && (
                <div className="mt-2 flex items-center gap-1 text-xs text-orange-700 bg-orange-50 rounded px-2 py-1">
                  <AlertTriangle className="h-3 w-3" />
                  {po.notes}
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted text-xs">
                    <th className="px-6 py-2 font-medium">Item</th>
                    <th className="px-6 py-2 font-medium">NSN</th>
                    <th className="px-6 py-2 font-medium">Qty</th>
                    <th className="px-6 py-2 font-medium text-right">Unit Cost</th>
                    <th className="px-6 py-2 font-medium text-right">Total</th>
                    <th className="px-6 py-2 font-medium">Fulfills Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((line, i) => (
                    <tr key={i} className="border-t border-card-border hover:bg-gray-50">
                      <td className="px-6 py-2">{line.item}</td>
                      <td className="px-6 py-2 font-mono text-xs text-accent">{line.nsn}</td>
                      <td className="px-6 py-2">{line.qty}</td>
                      <td className="px-6 py-2 text-right font-mono">${line.unitCost.toFixed(2)}</td>
                      <td className="px-6 py-2 text-right font-mono font-medium">${line.total.toFixed(2)}</td>
                      <td className="px-6 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {line.orders.map(ord => (
                            <span key={ord} className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{ord.slice(-4)}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
