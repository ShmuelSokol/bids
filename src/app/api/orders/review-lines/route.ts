import { NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * GET /api/orders/review-lines
 *
 * Returns PO lines on DRAFT POs that need operator attention:
 *   - UoM issue: cost_source contains "COST UNVERIFIED"
 *   - Margin suspicious: margin_pct < 10 OR margin_pct > 50 OR margin_pct is null
 *   - Missing cost / missing sell price
 *
 * Includes:
 *   - po_number + supplier info
 *   - the full list of vendor options for the NSN (for the switch modal)
 *   - any existing override on file for (nsn, vendor)
 *
 * Excludes lines on POs that have progressed past `drafted` (already in AX).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createServiceClient();

  // Pull draft POs + their lines. `dmf_state` null or 'drafted' counts as draft.
  const { data: drafts, error: dErr } = await supabase
    .from("purchase_orders")
    .select("id, po_number, supplier, dmf_state, ax_po_number")
    .or("dmf_state.is.null,dmf_state.eq.drafted")
    .is("ax_po_number", null);
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  const draftIds = (drafts || []).map((p) => p.id);
  if (draftIds.length === 0) return NextResponse.json({ lines: [], total: 0 });

  const poById = new Map(drafts!.map((p) => [p.id, p]));

  // Paginate po_lines — avoid Supabase's 1K default.
  // NOTE: ax_item_number is NOT a column on po_lines; it's enriched from
  // nsn_catalog at page-load time. For the review endpoint we do that same
  // enrichment ourselves below.
  const lines: any[] = [];
  const CHUNK = 1000;
  for (let i = 0; i < draftIds.length; i += CHUNK) {
    const batch = draftIds.slice(i, i + CHUNK);
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("po_lines")
        .select("id, po_id, nsn, description, quantity, unit_cost, unit_of_measure, sell_price, margin_pct, supplier, cost_source, vendor_item_number, contract_number")
        .in("po_id", batch)
        .range(from, from + 999);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      lines.push(...(data || []));
      if (!data || data.length < 1000) break;
      from += 1000;
    }
  }

  // Enrich each line with ax_item_number from nsn_catalog (same shape as
  // /orders/page.tsx — source is stored as "AX:<ItemNumber>").
  const lineNsns = [...new Set(lines.map((l) => l.nsn).filter(Boolean))];
  const axItemByNsn = new Map<string, string>();
  for (let i = 0; i < lineNsns.length; i += 500) {
    const chunk = lineNsns.slice(i, i + 500);
    const { data } = await supabase.from("nsn_catalog").select("nsn, source").in("nsn", chunk);
    for (const c of data || []) {
      const m = /^AX:(.+)$/.exec((c.source || "").trim());
      if (m) axItemByNsn.set(c.nsn, m[1].trim());
    }
  }
  for (const l of lines) l.ax_item_number = axItemByNsn.get(l.nsn) || null;

  // Flag + reason
  type Flagged = typeof lines[number] & { reasons: string[]; po_number: string };
  const flagged: Flagged[] = [];
  for (const l of lines) {
    const po = poById.get(l.po_id);
    if (!po) continue;
    const reasons: string[] = [];
    const cs = (l.cost_source || "").toUpperCase();
    if (cs.includes("COST UNVERIFIED")) reasons.push("UoM mismatch with vendor");
    const m = l.margin_pct;
    if (m === null || m === undefined) reasons.push("Margin unknown");
    else if (m < 0) reasons.push(`Negative margin (${Number(m).toFixed(1)}%)`);
    else if (m < 10) reasons.push(`Low margin (${Number(m).toFixed(1)}%)`);
    else if (m > 50) reasons.push(`Unusually high margin (${Number(m).toFixed(1)}%) — cost likely wrong`);
    if (!l.unit_cost || Number(l.unit_cost) <= 0) reasons.push("Missing unit cost");
    if (!l.sell_price || Number(l.sell_price) <= 0) reasons.push("Missing sell price");
    if (reasons.length > 0) {
      flagged.push({ ...l, reasons, po_number: po.po_number });
    }
  }

  // Pull overrides for these (nsn, vendor) combos so the UI can pre-fill.
  const overrides = new Map<string, any>();
  if (flagged.length > 0) {
    const uniqNsns = [...new Set(flagged.map((f) => f.nsn).filter(Boolean))];
    const { data: ov } = await supabase
      .from("nsn_review_overrides")
      .select("nsn, vendor, unit_of_measure, unit_cost, notes, reviewed_by, reviewed_at")
      .in("nsn", uniqNsns);
    for (const o of ov || []) {
      overrides.set(`${o.nsn}__${(o.vendor || "").toUpperCase()}`, o);
    }
  }

  // Sort: UoM issues first (easiest to resolve), then negative margins, then others.
  flagged.sort((a, b) => {
    const sev = (r: string[]) =>
      r.some((x) => x.startsWith("Negative")) ? 0 :
      r.some((x) => x.startsWith("UoM")) ? 1 :
      r.some((x) => x.startsWith("Missing")) ? 2 :
      r.some((x) => x.startsWith("Low")) ? 3 : 4;
    const d = sev(a.reasons) - sev(b.reasons);
    if (d !== 0) return d;
    return (a.po_number || "").localeCompare(b.po_number || "");
  });

  const withOverrides = flagged.map((f) => ({
    ...f,
    existing_override: overrides.get(`${f.nsn}__${(f.supplier || "").toUpperCase()}`) || null,
  }));

  return NextResponse.json({ lines: withOverrides, total: withOverrides.length });
}
