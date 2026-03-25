import { StatCard } from "@/components/stat-card";
import Link from "next/link";
import {
  FileSearch,
  ShoppingCart,
  Receipt,
  TrendingUp,
  Target,
  Flame,
  Database,
  DollarSign,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getDashboardData() {
  const [heatmapRes, expansionRes, awardsRes, usaRes] = await Promise.all([
    supabase.from("fsc_heatmap").select("*"),
    supabase.from("fsc_expansion").select("*"),
    supabase.from("awards").select("*").order("award_date", { ascending: false }).limit(10),
    supabase.from("usaspending_awards").select("award_amount").limit(10000),
  ]);

  const heatmap = heatmapRes.data ?? [];
  const expansion = expansionRes.data ?? [];
  const awards = awardsRes.data ?? [];
  const usaAwards = usaRes.data ?? [];

  const hot = heatmap.filter((r) => r.bucket === "hot");
  const warm = heatmap.filter((r) => r.bucket === "warm");
  const cold = heatmap.filter((r) => r.bucket === "cold");

  const totalBids = heatmap.reduce((s, r) => s + (r.total_bids || 0), 0);
  const bidsLastMonth = heatmap.reduce((s, r) => s + (r.bids_last_month || 0), 0);
  const bids6mo = heatmap.reduce((s, r) => s + (r.bids_last_6_months || 0), 0);

  const unbidOpps = expansion.filter((r) => r.status === "unbid" && r.sols_last_6mo > 0);
  const totalUnbidSols = unbidOpps.reduce((s, r) => s + (r.sols_last_6mo || 0), 0);

  const dlaTotal = usaAwards.reduce((s, r) => s + (r.award_amount || 0), 0);

  return {
    hot: hot.length,
    warm: warm.length,
    cold: cold.length,
    totalBids,
    bidsLastMonth,
    bids6mo,
    unbidFSCs: unbidOpps.length,
    totalUnbidSols,
    dlaTotal,
    topHotFSCs: hot.sort((a, b) => b.bids_last_month - a.bids_last_month).slice(0, 8),
    recentAwards: awards,
    topExpansion: unbidOpps.sort((a, b) => b.sols_last_6mo - a.sols_last_6mo).slice(0, 8),
  };
}

export default async function Dashboard() {
  const data = await getDashboardData();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">DIBS Dashboard</h1>
        <p className="text-muted mt-1">
          Government Bidding Intelligence — ERG Supply (CAGE 0AG09)
        </p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Hot FSC Categories"
          value={data.hot}
          subtitle={`${data.warm} warm, ${data.cold} cold`}
          icon={Flame}
          color="red"
        />
        <StatCard
          title="Bids Last Month"
          value={data.bidsLastMonth.toLocaleString()}
          subtitle={`${data.totalBids.toLocaleString()} all time`}
          icon={FileSearch}
          color="blue"
        />
        <StatCard
          title="Expansion Opportunities"
          value={data.unbidFSCs}
          subtitle={`${data.totalUnbidSols.toLocaleString()} unbid solicitations`}
          icon={Target}
          color="green"
        />
        <StatCard
          title="DLA Spend (6mo sample)"
          value={`$${(data.dlaTotal / 1e9).toFixed(1)}B`}
          subtitle="USASpending.gov"
          icon={DollarSign}
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hot FSCs */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
            <h2 className="text-lg font-semibold">Hot FSC Categories</h2>
            <Link
              href="/analytics"
              className="text-sm text-accent hover:text-accent-hover font-medium"
            >
              View Heatmap
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-muted">
                  <th className="px-6 py-3 font-medium">FSC</th>
                  <th className="px-6 py-3 font-medium text-right">Last Month</th>
                  <th className="px-6 py-3 font-medium text-right">Last 6mo</th>
                  <th className="px-6 py-3 font-medium text-right">All Time</th>
                </tr>
              </thead>
              <tbody>
                {data.topHotFSCs.map((f) => (
                  <tr
                    key={f.fsc_code}
                    className="border-b border-card-border last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-6 py-3 font-mono font-medium">
                      {f.fsc_code}
                    </td>
                    <td className="px-6 py-3 text-right font-mono">
                      {f.bids_last_month.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-muted">
                      {f.bids_last_6_months.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-muted">
                      {f.total_bids.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Awards */}
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Awards</h2>
            <Link
              href="/orders"
              className="text-sm text-accent hover:text-accent-hover font-medium"
            >
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-muted">
                  <th className="px-6 py-3 font-medium">Item</th>
                  <th className="px-6 py-3 font-medium text-right">Price</th>
                  <th className="px-6 py-3 font-medium text-right">Qty</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAwards.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-card-border last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-6 py-3">
                      <div className="truncate max-w-[200px]" title={a.description}>
                        {a.description || "—"}
                      </div>
                      <div className="text-xs text-muted font-mono">
                        {a.fsc}-{a.niin}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right font-mono">
                      ${a.unit_price?.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-right">{a.quantity}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.ship_status === "Shipped"
                            ? "bg-green-100 text-green-700"
                            : a.ship_status === "Closed"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {a.ship_status || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Expansion Opportunities */}
      <div className="mt-6 rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Top Expansion Opportunities</h2>
          <span className="text-sm text-muted">
            {data.unbidFSCs} FSCs with solicitations Abe isn't bidding on
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-6 py-3 font-medium">FSC</th>
                <th className="px-6 py-3 font-medium text-right">Sols (6mo)</th>
                <th className="px-6 py-3 font-medium text-right">Historical Bids</th>
                <th className="px-6 py-3 font-medium text-right">All-time Sols</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.topExpansion.map((e) => (
                <tr
                  key={e.fsc_code}
                  className="border-b border-card-border last:border-0 hover:bg-gray-50"
                >
                  <td className="px-6 py-3 font-mono font-medium">{e.fsc_code}</td>
                  <td className="px-6 py-3 text-right font-mono">
                    {e.sols_last_6mo?.toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-muted">
                    {e.bids_placed?.toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-muted">
                    {e.solicitations_received?.toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        e.bids_placed > 0
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {e.bids_placed > 0 ? "DROPPED" : "NEVER BID"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <Link
          href="/analytics"
          className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg p-4 hover:border-accent transition-colors"
        >
          <TrendingUp className="h-5 w-5 text-muted" />
          <div>
            <p className="text-sm font-medium">Analytics</p>
            <p className="text-xs text-muted">FSC heatmap & win rates</p>
          </div>
        </Link>
        <Link
          href="/orders"
          className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg p-4 hover:border-accent transition-colors"
        >
          <ShoppingCart className="h-5 w-5 text-muted" />
          <div>
            <p className="text-sm font-medium">Awards</p>
            <p className="text-xs text-muted">5,000 recent orders</p>
          </div>
        </Link>
        <Link
          href="/solicitations"
          className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg p-4 hover:border-accent transition-colors"
        >
          <FileSearch className="h-5 w-5 text-muted" />
          <div>
            <p className="text-sm font-medium">Solicitations</p>
            <p className="text-xs text-muted">Bid review & pricing</p>
          </div>
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg p-4 hover:border-accent transition-colors"
        >
          <Database className="h-5 w-5 text-muted" />
          <div>
            <p className="text-sm font-medium">Settings</p>
            <p className="text-xs text-muted">Data connections</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
