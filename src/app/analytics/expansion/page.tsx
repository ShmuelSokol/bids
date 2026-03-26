import { createServiceClient } from "@/lib/supabase-server";
import Link from "next/link";
import { Zap, TrendingUp, ChevronLeft } from "lucide-react";

async function getData() {
  const supabase = createServiceClient();

  const { data: expansion } = await supabase
    .from("fsc_expansion")
    .select("*")
    .order("sols_last_6mo", { ascending: false });

  const { data: heatmap } = await supabase
    .from("fsc_heatmap")
    .select("fsc_code, bucket, bids_last_month, bids_last_6_months, total_bids");

  const heatmapMap = new Map<string, any>();
  for (const h of heatmap || []) heatmapMap.set(h.fsc_code, h);

  // Categorize
  const unbid = (expansion || []).filter(
    (e) => e.status === "unbid" && e.sols_last_6mo > 0
  );
  const lowRate = (expansion || []).filter(
    (e) => e.status === "low_rate" && e.sols_last_6mo > 0
  );
  const active = (expansion || []).filter(
    (e) => e.status === "active" && e.bids_last_6mo > 0
  );

  return { unbid, lowRate, active, heatmapMap };
}

export default async function ExpansionPage() {
  const { unbid, lowRate, active } = await getData();

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/analytics" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Analytics
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Category Expansion</span>
      </div>

      <h1 className="text-2xl font-bold mb-1">Category Expansion</h1>
      <p className="text-muted text-sm mb-6">
        {unbid.length} FSCs with active solicitations that Abe isn&apos;t bidding on.
        Real data from LamLinks + DIBBS.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border-2 border-green-300 bg-green-50 p-5">
          <div className="text-sm text-green-700 font-medium">Unbid FSCs</div>
          <div className="text-3xl font-bold text-green-700">{unbid.length}</div>
          <div className="text-xs text-green-600">
            {unbid.reduce((s, e) => s + (e.sols_last_6mo || 0), 0).toLocaleString()} solicitations missed
          </div>
        </div>
        <div className="rounded-xl border border-orange-300 bg-orange-50 p-5">
          <div className="text-sm text-orange-700 font-medium">Low Bid Rate</div>
          <div className="text-3xl font-bold text-orange-700">{lowRate.length}</div>
          <div className="text-xs text-orange-600">Bidding &lt;10% of solicitations</div>
        </div>
        <div className="rounded-xl border border-card-border bg-card-bg p-5">
          <div className="text-sm text-muted">Active & Healthy</div>
          <div className="text-3xl font-bold">{active.length}</div>
          <div className="text-xs text-muted">Bidding regularly</div>
        </div>
      </div>

      {/* Unbid FSCs — Top Opportunities */}
      <div className="rounded-xl border-2 border-green-200 bg-card-bg shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-green-200 bg-green-50/50 flex items-center gap-2">
          <Zap className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-semibold text-green-800">
            Unbid FSCs — Solicitations Flowing But No Bids
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-4 py-3 font-medium">FSC</th>
                <th className="px-4 py-3 font-medium text-right">Sols (6mo)</th>
                <th className="px-4 py-3 font-medium text-right">Historical Bids</th>
                <th className="px-4 py-3 font-medium text-right">All-time Sols</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {unbid.slice(0, 30).map((e) => (
                <tr key={e.fsc_code} className="border-b border-card-border hover:bg-green-50/30">
                  <td className="px-4 py-2 font-mono font-bold">{e.fsc_code}</td>
                  <td className="px-4 py-2 text-right font-mono font-medium text-green-700">
                    {e.sols_last_6mo?.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-muted">
                    {e.bids_placed?.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-muted">
                    {e.solicitations_received?.toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      e.bids_placed > 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                    }`}>
                      {e.bids_placed > 0 ? "DROPPED" : "NEVER BID"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/solicitations?filter=all&search=${e.fsc_code}`}
                      className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-medium"
                    >
                      View Solicitations →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Bid Rate */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="px-6 py-4 border-b border-card-border flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-semibold">Low Bid Rate — Under 10%</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-4 py-3 font-medium">FSC</th>
                <th className="px-4 py-3 font-medium text-right">Sols (6mo)</th>
                <th className="px-4 py-3 font-medium text-right">Bids (6mo)</th>
                <th className="px-4 py-3 font-medium text-right">Bid Rate</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {lowRate.slice(0, 20).map((e) => (
                <tr key={e.fsc_code} className="border-b border-card-border hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono font-bold">{e.fsc_code}</td>
                  <td className="px-4 py-2 text-right font-mono">{e.sols_last_6mo?.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono">{e.bids_last_6mo}</td>
                  <td className="px-4 py-2 text-right font-mono text-red-600">
                    {e.bid_rate_pct?.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/solicitations?filter=all&search=${e.fsc_code}`}
                      className="text-xs px-2 py-1 rounded bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 font-medium"
                    >
                      View →
                    </Link>
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
