import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import { trackEvent, requestContext } from "@/lib/track";
import { computeMarginPct } from "@/lib/margin";

/**
 * POST /api/orders/generate-pos
 *
 * For each selected award, pick a supplier + cost using the pricing-
 * engine waterfall (same source-of-truth the bidder uses so we don't
 * ship profitable bids to loss-making POs). Order of preference:
 *
 *   1. nsn_costs row where cost_source = "AX PO (last 2 months)" —
 *      actual transacted cost with this vendor, freshest.
 *   2. nsn_costs row where cost_source = "AX PO (last 3 months)".
 *   3. nsn_costs row where cost_source = "AX price agreement
 *      (cheapest vendor)" — asking price, only trusted when UoM
 *      matches the award's UoM.
 *   4. nsn_costs row where cost_source = "AX PO (older)".
 *
 * UoM check: the award carries a `unit_of_measure` column (EA, PG,
 * BX, etc.). nsn_costs.unit_of_measure carries the AX-side UoM. If
 * they disagree, we cannot safely multiply cost × qty without a pack-
 * size conversion we don't have, so the award is routed to UNASSIGNED
 * for manual supplier-switch. This is what kept the old "cheapest
 * price_agreement" path producing negative-margin POs.
 *
 * Awards with no nsn_costs hit OR a UoM mismatch land on UNASSIGNED.
 * Abe fixes those via the supplier-switch flow.
 *
 * Race-condition defense: the request body comes from the browser and
 * can be stale. Before creating any PO we re-fetch the awards from the
 * database filtered on `po_generated=false`. Anything already claimed
 * by another session is dropped from this batch and reported back.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { awards } = await req.json();
  if (!Array.isArray(awards) || awards.length === 0) {
    return NextResponse.json({ error: "No awards provided" }, { status: 400 });
  }

  const requestedIds = awards
    .map((a: any) => a.id)
    .filter((x: any): x is number => typeof x === "number");
  if (requestedIds.length === 0) {
    return NextResponse.json(
      { error: "awards[].id is required for race-safe PO generation" },
      { status: 400 }
    );
  }

  // Re-fetch authoritative award rows, filtered to those not yet claimed.
  // This is our safety net against a stale UI: if another user (or an
  // earlier generate-pos call) already wrote po_generated=true, we won't
  // double-create a PO for that award.
  const { data: freshAwards, error: fetchErr } = await supabase
    .from("awards")
    .select("*")
    .in("id", requestedIds)
    .eq("po_generated", false);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const freshById = new Map<number, any>((freshAwards || []).map((a) => [a.id, a]));
  const alreadyClaimed = requestedIds.filter((id) => !freshById.has(id));
  const eligible = requestedIds
    .map((id) => freshById.get(id))
    .filter(Boolean);

  if (eligible.length === 0) {
    return NextResponse.json({
      success: true,
      po_count: 0,
      line_count: 0,
      skipped_already_claimed: alreadyClaimed.length,
      pos: [],
      message: "All selected awards were already in a PO",
    });
  }

  // For each award, pick vendor using this priority:
  //   1. bid_vendor on the award itself (stored at enrichment time —
  //      this is the vendor the bid was BASED ON, frozen at bid time)
  //   2. Fallback: current nsn_costs waterfall winner (for awards that
  //      were imported before we started storing bid_vendor)
  type CostRow = {
    cost: number;
    costPerEach?: number;
    packMult?: number;
    source: string | null;
    vendor: string | null;
    uom: string | null;
    itemNumber: string | null;
  };

  // The awards table stores NSN as split fsc + niin columns (NOT a single
  // `nsn` string). Earlier versions of this file accessed `award.nsn`
  // expecting a computed value and got undefined every time, which made
  // the tier-2 waterfall lookup fail for every award. Fix: derive nsn
  // consistently from fsc+niin, and attach it onto each award object so
  // downstream code (line inserts, routing, etc.) has a single source
  // of truth.
  function nsnOf(a: any): string | null {
    if (!a.fsc || !a.niin) return null;
    return `${a.fsc}-${a.niin}`;
  }
  for (const a of eligible) {
    (a as any).nsn = nsnOf(a);
  }

  // Fallback: load current nsn_costs for awards without bid_vendor
  const nsnsNeedingFallback = [...new Set(
    eligible.filter((a: any) => !a.bid_vendor).map((a: any) => a.nsn).filter(Boolean)
  )];
  const waterfallByNsn = new Map<string, CostRow>();
  if (nsnsNeedingFallback.length > 0) {
    const { data: costs } = await supabase
      .from("nsn_costs")
      .select("nsn, cost, cost_per_each, pack_multiplier, cost_source, vendor, unit_of_measure, item_number")
      .in("nsn", nsnsNeedingFallback)
      .gt("cost", 0);
    for (const c of costs || []) {
      waterfallByNsn.set(c.nsn, {
        cost: c.cost,
        costPerEach: c.cost_per_each ?? c.cost,
        packMult: c.pack_multiplier ?? 1,
        source: c.cost_source,
        vendor: c.vendor,
        uom: c.unit_of_measure,
        itemNumber: c.item_number,
      } as CostRow);
    }
  }

  // Reviewed-once overrides: when Abe has already reviewed an (NSN, vendor)
  // pair in the Review Queue, use those values instead of the waterfall and
  // skip the COST UNVERIFIED flag. Keyed by `${nsn}__${VENDOR_UPPER}`.
  const allNsnsForOverride = [...new Set(eligible.map((a: any) => a.nsn).filter(Boolean))];
  const overrideByKey = new Map<string, { unit_of_measure: string | null; unit_cost: number | null; reviewed_by: string; reviewed_at: string }>();
  if (allNsnsForOverride.length > 0) {
    const { data: overrides } = await supabase
      .from("nsn_review_overrides")
      .select("nsn, vendor, unit_of_measure, unit_cost, reviewed_by, reviewed_at")
      .in("nsn", allNsnsForOverride);
    for (const o of overrides || []) {
      overrideByKey.set(`${o.nsn}__${String(o.vendor || "").trim().toUpperCase()}`, {
        unit_of_measure: o.unit_of_measure,
        unit_cost: o.unit_cost !== null ? Number(o.unit_cost) : null,
        reviewed_by: o.reviewed_by,
        reviewed_at: o.reviewed_at,
      });
    }
  }

  // Normalize null/empty/"null" string into a real null so we can compare UoMs
  // fairly across awards imported from different sources (LamLinks, DIBBS, AX).
  function normUom(v: any): string | null {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s || s.toLowerCase() === "null") return null;
    return s.toUpperCase();
  }
  function sameUom(a: any, b: any): boolean {
    const na = normUom(a), nb = normUom(b);
    return na !== null && nb !== null && na === nb;
  }
  // Is the cost calculation trustworthy for this line? Yes if UoMs match OR
  // if either UoM is missing (can't verify, but can't disprove either).
  // Also yes for the AX-bundle ↔ EA case — we have cost_per_each from the
  // pack split (B25→/25), which IS trustworthy. No otherwise.
  function costTrustworthy(awardUom: any, vendorUom: any): boolean {
    const a = normUom(awardUom), v = normUom(vendorUom);
    if (!a || !v) return true;  // can't verify; default to trust
    if (a === v) return true;
    // AX bundle (B<NN>) vs sol EA — per-each split is reliable
    if (a === "EA" && /^B\d+$/.test(v)) return true;
    return false;
  }
  // Pick the right unit cost for an award given the AX-side cost row.
  // - When award UoM = EA and cost UoM = B<NN>, use the per-each split.
  // - Otherwise pass through the raw AX cost (assumed equivalent unit).
  function effectiveUnitCost(awardUom: any, c: CostRow): number {
    const a = normUom(awardUom);
    const v = normUom(c.uom);
    if (a === "EA" && v && /^B\d+$/.test(v) && (c.packMult || 1) > 1 && c.costPerEach != null) {
      return c.costPerEach;
    }
    return c.cost;
  }

  type Routing = { supplier: string; reason: string; cost: CostRow | null };
  const routingByAward = new Map<number, Routing>();
  const bySupplier = new Map<string, any[]>();

  for (const award of eligible) {
    let routing: Routing;

    // Routing rule (rewritten 2026-04-22 per user feedback): always route by
    // vendor when one exists. UoM mismatch affects cost trustworthiness per
    // line, not routing. One PO per real supplier.
    if (award.bid_vendor) {
      const cost: CostRow = {
        cost: award.bid_cost || 0,
        source: `bid-time vendor (${award.bid_vendor})`,
        vendor: award.bid_vendor,
        uom: award.bid_uom || null,
        itemNumber: award.bid_item_number || null,
      };
      const trust = costTrustworthy(award.unit_of_measure, cost.uom);
      routing = {
        supplier: cost.vendor!.trim(),
        reason: trust ? cost.source! : `${cost.source!} — COST UNVERIFIED (UoM "${award.unit_of_measure}" vs "${cost.uom}")`,
        cost,
      };
    } else {
      const cost = waterfallByNsn.get(award.nsn);
      if (!cost || !cost.vendor) {
        routing = { supplier: "UNASSIGNED", reason: "no cost/vendor in nsn_costs", cost: cost ?? null };
      } else {
        const trust = costTrustworthy(award.unit_of_measure, cost.uom);
        routing = {
          supplier: cost.vendor.trim(),
          reason: trust ? (cost.source || "nsn_costs fallback") : `nsn_costs waterfall — COST UNVERIFIED (UoM "${award.unit_of_measure}" vs "${cost.uom}")`,
          cost,
        };
      }
    }

    // Reviewed-override fast-path: if Abe has reviewed this (NSN, vendor) before,
    // use his values and skip COST UNVERIFIED. Only applies when we landed on a
    // real supplier (not UNASSIGNED) — override is keyed by the routed vendor.
    if (routing.supplier !== "UNASSIGNED" && award.nsn) {
      const ov = overrideByKey.get(`${award.nsn}__${routing.supplier.toUpperCase()}`);
      if (ov) {
        const reviewedDate = new Date(ov.reviewed_at).toISOString().slice(0, 10);
        routing = {
          supplier: routing.supplier,
          reason: `reviewed override by ${ov.reviewed_by} on ${reviewedDate}`,
          cost: {
            cost: ov.unit_cost !== null ? ov.unit_cost : (routing.cost?.cost ?? 0),
            source: routing.cost?.source || null,
            vendor: routing.supplier,
            uom: ov.unit_of_measure || routing.cost?.uom || null,
            itemNumber: routing.cost?.itemNumber ?? null,
          },
        };
        // Also overwrite the award's unit_of_measure so it gets persisted to
        // po_lines.unit_of_measure (Abe already fixed this once).
        if (ov.unit_of_measure) award.unit_of_measure = ov.unit_of_measure;
      }
    }

    routingByAward.set(award.id, routing);
    const key = routing.supplier;
    if (!bySupplier.has(key)) bySupplier.set(key, []);
    bySupplier.get(key)!.push(award);
  }

  const createdPOs: any[] = [];
  const timestamp = Date.now().toString(36).toUpperCase();

  let poIndex = 0;
  for (const [supplier, supplierAwards] of bySupplier) {
    poIndex++;
    const poNumber = `PO-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${timestamp}-${poIndex}`;

    // Per-line unit_cost = the waterfall-winner cost from nsn_costs
    // when the award's UoM matched. UNASSIGNED lines still get 0 cost
    // (Abe switches supplier → cost repopulates from the target).
    const lineDrafts = supplierAwards.map((a: any) => {
      const routing = routingByAward.get(a.id);
      const onRealSupplier = supplier !== "UNASSIGNED";
      // Only use the vendor's cost when the UoMs are trustworthy; if they
      // differ (and the routing reason flags it), zero the cost and surface
      // the "COST UNVERIFIED" reason so Abe sees margin=0 and fixes it
      // manually (typically via supplier-switch). This is the safe split:
      // group by vendor for routing, but don't multiply an incompatible
      // cost × qty that would produce a negative-margin PO.
      const costUnverified = (routing?.reason || "").includes("COST UNVERIFIED");
      // Use per-each split when award is EA but cost is in B<NN> (otherwise
      // raw AX cost passes through). costTrustworthy() now allows this case.
      const rawUnitCost = onRealSupplier && !costUnverified && routing?.cost
        ? effectiveUnitCost(a.unit_of_measure, routing.cost)
        : 0;
      const unitCost = rawUnitCost;
      const qty = a.quantity || 1;
      return {
        award: a,
        unit_cost: unitCost,
        total_cost: unitCost * qty,
        cost_source: onRealSupplier ? routing?.reason ?? null : "UNASSIGNED",
        vendor_item_number: onRealSupplier ? routing?.cost?.itemNumber ?? null : null,
      };
    });
    const totalCost = lineDrafts.reduce((s, l) => s + l.total_cost, 0);

    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .insert({
        po_number: poNumber,
        supplier,
        status: "draft",
        total_cost: totalCost,
        line_count: supplierAwards.length,
        created_by: user.profile?.full_name || user.user.email || "unknown",
      })
      .select()
      .single();

    if (poError || !po) continue;

    const lines = lineDrafts.map((l) => ({
      po_id: po.id,
      award_id: l.award.id,
      nsn: l.award.nsn,
      description: l.award.description,
      quantity: l.award.quantity,
      unit_of_measure: l.award.unit_of_measure || null,
      unit_cost: l.unit_cost,
      total_cost: l.total_cost,
      sell_price: l.award.unit_price,
      margin_pct: computeMarginPct(l.award.unit_price, l.unit_cost),
      supplier,
      cost_source: l.cost_source,
      vendor_item_number: l.vendor_item_number,
      contract_number: l.award.contract_number,
      order_number: l.award.order_number,
      fob: l.award.fob,
      required_delivery: l.award.required_delivery,
    }));

    await supabase.from("po_lines").insert(lines);

    // Race-safe claim: UPDATE ... WHERE po_generated=false (rather than by id
    // alone). If a competing request already set po_generated=true between
    // the fetch above and this update, the write simply doesn't affect that
    // row and our PO line will point at an award that's already linked
    // elsewhere. We log that count so it's visible in the response.
    const ids = supplierAwards.map((a: any) => a.id);
    const { data: claimed } = await supabase
      .from("awards")
      .update({ po_generated: true, po_id: po.id })
      .in("id", ids)
      .eq("po_generated", false)
      .select("id");
    const claimedCount = claimed?.length || 0;
    const contested = ids.length - claimedCount;

    createdPOs.push({
      po_number: poNumber,
      supplier,
      lines: supplierAwards.length,
      total_cost: totalCost,
      contested, // awards claimed by a parallel run between our fetch + claim
    });
  }

  // Log a sync_log row so we have an audit trail (the spec called this
  // absence out as a gap).
  await supabase.from("sync_log").insert({
    action: "po_generated",
    details: {
      user: user.profile?.full_name || user.user.email,
      po_count: createdPOs.length,
      award_count: eligible.length,
      skipped_already_claimed: alreadyClaimed.length,
      pos: createdPOs,
    },
  });

  const { ip, userAgent } = requestContext(req);
  trackEvent({
    userId: user.user.id,
    userName: user.profile?.full_name || user.user.email,
    eventType: "order",
    eventAction: "po_created",
    page: "/orders",
    details: {
      po_count: createdPOs.length,
      line_count: eligible.length,
      total_value: createdPOs.reduce((s, p) => s + p.total_cost, 0),
    },
    ip,
    userAgent,
  });

  // Surface how many lines couldn't be auto-assigned. Separate the
  // "no cost row" case from the "UoM mismatch" case so Abe knows
  // whether to expect vendor data to show up on the next sync or
  // whether he needs to manually switch supplier.
  const unassignedCount = bySupplier.get("UNASSIGNED")?.length || 0;
  const supplierCount = createdPOs.length - (unassignedCount > 0 ? 1 : 0);
  const unassignedBreakdown = { no_cost: 0, uom_mismatch: 0 };
  for (const [, routing] of routingByAward) {
    if (routing.supplier !== "UNASSIGNED") continue;
    if (routing.reason.startsWith("UoM mismatch")) unassignedBreakdown.uom_mismatch++;
    else unassignedBreakdown.no_cost++;
  }

  return NextResponse.json({
    success: true,
    po_count: createdPOs.length,
    line_count: eligible.length,
    supplier_count: supplierCount,
    unassigned_line_count: unassignedCount,
    unassigned_breakdown: unassignedBreakdown,
    skipped_already_claimed: alreadyClaimed.length,
    pos: createdPOs,
  });
}
