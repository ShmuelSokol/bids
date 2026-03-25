import Link from "next/link";
import { Zap, Shield, DollarSign } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAnalyticsData() {
  const [heatmapRes, expansionRes, awardsRes] = await Promise.all([
    supabase
      .from("fsc_heatmap")
      .select("*")
      .order("bids_last_month", { ascending: false }),
    supabase
      .from("fsc_expansion")
      .select("*")
      .order("sols_last_6mo", { ascending: false }),
    supabase.from("awards").select("unit_price, quantity, extended_value, fsc"),
  ]);

  const heatmap = heatmapRes.data ?? [];
  const expansion = expansionRes.data ?? [];
  const awards = awardsRes.data ?? [];

  const totalRevenue = awards.reduce(
    (s, a) => s + (a.extended_value || 0),
    0
  );
  const avgOrderValue =
    awards.length > 0 ? totalRevenue / awards.length : 0;

  return { heatmap, expansion, awards, totalRevenue, avgOrderValue };
}

const bucketColors: Record<string, string> = {
  hot: "bg-red-100 text-red-700",
  warm: "bg-yellow-100 text-yellow-700",
  cold: "bg-gray-100 text-gray-600",
};

export default async function AnalyticsPage() {
  const { heatmap, expansion, totalRevenue, avgOrderValue, awards } =
    await getAnalyticsData();

  const hot = heatmap.filter((r) => r.bucket === "hot");
  const warm = heatmap.filter((r) => r.bucket === "warm");
  const cold = heatmap.filter((r) => r.bucket === "cold");

  // Revenue by FSC (from awards)
  const revByFsc: Record<string, number> = {};
  awards.forEach((a) => {
    const fsc = a.fsc?.trim();
    if (fsc) revByFsc[fsc] = (revByFsc[fsc] || 0) + (a.extended_value || 0);
  });
  const topRevFscs = Object.entries(revByFsc)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const unbid = expansion.filter(
    (r) => r.status === "unbid" && r.sols_last_6mo > 0
  );
  const lowRate = expansion.filter((r) => r.status === "low_rate");

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Analytics & Intelligence</h1>
        <p className="text-muted mt-1">
          Real data from LamLinks — 492K bids, 257K awards, 332 FSC categories
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link
          href="/analytics/expansion"
          className="rounded-xl border-2 border-green-200 bg-green-50/50 p-5 hover:border-green-400 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-2">
            <Zap className="h-6 w-6 text-green-600" />
            <h2 className="text-lg font-semibold group-hover:text-green-700">
              Category Expansion
            </h2>
          </div>
          <p className="text-sm text-muted">
            {unbid.length} FSC categories with active solicitations that Abe
            isn't bidding on.
          </p>
          <div className="mt-3 text-sm font-medium text-green-700">
            {unbid
              .reduce((s, r) => s + (r.sols_last_6mo || 0), 0)
              .toLocaleString()}{" "}
            unbid solicitations →
          </div>
        </Link>
        <Link
          href="/analytics/competitors"
          className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-5 hover:border-blue-400 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-6 w-6 text-blue-600" />
            <h2 className="text-lg font-semibold group-hover:text-blue-700">
              DLA Spend Analysis
            </h2>
          </div>
          <p className="text-sm text-muted">
            10,000 DLA awards from USASpending.gov — who's winning what.
          </p>
          <div className="mt-3 text-sm font-medium text-blue-700">
            View DLA landscape →
          </div>
        </Link>
        <div className="rounded-xl border border-card-border bg-card-bg p-5">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-6 w-6 text-accent" />
            <h2 className="text-lg font-semibold">Key Metrics</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <p className="text-xs text-muted">Sample Revenue</p>
              <p className="text-lg font-bold">
                ${(totalRevenue / 1e6).toFixed(1)}M
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Avg Order Value</p>
              <p className="text-lg font-bold">${avgOrderValue.toFixed(0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* FSC Heatmap */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            FSC Heatmap — {hot.length} Hot / {warm.length} Warm / {cold.length}{" "}
            Cold
          </h2>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card-bg">
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-6 py-3 font-medium">FSC</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">
                  Last Month
                </th>
                <th className="px-6 py-3 font-medium text-right">Last 6mo</th>
                <th className="px-6 py-3 font-medium text-right">All Time</th>
                <th className="px-6 py-3 font-medium">Last Bid</th>
              </tr>
            </thead>
            <tbody>
              {heatmap.map((f) => (
                <tr
                  key={f.fsc_code}
                  className="border-b border-card-border last:border-0 hover:bg-gray-50"
                >
                  <td className="px-6 py-2 font-mono font-medium">
                    {f.fsc_code}
                  </td>
                  <td className="px-6 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${bucketColors[f.bucket]}`}
                    >
                      {f.bucket.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-2 text-right font-mono">
                    {f.bids_last_month > 0
                      ? f.bids_last_month.toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-6 py-2 text-right font-mono text-muted">
                    {f.bids_last_6_months > 0
                      ? f.bids_last_6_months.toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-6 py-2 text-right font-mono text-muted">
                    {f.total_bids.toLocaleString()}
                  </td>
                  <td className="px-6 py-2 text-muted text-xs">
                    {f.most_recent_bid
                      ? new Date(f.most_recent_bid).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue by FSC + Expansion side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border">
            <h2 className="text-lg font-semibold">
              Top FSCs by Award Revenue (sample)
            </h2>
          </div>
          <div className="p-6 space-y-3">
            {topRevFscs.map(([fsc, rev]) => {
              const maxRev = topRevFscs[0][1] as number;
              const pct = ((rev as number) / maxRev) * 100;
              return (
                <div key={fsc} className="flex items-center gap-3">
                  <span className="font-mono text-xs w-10 text-muted">
                    {fsc}
                  </span>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono w-20 text-right">
                    ${((rev as number) / 1000).toFixed(0)}K
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
          <div className="px-6 py-4 border-b border-card-border">
            <h2 className="text-lg font-semibold">
              Expansion: Low Bid Rate FSCs
            </h2>
            <p className="text-xs text-muted mt-1">
              Active FSCs where Abe bids on less than 10% of solicitations
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-muted">
                  <th className="px-6 py-3 font-medium">FSC</th>
                  <th className="px-6 py-3 font-medium text-right">
                    Sols (6mo)
                  </th>
                  <th className="px-6 py-3 font-medium text-right">Bids</th>
                  <th className="px-6 py-3 font-medium text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {lowRate.slice(0, 10).map((r) => (
                  <tr
                    key={r.fsc_code}
                    className="border-b border-card-border last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-6 py-2 font-mono font-medium">
                      {r.fsc_code}
                    </td>
                    <td className="px-6 py-2 text-right font-mono">
                      {r.sols_last_6mo?.toLocaleString()}
                    </td>
                    <td className="px-6 py-2 text-right font-mono">
                      {r.bids_last_6mo}
                    </td>
                    <td className="px-6 py-2 text-right font-mono text-red-600">
                      {r.bid_rate_pct?.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
