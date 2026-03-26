import { createServiceClient } from "@/lib/supabase-server";
import Link from "next/link";
import {
  Zap,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Package,
  Clock,
} from "lucide-react";

async function getData() {
  const supabase = createServiceClient();

  // Load only sourceable + open items for dashboard (not all 14K)
  // This is much faster than loading everything
  const { data: sourceableItems } = await supabase
    .from("dibbs_solicitations")
    .select("*")
    .eq("is_sourceable", true)
    .limit(5000);

  // Get total counts efficiently
  const { count: totalCount } = await supabase
    .from("dibbs_solicitations")
    .select("*", { count: "exact", head: true });

  const { count: noSourceCount } = await supabase
    .from("dibbs_solicitations")
    .select("*", { count: "exact", head: true })
    .eq("is_sourceable", false);

  const solicitations = sourceableItems || [];

  const { data: decisions } = await supabase
    .from("bid_decisions")
    .select("solicitation_number, nsn, status");

  const decisionMap = new Map<string, string>();
  for (const d of decisions || []) {
    decisionMap.set(`${d.solicitation_number}_${d.nsn}`, d.status);
  }

  const all = solicitations || [];

  // Parse open status (same logic as solicitations page)
  const isOpen = (s: any) => {
    if (!s.return_by_date) return true;
    const parts = s.return_by_date.split("-");
    if (parts.length === 3 && parts[2].length === 4) {
      const d = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
      return d >= new Date(new Date().toDateString());
    }
    return new Date(s.return_by_date) >= new Date(new Date().toDateString());
  };

  const sourceable = all.filter(
    (s) =>
      s.is_sourceable &&
      !s.already_bid &&
      isOpen(s) &&
      !decisionMap.has(`${s.solicitation_number}_${s.nsn}`)
  );
  const quoted = all.filter(
    (s) =>
      decisionMap.get(`${s.solicitation_number}_${s.nsn}`) === "quoted"
  );
  const submitted = all.filter(
    (s) =>
      decisionMap.get(`${s.solicitation_number}_${s.nsn}`) === "submitted"
  );
  const noSource = noSourceCount || 0;

  const totalPotentialValue = sourceable.reduce(
    (sum, s) => sum + (s.suggested_price || 0) * (s.quantity || 1),
    0
  );

  const topByValue = [...sourceable]
    .map((s) => ({
      ...s,
      potential_value: (s.suggested_price || 0) * (s.quantity || 1),
    }))
    .filter((s) => s.potential_value > 0)
    .sort((a, b) => b.potential_value - a.potential_value)
    .slice(0, 10);

  const { count: heatmapCount } = await supabase
    .from("fsc_heatmap")
    .select("*", { count: "exact", head: true })
    .eq("bucket", "hot");

  return {
    total: totalCount || 0,
    sourceable: sourceable.length,
    quoted: quoted.length,
    submitted: submitted.length,
    noSource: noSource,
    topByValue,
    totalPotentialValue,
    hotFscs: heatmapCount || 0,
  };
}

