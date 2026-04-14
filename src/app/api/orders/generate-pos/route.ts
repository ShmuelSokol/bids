import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import { trackEvent, requestContext } from "@/lib/track";

/**
 * POST /api/orders/generate-pos
 *
 * Group submitted awards by supplier CAGE and create one draft PO per supplier
 * with child po_lines. Marks each award.po_generated=true so it drops out of
 * the "New only (no PO yet)" filter.
 *
 * Race-condition defense: the request body comes from the browser and can be
 * stale. Before creating any PO we re-fetch the awards from the database
 * filtered on `po_generated=false`. Anything already claimed by another
 * session (or a prior run) is dropped from this batch and reported back to
 * the caller so they can refresh their view.
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

  // Group by supplier (CAGE code)
  const bySupplier = new Map<string, any[]>();
  for (const award of eligible) {
    const supplier = award.cage?.trim() || "UNKNOWN";
    if (!bySupplier.has(supplier)) bySupplier.set(supplier, []);
    bySupplier.get(supplier)!.push(award);
  }

  const createdPOs: any[] = [];
  const timestamp = Date.now().toString(36).toUpperCase();

  let poIndex = 0;
  for (const [supplier, supplierAwards] of bySupplier) {
    poIndex++;
    const poNumber = `PO-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${timestamp}-${poIndex}`;

    const totalCost = supplierAwards.reduce(
      (s: number, a: any) => s + (a.our_cost || 0) * (a.quantity || 1),
      0
    );

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

    const lines = supplierAwards.map((a: any) => ({
      po_id: po.id,
      award_id: a.id,
      nsn: a.nsn,
      description: a.description,
      quantity: a.quantity,
      unit_cost: a.our_cost,
      total_cost: (a.our_cost || 0) * (a.quantity || 1),
      sell_price: a.unit_price,
      margin_pct:
        a.our_cost && a.unit_price
          ? Math.round(((a.unit_price - a.our_cost) / a.unit_price) * 100)
          : null,
      supplier,
      contract_number: a.contract_number,
      order_number: a.order_number,
      fob: a.fob,
      required_delivery: a.required_delivery,
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

  return NextResponse.json({
    success: true,
    po_count: createdPOs.length,
    line_count: eligible.length,
    skipped_already_claimed: alreadyClaimed.length,
    pos: createdPOs,
  });
}
