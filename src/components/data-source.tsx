/**
 * DataSource — small, unobtrusive source-of-truth badge.
 *
 * Per Yosef (2026-04-15 meeting): every number or string shown in DIBS
 * should tell the user where the data came from. This component is
 * designed to wrap any display and show a small circled "S" (source)
 * indicator that reveals the source on hover.
 *
 *   <DataSource source="AX" tooltip="From AX ProductBarcodesV3">
 *     {displayedValue}
 *   </DataSource>
 *
 * Sources we care about:
 *   - AX            — Dynamics 365 (OData read)
 *   - LamLinks      — LamLinks SQL (k34/k08/k10/etc.)
 *   - MDB           — Master DB (masterdb.everreadygroup.com)
 *   - DIBBS         — Scraped from DIBBS website
 *   - PUBLOG        — PUB LOG catalog
 *   - DIBS          — Computed/derived inside DIBS itself
 *   - USASpending   — DLA awards from USASpending.gov
 *
 * The component is intentionally dumb (no prop drilling of data
 * lineage). Caller passes the source name directly.
 */

export type DataSourceName =
  | "AX"
  | "LamLinks"
  | "MDB"
  | "DIBBS"
  | "PUBLOG"
  | "DIBS"
  | "USASpending";

const SOURCE_LABELS: Record<DataSourceName, string> = {
  AX: "Dynamics 365 (AX)",
  LamLinks: "LamLinks SQL",
  MDB: "Master DB",
  DIBBS: "DIBBS scrape",
  PUBLOG: "PUB LOG",
  DIBS: "DIBS (derived)",
  USASpending: "USASpending.gov",
};

const SOURCE_COLORS: Record<DataSourceName, string> = {
  AX: "bg-blue-100 text-blue-700",
  LamLinks: "bg-purple-100 text-purple-700",
  MDB: "bg-amber-100 text-amber-700",
  DIBBS: "bg-slate-100 text-slate-700",
  PUBLOG: "bg-green-100 text-green-700",
  DIBS: "bg-gray-100 text-gray-600",
  USASpending: "bg-rose-100 text-rose-700",
};

export function DataSource({
  source,
  tooltip,
  children,
  inline,
}: {
  source: DataSourceName;
  tooltip?: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  const label = tooltip ?? `Source: ${SOURCE_LABELS[source]}`;
  return (
    <span
      className={inline ? "inline-flex items-center gap-1" : "inline-block"}
      title={label}
    >
      <span>{children}</span>
      <span
        className={`text-[8px] font-semibold rounded-sm px-1 py-[1px] leading-none align-middle ${SOURCE_COLORS[source]}`}
        aria-hidden
      >
        {source === "LamLinks" ? "LL" : source === "USASpending" ? "US" : source.slice(0, 3)}
      </span>
    </span>
  );
}
