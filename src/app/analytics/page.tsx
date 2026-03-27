import { createServiceClient } from "@/lib/supabase-server";
import Link from "next/link";
import { ChevronLeft, TrendingUp, Target, DollarSign, BarChart3 } from "lucide-react";

async function getData() {
  const supabase = createServiceClient();

  const { data: heatmap } = await supabase
    .from("fsc_heatmap")
    .select("*")
    .order("total_bids", { ascending: false })
    .limit(500);

  // Get award counts by FSC — parallel range queries for more coverage
  const [aw1, aw2, aw3, aw4, aw5] = await Promise.all([
    supabase.from("awards").select("fsc").eq("cage", "0AG09").range(0, 999),
    supabase.from("awards").select("fsc").eq("cage", "0AG09").range(1000, 1999),
    supabase.from("awards").select("fsc").eq("cage", "0AG09").range(2000, 2999),
    supabase.from("awards").select("fsc").eq("cage", "0AG09").range(3000, 3999),
    supabase.from("awards").select("fsc").eq("cage", "0AG09").range(4000, 4999),
  ]);
  const awardCounts = [...(aw1.data||[]), ...(aw2.data||[]), ...(aw3.data||[]), ...(aw4.data||[]), ...(aw5.data||[])];

  const awardsByFsc: Record<string, number> = {};
  for (const a of awardCounts || []) {
    awardsByFsc[a.fsc] = (awardsByFsc[a.fsc] || 0) + 1;
  }

  const enriched = (heatmap || []).map((h) => {
    const awards = awardsByFsc[h.fsc_code] || 0;
    const bids = h.total_bids || 0;
    const winRate = bids > 0 ? Math.round((awards / bids) * 100) : 0;
    return { ...h, awards, winRate };
  });

  const totalBids = enriched.reduce((s, h) => s + (h.total_bids || 0), 0);
  const totalAwards = enriched.reduce((s, h) => s + h.awards, 0);
  const overallWinRate = totalBids > 0 ? Math.round((totalAwards / totalBids) * 100) : 0;
  const dlaSpend = enriched.reduce((s, h) => s + (h.dla_spend_6mo || 0), 0);

  return { fscs: enriched, totalBids, totalAwards, overallWinRate, dlaSpend };
}

export default async function AnalyticsPage() {
  const { fscs, totalBids, totalAwards, overallWinRate, dlaSpend } = await getData();

  const hot = fscs.filter((f: any) => f.bucket === "hot");
  const warm = fscs.filter((f: any) => f.bucket === "warm");
  const cold = fscs.filter((f: any) => f.bucket === "cold");

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Analytics</span>
      </div>

      <h1 className="text-2xl font-bold mb-1">Win/Loss Analytics</h1>
      <p className="text-muted text-sm mb-6">Bid performance by FSC category — based on LamLinks historical data</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-muted">Total Bids</span>
          </div>
          <div className="text-2xl font-bold">{totalBids.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-700">Awards Won</span>
          </div>
          <div className="text-2xl font-bold text-green-700">{totalAwards.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-accent" />
            <span className="text-xs text-accent">Win Rate</span>
          </div>
          <div className="text-2xl font-bold text-accent">{overallWinRate}%</div>
        </div>
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-muted" />
            <span className="text-xs text-muted">Award Value</span>
          </div>
          <div className="text-2xl font-bold">${dlaSpend > 0 ? `${(dlaSpend / 1000).toFixed(0)}K` : "—"}</div>
        </div>
      </div>

      {/* FSC Performance Table */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="px-4 py-3 border-b border-card-border">
          <h2 className="text-sm font-bold">Performance by FSC Category</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-left text-muted bg-gray-50">
                <th className="px-3 py-2 font-medium">FSC</th>
                <th className="px-3 py-2 font-medium">Heat</th>
                <th className="px-3 py-2 text-right font-medium">Total Bids</th>
                <th className="px-3 py-2 text-right font-medium">Recent (6mo)</th>
                <th className="px-3 py-2 text-right font-medium">Awards</th>
                <th className="px-3 py-2 text-right font-medium">Win Rate</th>
                <th className="px-3 py-2 font-medium">Performance</th>
              </tr>
            </thead>
            <tbody>
              {fscs.filter((f: any) => f.total_bids > 0).map((f: any) => (
                <tr key={f.fsc_code} className="border-b border-card-border/50 hover:bg-gray-50">
                  <td className="px-3 py-1.5">
                    <Link href={`/solicitations?filter=all&search=${f.fsc_code}`} className="font-mono text-accent hover:underline">{f.fsc_code}</Link>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      f.bucket === "hot" ? "bg-red-100 text-red-700" :
                      f.bucket === "warm" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{f.bucket}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{f.total_bids?.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{f.bids_last_6_months?.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-green-700">{f.awards}</td>
                  <td className="px-3 py-1.5 text-right">
                    <span className={`font-bold ${
                      f.winRate >= 20 ? "text-green-600" :
                      f.winRate >= 5 ? "text-yellow-600" :
                      "text-red-500"
                    }`}>{f.winRate}%</span>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${
                        f.winRate >= 20 ? "bg-green-500" :
                        f.winRate >= 5 ? "bg-yellow-500" :
                        "bg-red-400"
                      }`} style={{ width: `${Math.min(f.winRate * 2, 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t border-card-border text-xs text-muted">
          {fscs.filter((f: any) => f.total_bids > 0).length} active FSC categories
        </div>
      </div>

      {/* Hot/Warm/Cold Summary */}
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-bold text-red-700 mb-2">Hot ({hot.length})</h3>
          <div className="space-y-1">
            {hot.slice(0, 8).map((f: any) => (
              <div key={f.fsc_code} className="flex justify-between text-xs">
                <span className="font-mono">{f.fsc_code}</span>
                <span>{f.total_bids?.toLocaleString()} bids · {f.winRate}% win</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border-2 border-yellow-200 bg-yellow-50 p-4">
          <h3 className="text-sm font-bold text-yellow-700 mb-2">Warm ({warm.length})</h3>
          <div className="space-y-1">
            {warm.slice(0, 8).map((f: any) => (
              <div key={f.fsc_code} className="flex justify-between text-xs">
                <span className="font-mono">{f.fsc_code}</span>
                <span>{f.total_bids?.toLocaleString()} bids · {f.winRate}% win</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-bold text-gray-600 mb-2">Cold ({cold.length})</h3>
          <div className="space-y-1">
            {cold.slice(0, 8).map((f: any) => (
              <div key={f.fsc_code} className="flex justify-between text-xs">
                <span className="font-mono">{f.fsc_code}</span>
                <span>{f.total_bids?.toLocaleString()} bids · {f.winRate}% win</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
