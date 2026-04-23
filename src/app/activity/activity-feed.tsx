"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/dates";
import {
  ChevronLeft,
  Gavel,
  FileText,
  Truck,
  Radio,
  Database,
} from "lucide-react";

interface BidDecision {
  id: number;
  solicitation_number: string;
  nsn: string;
  status: string;
  updated_at: string;
  comment: string | null;
  override_price: number | null;
}

interface InvoiceEvent {
  id: number;
  kad_id: number;
  invoice_number: string | null;
  from_state: string | null;
  to_state: string;
  event_type: string;
  upname: string | null;
  total: number | null;
  detected_at: string;
}

interface EdiTransmission {
  id: number;
  idnkbr: number;
  parent_table: string;
  parent_id: number;
  edi_type: string;
  lifecycle: string;
  status: string;
  transmitted_at: string;
  added_by: string | null;
}

interface Shipment {
  id: number;
  idnkaj: number | null;
  ship_number: string;
  contract_number: string;
  nsn: string | null;
  description: string | null;
  quantity: number;
  sell_value: number;
  ship_status: string;
  ship_date: string;
}

interface SyncRow {
  id: number;
  action: string;
  details: any;
  created_at: string;
}

type Props = {
  bids: BidDecision[];
  invoices: InvoiceEvent[];
  edi: EdiTransmission[];
  shipments: Shipment[];
  syncs: SyncRow[];
};

type Event = {
  at: string;
  source: "bid" | "invoice" | "edi" | "shipment" | "sync";
  kind: string;
  icon: React.ElementType;
  color: string;
  primary: string;
  secondary: string;
  amount?: number | null;
  nsn?: string | null;
  actor?: string | null;
  href?: string;
};

const SOURCE_LABEL: Record<string, string> = {
  bid: "Bid",
  invoice: "Invoice",
  edi: "EDI",
  shipment: "Shipment",
  sync: "Sync",
};

