import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import { trackEvent, requestContext } from "@/lib/track";
import { computeMarginPct } from "@/lib/margin";

/**
 * POST /api/orders/generate-pos
 *
 * For each selected award, look up the cheapest supplier for that NSN
 * from `nsn_vendor_prices`. Group awards by that supplier and create
 * one draft PO per supplier — so 12 items cheapest from Vendor A all
 * land on Vendor A's PO, 5 items from Vendor B on Vendor B's PO, etc.
 *
 * Awards with no vendor price lookup land on a single "UNASSIGNED"
 * PO that Abe can re-assign per-line via the supplier-switch flow.
 *
 * `unit_cost` on each po_line uses the vendor's price (not the
 * historical award.our_cost), so margin reflects the actual cost
 * we'd pay this supplier today.
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

  // For each NSN in the eligible awards, look up the cheapest vendor
  // from nsn_vendor_prices. Sort ascending by price so the FIRST row
  // per NSN wins (we keep only one cheapest per NSN below).
  const nsns = [...new Set(eligible.map((a) => a.nsn).filter(Boolean))];
  const cheapestByNsn = new Map<
    string,
    { vendor: string; price: number; source: string | null; itemNumber: string | null }
  >();
  if (nsns.length > 0) {
    const { data: vendorPrices } = await supabase
      .from("nsn_vendor_prices")
      .select("nsn, vendor, price, price_source, item_number")
      .in("nsn", nsns)
      .gt("price", 0)
      .order("price", { ascending: true });
    for (const vp of vendorPrices || []) {
      if (!cheapestByNsn.has(vp.nsn)) {
        cheapestByNsn.set(vp.nsn, {
          vendor: vp.vendor,
          price: vp.price,
          source: vp.price_source,
          itemNumber: vp.item_number,
        });
      }
    }
  }

  // Group by cheapest vendor (NOT by award.cage which is the awardee = us).
  // Awards with no vendor price land on UNASSIGNED — Abe can switch them
  // per-line afterward via the supplier-switch flow.
  const bySupplier = new Map<string, any[]>();
  for (const award of eligible) {
    const cheapest = cheapestByNsn.get(award.nsn);
    const supplier = cheapest?.vendor?.trim() || "UNASSIGNED";
    if (!bySupplier.has(supplier)) bySupplier.set(supplier, []);
    bySupplier.get(supplier)!.push(award);
  }

  const createdPOs: any[] = [];
  const timestamp = Date.now().toString(36).toUpperCase();

  let poIndex = 0;
  for (const [supplier, supplierAwards] of bySupplier) {
    poIndex++;
    const poNumber = `PO-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${timestamp}-${poIndex}`;

    // Per-line unit_cost = vendor's price for this NSN if known, else
    // fall back to the historical award.our_cost.
    const lineDrafts = supplierAwards.map((a: any) => {
      const cheapest = cheapestByNsn.get(a.nsn);
      const unitCost = cheapest?.price ?? a.our_cost ?? 0;
      const qty = a.quantity || 1;
      return {
        award: a,
        unit_cost: unitCost,
        total_cost: unitCost * qty,
        cost_source: cheapest?.source || (a.our_cost ? "historical_po" : null),
        vendor_item_number: cheapest?.itemNumber || null,
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
      unit_cost: l.unit_cost,
      total_cost: l.total_cost,
      sell_price: l.award.unit_price,
      margin_pct: computeMarginPct(l.award.unit_price, l.unit_cost),
      supplier,
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

  // Surface how many lines couldn't be auto-assigned (no vendor price)
  // so the UI can prompt Abe to use the supplier-switch on the
  // UNASSIGNED PO.
  const unassignedCount = bySupplier.get("UNASSIGNED")?.length || 0;
  const supplierCount = createdPOs.length - (unassignedCount > 0 ? 1 : 0);

  return NextResponse.json({
    success: true,
    po_count: createdPOs.length,
    line_count: eligible.length,
    supplier_count: supplierCount,
    unassigned_line_count: unassignedCount,
    skipped_already_claimed: alreadyClaimed.length,
    pos: createdPOs,
  });
}
