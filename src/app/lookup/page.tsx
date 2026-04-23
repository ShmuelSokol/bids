"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ChevronLeft } from "lucide-react";
import { formatDate, formatDateShort, formatDateTime } from "@/lib/dates";

/**
 * /lookup?nsn=XXXX-XX-XXX-XXXX — one-NSN probe page.
 *
 * Per Abe 2026-04-16: 'give me one item number... I'll give you your
 * checks. Live quantity directly bypassing updates.' This page queries
 * every source DIBS touches — AX live, all Supabase tables — with no
 * caching, so Abe can confirm if a weird DIBS display is a DIBS bug
 * or bad source data.
 */

export default function LookupPage() {
  const params = useSearchParams();
  const router = useRouter();
  const initialNsn = params.get("nsn") || "";
  const [input, setInput] = useState(initialNsn);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(nsn: string) {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/lookup?nsn=${encodeURIComponent(nsn)}`);
      const d = await r.json();
      if (!r.ok) setError(d.error || `HTTP ${r.status}`);
      else setData(d);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialNsn) run(initialNsn);
  }, [initialNsn]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = input.trim();
    if (!cleaned) return;
    router.push(`/lookup?nsn=${encodeURIComponent(cleaned)}`);
    run(cleaned);
  }

  function fmt$(n: number | null | undefined) {
    if (n === null || n === undefined) return "—";
    return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <Link href="/" className="text-xs text-muted hover:text-accent inline-flex items-center gap-1 mb-2">
          <ChevronLeft className="h-3 w-3" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold">NSN Probe</h1>
        <p className="text-muted text-sm mt-1">
          One NSN, every source, no caching. Use when DIBS shows weird data and you want to confirm where the error lives.
        </p>
      </div>

      <form onSubmit={submit} className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-muted mb-1">NSN (with or without dashes)</label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="6515-01-153-4716"
            className="w-full rounded-lg border border-card-border px-3 py-2 text-sm font-mono"
            autoFocus
          />
        </div>
        <button type="submit" disabled={loading || !input.trim()} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1">
          <Search className="h-4 w-4" /> {loading ? "Querying..." : "Probe"}
        </button>
      </form>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>}

      {data && (
        <div className="space-y-4">
          {/* AX */}
          <Section title="AX — ProductBarcodesV3 (live OData)" note="The source of truth for item creation + UoM. If this is null, the NSN isn't linked to any AX item yet; needs NPI.">
            {data.ax.error ? (
              <div className="text-xs text-red-700">Error: {data.ax.error}</div>
            ) : data.ax.item ? (
              <KV o={data.ax.item} />
            ) : (
              <p className="text-sm text-muted italic">No AX item linked to this NSN. NPI required.</p>
            )}
          </Section>

          {/* nsn_costs */}
          <Section title="nsn_costs — waterfall winner" note="Rebuilt nightly from AX PriceAgreements + POs. This is what the pricing engine uses as 'cost'.">
            {data.nsn_cost ? <KV o={data.nsn_cost} /> : <p className="text-sm text-muted italic">No cost row — suggested price will fall back to last-award logic.</p>}
          </Section>

          {/* vendor prices */}
          <Section title={`nsn_vendor_prices — all vendors (${data.vendor_prices.length})`} note="Every vendor DIBS knows about for this NSN, sorted cheapest-first.">
            {data.vendor_prices.length === 0 ? (
              <p className="text-sm text-muted italic">No vendor pricing.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted border-b border-card-border"><tr><th className="px-2 py-1 text-left">Vendor</th><th className="px-2 py-1 text-right">Price</th><th className="px-2 py-1 text-left">UoM</th><th className="px-2 py-1 text-left">Source</th><th className="px-2 py-1 text-left">Updated</th></tr></thead>
                <tbody>
                  {data.vendor_prices.map((v: any, i: number) => (
                    <tr key={i} className="border-t border-card-border/40">
                      <td className="px-2 py-1 font-mono">{v.vendor}</td>
                      <td className="px-2 py-1 text-right font-mono">{fmt$(v.price)}</td>
                      <td className="px-2 py-1">{v.unit_of_measure || "?"}</td>
                      <td className="px-2 py-1 text-muted">{v.price_source}</td>
                      <td className="px-2 py-1 text-muted text-[10px]">{formatDateShort(v.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Awards */}
          <Section title={`Awards — last 50 (${data.awards.length})`} note="k81 + kc4 imports from LamLinks. cage=0AG09 is us; other CAGEs are competitors.">
            {data.awards.length === 0 ? (
              <p className="text-sm text-muted italic">No awards on record.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted border-b border-card-border"><tr><th className="px-2 py-1 text-left">Date</th><th className="px-2 py-1 text-left">Contract</th><th className="px-2 py-1 text-left">Winner</th><th className="px-2 py-1 text-right">Price</th><th className="px-2 py-1 text-right">Qty</th></tr></thead>
                <tbody>
                  {data.awards.map((a: any) => (
                    <tr key={a.id} className="border-t border-card-border/40">
                      <td className="px-2 py-1 text-muted">{formatDateShort(a.award_date)}</td>
                      <td className="px-2 py-1 font-mono text-[10px]">{a.contract_number}</td>
                      <td className={`px-2 py-1 font-mono text-[10px] ${a.cage?.trim() === "0AG09" ? "text-green-700 font-bold" : "text-orange-700"}`}>{a.cage?.trim() === "0AG09" ? "0AG09 (us)" : a.cage?.trim()}</td>
                      <td className="px-2 py-1 text-right font-mono">{fmt$(a.unit_price)}</td>
                      <td className="px-2 py-1 text-right">{a.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Bids */}
          <Section title={`Our bids — historical (${data.historical_bids.length}) + live (${data.live_bids.length})`} note="abe_bids = historical 10K; abe_bids_live = last 30 days synced from LamLinks k34.">
            {data.historical_bids.length === 0 && data.live_bids.length === 0 ? (
              <p className="text-sm text-muted italic">We've never bid on this NSN.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted border-b border-card-border"><tr><th className="px-2 py-1 text-left">When</th><th className="px-2 py-1 text-left">Source</th><th className="px-2 py-1 text-left">Sol #</th><th className="px-2 py-1 text-right">Price</th><th className="px-2 py-1 text-right">Qty</th><th className="px-2 py-1 text-right">Lead</th></tr></thead>
                <tbody>
                  {[
                    ...data.live_bids.map((b: any) => ({ key: `live-${b.bid_id}`, date: b.bid_time, src: "live", sol: b.solicitation_number, price: b.bid_price, qty: b.bid_qty, lead: b.lead_days })),
                    ...data.historical_bids.map((b: any) => ({ key: `hist-${b.id}`, date: b.bid_date, src: "hist", sol: b.solicitation_number, price: b.bid_price, qty: b.bid_qty, lead: b.lead_time_days })),
                  ].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 50).map((b: any) => (
                    <tr key={b.key} className="border-t border-card-border/40">
                      <td className="px-2 py-1 text-muted">{formatDateTime(b.date)}</td>
                      <td className="px-2 py-1 text-[10px]"><span className={`px-1 rounded ${b.src === "live" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{b.src}</span></td>
                      <td className="px-2 py-1 font-mono text-[10px]">{b.sol?.trim() || "—"}</td>
                      <td className="px-2 py-1 text-right font-mono">{fmt$(b.price)}</td>
                      <td className="px-2 py-1 text-right">{b.qty || "—"}</td>
                      <td className="px-2 py-1 text-right text-muted">{b.lead || "—"}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Solicitations */}
          <Section title={`Solicitations in DIBS — all statuses (${data.solicitations.length})`} note="Every dibbs_solicitations row that references this NSN, open or closed.">
            {data.solicitations.length === 0 ? (
              <p className="text-sm text-muted italic">No solicitations on record.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted border-b border-card-border"><tr><th className="px-2 py-1 text-left">Sol #</th><th className="px-2 py-1 text-left">Due</th><th className="px-2 py-1 text-right">Qty</th><th className="px-2 py-1 text-right">Sugg</th><th className="px-2 py-1 text-right">Cost</th><th className="px-2 py-1 text-left">Source</th><th className="px-2 py-1 text-left">Flags</th></tr></thead>
                <tbody>
                  {data.solicitations.map((s: any, i: number) => (
                    <tr key={i} className="border-t border-card-border/40">
                      <td className="px-2 py-1 font-mono text-[10px]">{s.solicitation_number}</td>
                      <td className="px-2 py-1 text-muted">{s.return_by_date}</td>
                      <td className="px-2 py-1 text-right">{s.quantity}</td>
                      <td className="px-2 py-1 text-right font-mono">{fmt$(s.suggested_price)}</td>
                      <td className="px-2 py-1 text-right font-mono">{fmt$(s.our_cost)}</td>
                      <td className="px-2 py-1 text-muted text-[10px]">{s.cost_source || s.data_source || "?"}</td>
                      <td className="px-2 py-1 text-[10px]">
                        {s.is_sourceable && <span className="px-1 rounded bg-green-100 text-green-700 mr-1">sourceable</span>}
                        {s.already_bid && <span className="px-1 rounded bg-purple-100 text-purple-700">bid</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* PUB LOG */}
          <Section title="PUB LOG — match + spec" note="P/N cross-reference + canonical item metadata.">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <h4 className="text-xs font-semibold text-muted mb-1">Spec</h4>
                {data.publog_spec ? <KV o={data.publog_spec} /> : <p className="text-xs text-muted italic">No PUB LOG entry.</p>}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted mb-1">Match history ({data.publog_match.length})</h4>
                {data.publog_match.length === 0 ? <p className="text-xs text-muted italic">No match events.</p> : <KV o={data.publog_match[0]} />}
              </div>
            </div>
          </Section>

          {/* LamLinks PID + Packaging Requirements */}
          <Section
            title="LamLinks PID — Procurement Item Description"
            note={
              data.ll_pid?.last_award_date
                ? `Pulled from kah_tab; attached to our most recent awarded k81 line (${formatDateShort(data.ll_pid.last_award_date)}). This is the canonical DLA spec for the item.`
                : "From LL kah_tab. Only exists for NSNs ERG has previously won."
            }
          >
            {!data.ll_pid ? (
              <p className="text-sm text-muted italic">
                No PID cached — ERG hasn&apos;t been awarded this NSN in the last 3 years. DLA only attaches PID text after award.
              </p>
            ) : (
              <div className="space-y-3">
                {data.ll_pid.pid_text && (
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase text-muted mb-1">PID ({data.ll_pid.pid_bytes} bytes)</h4>
                    <pre className="whitespace-pre-wrap font-mono text-[10px] bg-gray-50 rounded p-2 border border-card-border max-h-64 overflow-auto">
                      {data.ll_pid.pid_text}
                    </pre>
                  </div>
                )}
                {data.ll_pid.packaging_text && (
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase text-muted mb-1">Packaging Requirements</h4>
                    <pre className="whitespace-pre-wrap font-mono text-[10px] bg-gray-50 rounded p-2 border border-card-border max-h-48 overflow-auto">
                      {data.ll_pid.packaging_text}
                    </pre>
                  </div>
                )}
                {data.ll_pid.packaging_notes && (
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase text-muted mb-1">Packaging Notes</h4>
                    <pre className="whitespace-pre-wrap font-mono text-[10px] bg-gray-50 rounded p-2 border border-card-border max-h-40 overflow-auto">
                      {data.ll_pid.packaging_notes}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Our shipment history + EDI */}
          <Section
            title={`Our shipments — last 30 (${data.ll_shipments.length})`}
            note="From ll_shipments (LamLinks kaj_tab). WAWF column shows most recent 810/856 transmission status from kbr_tab."
          >
            {data.ll_shipments.length === 0 ? (
              <p className="text-sm text-muted italic">We&apos;ve never shipped this NSN (or it was shipped before our 90-day sync window).</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted border-b border-card-border">
                  <tr>
                    <th className="px-2 py-1 text-left">Ship #</th>
                    <th className="px-2 py-1 text-left">Contract</th>
                    <th className="px-2 py-1 text-left">CLIN</th>
                    <th className="px-2 py-1 text-right">Qty</th>
                    <th className="px-2 py-1 text-right">Value</th>
                    <th className="px-2 py-1 text-left">Status</th>
                    <th className="px-2 py-1 text-left">Date</th>
                    <th className="px-2 py-1 text-left">WAWF</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ll_shipments.map((s: any) => {
                    const edi = (data.ll_edi_by_shipment?.[s.idnkaj] || []) as any[];
                    const w810 = edi.find((e: any) => e.edi_type === "810");
                    const w856 = edi.find((e: any) => e.edi_type === "856");
                    return (
                      <tr key={s.idnkaj ?? s.ship_number} className="border-t border-card-border/40">
                        <td className="px-2 py-1 font-mono">{s.ship_number}</td>
                        <td className="px-2 py-1 font-mono text-[10px]">{s.contract_number}</td>
                        <td className="px-2 py-1">{s.clin}</td>
                        <td className="px-2 py-1 text-right">{s.quantity}</td>
                        <td className="px-2 py-1 text-right font-mono text-green-600">{fmt$(s.sell_value)}</td>
                        <td className="px-2 py-1 text-[10px]">{s.ship_status}</td>
                        <td className="px-2 py-1 text-muted text-[10px]">{formatDateShort(s.ship_date)}</td>
                        <td className="px-2 py-1 text-[10px]">
                          {w856 && <span className="mr-1 text-blue-700">856:{formatDateShort(w856.transmitted_at)}</span>}
                          {w810 && <span className="text-purple-700">810:{formatDateShort(w810.transmitted_at)}</span>}
                          {!w856 && !w810 && <span className="text-muted">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg shadow-sm">
      <div className="px-4 py-2 border-b border-card-border">
        <h2 className="text-sm font-semibold">{title}</h2>
        {note && <p className="text-[10px] text-muted mt-0.5">{note}</p>}
      </div>
      <div className="p-3 overflow-x-auto">{children}</div>
    </div>
  );
}

function KV({ o }: { o: any }) {
  const entries = Object.entries(o || {}).filter(([_, v]) => v !== null && v !== undefined && v !== "" && v !== 0);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs font-mono">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="truncate">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
