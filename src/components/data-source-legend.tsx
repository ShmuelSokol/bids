"use client";

const sources = [
  { key: "LL", color: "bg-cyan-50 text-cyan-700 border-cyan-200", label: "LamLinks", desc: "Imported from LamLinks SQL Server (k10/k11/k08/k81/kc4/k34 tables). Synced daily at 5:30 AM + 1 PM." },
  { key: "AX", color: "bg-green-50 text-green-700 border-green-200", label: "AX / D365", desc: "From Dynamics 365 AX via OData API. Cached in Supabase, refreshed nightly at 4 AM." },
  { key: "MDB", color: "bg-purple-50 text-purple-700 border-purple-200", label: "Master DB", desc: "From masterdb.everreadygroup.com API. Used as secondary NSN matching source." },
  { key: "DIBS", color: "bg-blue-50 text-blue-700 border-blue-200", label: "DIBS Computed", desc: "Calculated by DIBS from the source data (margins, scores, suggested prices, rankings)." },
  { key: "PUB", color: "bg-amber-50 text-amber-700 border-amber-200", label: "PUB LOG", desc: "Federal Logistics data — item specs, nomenclature, unit of issue." },
];

export function DataSourceLegend({ show }: { show?: string[] }) {
  const filtered = show ? sources.filter(s => show.includes(s.key)) : sources;
  return (
    <div className="rounded-lg border border-card-border bg-card-bg px-4 py-2 mb-4">
      <div className="text-[10px] font-bold text-muted mb-1">Data Sources — where each field comes from</div>
      <div className="flex flex-wrap gap-3">
        {filtered.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${s.color}`}>{s.key}</span>
            <span className="text-[10px] text-muted">{s.label} — {s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FieldSource({ source, children }: { source: "LL" | "AX" | "MDB" | "DIBS" | "PUB"; children: React.ReactNode }) {
  const s = sources.find(x => x.key === source);
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <span className={`text-[7px] px-0.5 rounded ${s?.color || "bg-gray-100 text-gray-500"}`}>{source}</span>
    </span>
  );
}
