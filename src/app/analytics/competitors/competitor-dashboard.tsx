"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Trophy, TrendingDown } from "lucide-react";
import { formatDateShort } from "@/lib/dates";

interface Award {
  id: number;
  contract_number: string;
  fsc: string | null;
  niin: string | null;
  cage: string;
  unit_price: number;
  quantity: number;
  award_date: string;
  description: string | null;
}

type Props = { awards: Award[] };

type CageStats = {
  cage: string;
  awards: number;
  totalValue: number;
  avgPrice: number;
  mostRecent: string;
  fscs: Map<string, number>;
  isUs: boolean;
  headToHead: number; // NSNs where this CAGE won but we also bid
};

function fmt$(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function CompetitorDashboard({ awards }: Props) {
  const [windowDays, setWindowDays] = useState<30 | 90 | 180 | 365>(90);
  const [sortBy, setSortBy] = useState<"awards" | "value" | "recent">("awards");
  const [fscFilter, setFscFilter] = useState<string>("all");
  const [minAwards, setMinAwards] = useState<number>(2);

  const filteredAwards = useMemo(() => {
    const cutoff = Date.now() - windowDays * 86_400_000;
    return awards.filter((a) => {
      const t = new Date(a.award_date).getTime();
      if (!isFinite(t) || t < cutoff) return false;
      if (fscFilter !== "all" && (a.fsc || "").trim() !== fscFilter) return false;
      return true;
    });
  }, [awards, windowDays, fscFilter]);

  const byCage = useMemo(() => {
    const map = new Map<string, CageStats>();
    for (const a of filteredAwards) {
      const cage = (a.cage || "").trim();
      if (!cage) continue;
      if (!map.has(cage)) {
        map.set(cage, {
          cage,
          awards: 0,
          totalValue: 0,
          avgPrice: 0,
          mostRecent: a.award_date,
          fscs: new Map(),
          isUs: cage === "0AG09",
          headToHead: 0,
        });
      }
      const s = map.get(cage)!;
      s.awards++;
      s.totalValue += (Number(a.unit_price) || 0) * (Number(a.quantity) || 1);
      s.avgPrice = s.totalValue / Math.max(s.awards, 1);
      if (a.award_date > s.mostRecent) s.mostRecent = a.award_date;
      const fsc = (a.fsc || "").trim();
      if (fsc) s.fscs.set(fsc, (s.fscs.get(fsc) || 0) + 1);
    }
    return map;
  }, [filteredAwards]);

  const sorted = useMemo(() => {
    const list = [...byCage.values()].filter((s) => s.awards >= minAwards);
    list.sort((a, b) => {
      if (sortBy === "value") return b.totalValue - a.totalValue;
      if (sortBy === "recent") return b.mostRecent.localeCompare(a.mostRecent);
      return b.awards - a.awards;
    });
    return list;
  }, [byCage, sortBy, minAwards]);

  const fscOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of awards) if (a.fsc) set.add(a.fsc.trim());
    return [...set].sort();
  }, [awards]);

  const usStats = byCage.get("0AG09");
  const competitorAwards = filteredAwards.filter((a) => (a.cage || "").trim() !== "0AG09");
  const competitorValue = competitorAwards.reduce(
    (s, a) => s + (Number(a.unit_price) || 0) * (Number(a.quantity) || 1),
    0
  );

  return (
    <>
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
        <span>/</span>
        <Link href="/analytics" className="hover:text-accent">Analytics</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Competitors</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Competitor Intelligence</h1>
        <p className="text-muted text-sm mt-1">
          Live from LamLinks kc4_tab (DLA awards feed) via the <code className="text-xs bg-gray-100 px-1 rounded">awards</code> table. {awards.length.toLocaleString()} awards in the last 365 days, across {byCage.size} distinct CAGE codes.
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="text-2xl font-bold text-green-700">{usStats?.awards ?? 0}</div>
          <div className="text-xs text-muted flex items-center gap-1"><Trophy className="h-3 w-3" /> Our wins ({windowDays}d)</div>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="text-2xl font-bold text-green-700">{fmt$(usStats?.totalValue ?? 0)}</div>
          <div className="text-xs text-muted">Our revenue ({windowDays}d)</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="text-2xl font-bold text-red-700">{competitorAwards.length.toLocaleString()}</div>
          <div className="text-xs text-muted flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Competitor wins</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="text-2xl font-bold text-red-700">{fmt$(competitorValue)}</div>
          <div className="text-xs text-muted">Competitor revenue</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-muted">Window:</span>
        {([30, 90, 180, 365] as const).map((d) => (
          <button
            key={d}
            onClick={() => setWindowDays(d)}
            className={`rounded-lg border px-2.5 py-1 text-xs ${
              windowDays === d ? "ring-2 ring-accent border-accent" : "border-card-border"
            }`}
          >
            {d}d
          </button>
        ))}
        <span className="text-xs text-muted ml-4">Sort:</span>
        {(["awards", "value", "recent"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`rounded-lg border px-2.5 py-1 text-xs ${
              sortBy === s ? "ring-2 ring-accent border-accent" : "border-card-border"
            }`}
          >
            {s === "awards" ? "Most wins" : s === "value" ? "Highest $" : "Most recent"}
          </button>
        ))}
        <span className="text-xs text-muted ml-4">Min wins:</span>
        <select
          value={minAwards}
          onChange={(e) => setMinAwards(Number(e.target.value))}
          className="rounded border border-card-border px-2 py-1 text-xs"
        >
          <option value={1}>1+</option>
          <option value={2}>2+</option>
          <option value={5}>5+</option>
          <option value={10}>10+</option>
        </select>
        <span className="text-xs text-muted ml-4">FSC:</span>
        <select
          value={fscFilter}
          onChange={(e) => setFscFilter(e.target.value)}
          className="rounded border border-card-border px-2 py-1 text-xs"
        >
          <option value="all">All</option>
          {fscOptions.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Competitor table */}
      <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-left text-muted">
                <th className="px-3 py-2 font-medium">CAGE</th>
                <th className="px-3 py-2 font-medium text-right">Awards</th>
                <th className="px-3 py-2 font-medium text-right">Total $</th>
                <th className="px-3 py-2 font-medium text-right">Avg price</th>
                <th className="px-3 py-2 font-medium">Last seen</th>
                <th className="px-3 py-2 font-medium">Top FSCs</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-muted">
                    No CAGEs match these filters.
                  </td>
                </tr>
              ) : (
                sorted.slice(0, 200).map((s) => {
                  const topFscs = [...s.fscs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
                  return (
                    <tr
                      key={s.cage}
                      className={`border-b border-card-border/50 hover:bg-gray-50 ${s.isUs ? "bg-green-50/50" : ""}`}
                    >
                      <td className="px-3 py-2 font-mono">
                        <span className={s.isUs ? "text-green-700 font-bold" : ""}>{s.cage}</span>
                        {s.isUs && <span className="ml-1 text-[10px] text-green-700">(us)</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{s.awards.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono text-green-700">{fmt$(s.totalValue)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt$(s.avgPrice)}</td>
                      <td className="px-3 py-2 text-muted text-[10px]">{formatDateShort(s.mostRecent)}</td>
                      <td className="px-3 py-2 text-[10px]">
                        {topFscs.map(([fsc, n]) => (
                          <span
                            key={fsc}
                            onClick={() => setFscFilter(fsc)}
                            className="inline-block mr-1 px-1 rounded bg-gray-100 text-gray-700 hover:bg-accent/20 cursor-pointer"
                          >
                            {fsc}·{n}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {sorted.length > 0 && (
          <div className="px-3 py-2 border-t border-card-border text-xs text-muted">
            Showing {Math.min(sorted.length, 200)} of {sorted.length} CAGEs with ≥{minAwards} wins in the {windowDays}d window
          </div>
        )}
      </div>
    </>
  );
}