function fmt$(n: number | null | undefined) {
  if (n == null) return "";
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function ActivityFeed({ bids, invoices, edi, shipments, syncs }: Props) {
  const [filter, setFilter] = useState<"all" | "bid" | "invoice" | "edi" | "shipment" | "sync">("all");
  const [hour, setHour] = useState<"24" | "72" | "all">("24");

  const events: Event[] = useMemo(() => {
    const list: Event[] = [];

    for (const b of bids) {
      const color =
        b.status === "quoted"
          ? "text-blue-700 bg-blue-50 border-blue-200"
          : b.status === "submitted"
          ? "text-purple-700 bg-purple-50 border-purple-200"
          : b.status === "skipped"
          ? "text-gray-600 bg-gray-50 border-gray-200"
          : "text-slate-700 bg-slate-50 border-slate-200";
      list.push({
        at: b.updated_at,
        source: "bid",
        kind: b.status,
        icon: Gavel,
        color,
        primary: `${b.solicitation_number} — ${b.status.toUpperCase()}`,
        secondary: b.comment || `NSN ${b.nsn}`,
        amount: b.override_price,
        nsn: b.nsn,
        href: `/solicitations?search=${encodeURIComponent(b.solicitation_number)}`,
      });
    }

    for (const i of invoices) {
      const color =
        i.to_state === "Posted"
          ? "text-green-700 bg-green-50 border-green-200"
          : i.to_state === "Voided"
          ? "text-red-700 bg-red-50 border-red-200"
          : "text-slate-700 bg-slate-50 border-slate-200";
      list.push({
        at: i.detected_at,
        source: "invoice",
        kind: i.event_type,
        icon: FileText,
        color,
        primary: `Invoice ${i.invoice_number || "?"} → ${i.to_state}`,
        secondary: i.from_state ? `was ${i.from_state}` : "newly created",
        amount: i.total,
        actor: i.upname,
        href: `/invoicing/monitor`,
      });
    }

    for (const e of edi) {
      const color =
        e.lifecycle === "problem"
          ? "text-red-700 bg-red-50 border-red-200"
          : e.lifecycle === "acknowledged"
          ? "text-green-700 bg-green-50 border-green-200"
          : "text-blue-700 bg-blue-50 border-blue-200";
      list.push({
        at: e.transmitted_at,
        source: "edi",
        kind: `${e.edi_type}:${e.lifecycle}`,
        icon: Radio,
        color,
        primary: `${e.status.trim()}`,
        secondary: `${e.parent_table}:${e.parent_id}`,
        actor: e.added_by,
        href: `/ops/lamlinks/transmissions`,
      });
    }

    for (const s of shipments) {
      list.push({
        at: s.ship_date,
        source: "shipment",
        kind: s.ship_status,
        icon: Truck,
        color: "text-indigo-700 bg-indigo-50 border-indigo-200",
        primary: `Ship ${s.ship_number} — ${s.ship_status}`,
        secondary: `${s.contract_number}${s.description ? " — " + s.description : ""}`,
        amount: s.sell_value,
        nsn: s.nsn,
        href: `/shipping`,
      });
    }

    for (const s of syncs) {
      const d = s.details || {};
      const parts: string[] = [];
      if (d.rows_pulled != null) parts.push(`${d.rows_pulled} pulled`);
      if (d.rows_written != null) parts.push(`${d.rows_written} written`);
      if (d.appeared != null) parts.push(`${d.appeared} new`);
      if (d.changed != null) parts.push(`${d.changed} changed`);
      if (d.problem_count != null && d.problem_count > 0) parts.push(`${d.problem_count} problems`);
      list.push({
        at: s.created_at,
        source: "sync",
        kind: s.action,
        icon: Database,
        color: "text-amber-700 bg-amber-50 border-amber-200",
        primary: s.action.replace(/_/g, " "),
        secondary: parts.join(", ") || "completed",
      });
    }

    list.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    return list;
  }, [bids, invoices, edi, shipments, syncs]);

  const visible = useMemo(() => {
    let out = events;
    if (filter !== "all") out = out.filter((e) => e.source === filter);
    if (hour !== "all") {
      const cutoff = Date.now() - Number(hour) * 3600_000;
      out = out.filter((e) => new Date(e.at).getTime() >= cutoff);
    }
    return out.slice(0, 500);
  }, [events, filter, hour]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { bid: 0, invoice: 0, edi: 0, shipment: 0, sync: 0 };
    for (const e of events) c[e.source] = (c[e.source] || 0) + 1;
    return c;
  }, [events]);

  return (
    <>
      <div className="flex items-center gap-2 mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-accent flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Activity</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Activity Feed</h1>
        <p className="text-muted text-sm mt-1">
          Everything that happened across DIBS + LamLinks, cradle to grave — bids, invoices, WAWF transmissions, shipments, syncs. Last 3 days.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-muted">Source:</span>
        {(["all", "bid", "invoice", "edi", "shipment", "sync"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
              filter === f ? "ring-2 ring-accent border-accent" : "border-card-border"
            }`}
          >
            {f === "all" ? `All (${events.length})` : `${SOURCE_LABEL[f]} (${counts[f] ?? 0})`}
          </button>
        ))}
        <span className="text-xs text-muted ml-4">Window:</span>
        {(["24", "72", "all"] as const).map((h) => (
          <button
            key={h}
            onClick={() => setHour(h)}
            className={`rounded-lg border px-2.5 py-1 text-xs ${
              hour === h ? "ring-2 ring-accent border-accent" : "border-card-border"
            }`}
          >
            {h === "24" ? "24h" : h === "72" ? "3d" : "All"}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-card-border bg-card-bg">
        <div className="divide-y divide-card-border">
          {visible.length === 0 ? (
            <div className="p-8 text-center text-muted text-sm">No activity in this window.</div>
          ) : (
            visible.map((e, i) => {
              const Icon = e.icon;
              const when = new Date(e.at);
              return (
                <div key={`${e.source}-${i}-${e.at}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50">
                  <div className={`shrink-0 rounded-full border p-1.5 ${e.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium truncate">{e.primary}</span>
                      {e.nsn && <span className="font-mono text-[10px] text-accent">{e.nsn}</span>}
                      {e.amount != null && e.amount > 0 && (
                        <span className="font-mono text-[10px] text-green-700">{fmt$(e.amount)}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted flex items-center gap-2 mt-0.5">
                      <span className="uppercase tracking-wide font-semibold">{SOURCE_LABEL[e.source]}</span>
                      {e.actor && <span>· {e.actor}</span>}
                      {e.secondary && <span className="truncate">· {e.secondary}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-[10px] text-muted font-mono whitespace-nowrap">
                    {formatDateTime(when.toISOString())}
                  </div>
                  {e.href && (
                    <Link href={e.href} className="shrink-0 text-[10px] text-muted hover:text-accent">
                      →
                    </Link>
                  )}
                </div>
              );
            })
          )}
        </div>
        {visible.length > 0 && (
          <div className="px-4 py-2 border-t border-card-border text-xs text-muted">
            Showing {visible.length} of {events.length} events
          </div>
        )}
      </div>
    </>
  );
}