export default async function Dashboard() {
  const data = await getData();

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">DIBS Dashboard</h1>
        <p className="text-muted mt-1">
          Ever Ready First Aid (CAGE 0AG09) — Government Bidding Intelligence
        </p>
      </div>

      {/* Total Potential Value */}
      {data.totalPotentialValue > 0 && (
        <Link href="/solicitations?filter=sourceable&sort=value" className="block mb-4 rounded-xl border-2 border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 p-5 flex items-center justify-between hover:border-green-500 transition-colors">
          <div>
            <div className="text-sm font-medium text-green-700">Total Open Bid Potential</div>
            <div className="text-xs text-green-600 mt-0.5">{data.sourceable} sourceable solicitations ready to bid on →</div>
          </div>
          <div className="text-3xl md:text-4xl font-bold font-mono text-green-700">
            ${data.totalPotentialValue >= 1e6
              ? (data.totalPotentialValue / 1e6).toFixed(2) + "M"
              : data.totalPotentialValue >= 1e3
                ? (data.totalPotentialValue / 1e3).toFixed(1) + "K"
                : data.totalPotentialValue.toFixed(2)}
          </div>
        </Link>
      )}

      {/* Solicitation Pipeline */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Link
          href="/solicitations?filter=sourceable"
          className="rounded-xl border-2 border-green-300 bg-green-50 p-4 text-center hover:border-green-500 transition-colors"
        >
          <Zap className="h-5 w-5 mx-auto mb-1 text-green-600" />
          <div className="text-3xl font-bold text-green-700">
            {data.sourceable}
          </div>
          <div className="text-xs font-medium text-green-600">Sourceable</div>
          <div className="text-[10px] text-green-500 mt-0.5">Ready to bid</div>
        </Link>

        <Link
          href="/solicitations?filter=quoted"
          className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4 text-center hover:border-blue-500 transition-colors"
        >
          <DollarSign className="h-5 w-5 mx-auto mb-1 text-blue-600" />
          <div className="text-3xl font-bold text-blue-700">{data.quoted}</div>
          <div className="text-xs font-medium text-blue-600">Quoted</div>
          <div className="text-[10px] text-blue-500 mt-0.5">Ready to submit</div>
        </Link>

        <Link
          href="/solicitations?filter=submitted"
          className="rounded-xl border-2 border-purple-300 bg-purple-50 p-4 text-center hover:border-purple-500 transition-colors"
        >
          <Package className="h-5 w-5 mx-auto mb-1 text-purple-600" />
          <div className="text-3xl font-bold text-purple-700">{data.submitted}</div>
          <div className="text-xs font-medium text-purple-600">Submitted</div>
        </Link>

        <Link
          href="/solicitations?filter=all_unsourced"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-center hover:border-amber-500 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-amber-600" />
          <div className="text-3xl font-bold text-amber-700">{data.noSource}</div>
          <div className="text-xs font-medium text-amber-600">No Source</div>
        </Link>

        <Link
          href="/solicitations?filter=all"
          className="rounded-xl border border-card-border bg-card-bg p-4 text-center hover:border-accent transition-colors"
        >
          <Clock className="h-5 w-5 mx-auto mb-1 text-muted" />
          <div className="text-3xl font-bold">{data.total}</div>
          <div className="text-xs font-medium text-muted">Total</div>
        </Link>
      </div>

      {/* Top Sourceable by Value */}
      {data.topByValue.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold">Top Sourceable — Highest Value</h2>
            </div>
            <Link
              href="/solicitations?filter=sourceable&sort=value"
              className="text-sm text-accent hover:text-accent-hover font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-muted">
                  <th className="px-4 py-3 font-medium">NSN</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium text-right">Qty</th>
                  <th className="px-4 py-3 font-medium text-right">Cost</th>
                  <th className="px-4 py-3 font-medium text-right">Suggested</th>
                  <th className="px-4 py-3 font-medium text-right">Margin</th>
                  <th className="px-4 py-3 font-medium text-right">Potential Value</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {data.topByValue.map((s) => (
                  <tr key={s.id} className="border-b border-card-border last:border-0 hover:bg-green-50/50">
                    <td className="px-4 py-2 font-mono text-xs text-accent">{s.nsn}</td>
                    <td className="px-4 py-2">
                      <div className="truncate max-w-[200px]">{s.nomenclature || "—"}</div>
                      {s.cost_source && <div className="text-[10px] text-muted">{s.cost_source}</div>}
                    </td>
                    <td className="px-4 py-2 text-right">{s.quantity}</td>
                    <td className="px-4 py-2 text-right font-mono text-muted">
                      {s.our_cost ? `$${s.our_cost.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-medium text-green-600">
                      ${s.suggested_price?.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {s.margin_pct !== null ? (
                        <span className={`font-medium ${s.margin_pct >= 20 ? "text-green-600" : s.margin_pct >= 10 ? "text-yellow-600" : "text-red-600"}`}>
                          {s.margin_pct}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-bold">
                      ${s.potential_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted whitespace-nowrap">{s.return_by_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/solicitations" className="flex items-center gap-3 rounded-xl border-2 border-accent/30 bg-accent/5 p-4 hover:border-accent transition-colors">
          <Zap className="h-5 w-5 text-accent" />
          <div>
            <p className="text-sm font-medium">Solicitations</p>
            <p className="text-xs text-muted">Review, bid, submit</p>
          </div>
        </Link>
        <Link href="/orders" className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg p-4 hover:border-accent transition-colors">
          <Package className="h-5 w-5 text-muted" />
          <div>
            <p className="text-sm font-medium">Orders</p>
            <p className="text-xs text-muted">Process & ship</p>
          </div>
        </Link>
        <Link href="/analytics" className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg p-4 hover:border-accent transition-colors">
          <TrendingUp className="h-5 w-5 text-muted" />
          <div>
            <p className="text-sm font-medium">Analytics</p>
            <p className="text-xs text-muted">{data.hotFscs} hot FSCs</p>
          </div>
        </Link>
        <Link href="/settings" className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg p-4 hover:border-accent transition-colors">
          <Clock className="h-5 w-5 text-muted" />
          <div>
            <p className="text-sm font-medium">Settings</p>
            <p className="text-xs text-muted">Data sources</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
