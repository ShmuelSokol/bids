import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import { computeMarginPct } from "@/lib/margin";

/**
 * POST /api/orders/po-lines/update
 *
 * Inline edit of a PO line — currently supports:
 *   - unit_of_measure (resolves UoM mismatches)
 *   - unit_cost        (manual cost override)
 *
 * Recomputes margin_pct + cost_source tag whenever either field changes.
 * Clears the "COST UNVERIFIED" prefix from cost_source when the new
 * UoM matches the vendor UoM (from nsn_costs) or when a manual cost is
 * explicitly entered.
 *
 * Body: { line_id: number, unit_of_measure?: string, unit_cost?: number }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const lineId = body.line_id;
  const newUom: string | undefined = body.unit_of_measure;
  const newCost: number | undefined = body.unit_cost;
  if (typeof lineId !== "number") {
    return NextResponse.json({ error: "line_id required" }, { status: 400 });
  }
  if (newUom === undefined && newCost === undefined) {
    return NextResponse.json({ error: "need at least one of unit_of_measure, unit_cost" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Pull the current line
  const { data: line, error: lineErr } = await supabase
    .from("po_lines")
    .select("id, nsn, quantity, unit_cost, unit_of_measure, sell_price, supplier, cost_source")
    .eq("id", lineId)
    .single();
  if (lineErr || !line) {
    return NextResponse.json({ error: lineErr?.message || "line not found" }, { status: 404 });
  }

  // Build the update
  const update: Record<string, any> = { updated_at: new Date().toISOString() };
  const uomToUse = newUom !== undefined ? newUom : line.unit_of_measure;
  let costToUse = newCost !== undefined ? newCost : line.unit_cost;

  if (newUom !== undefined) update.unit_of_measure = newUom.toString().trim();

  // If user didn't supply a manual cost but fixed the UoM, re-run the
  // waterfall lookup to see if a vendor cost now makes sense.
  let costAutoResolved = false;
  if (newCost === undefined && newUom !== undefined && line.supplier && line.supplier !== "UNASSIGNED") {
    const { data: costs } = await supabase
      .from("nsn_costs")
      .select("cost, vendor, unit_of_measure, cost_source")
      .eq("nsn", line.nsn)
      .eq("vendor", line.supplier)
      .gt("cost", 0)
      .maybeSingle();
    if (costs && costs.cost) {
      const vendorUom = String(costs.unit_of_measure || "").trim().toUpperCase();
      const newUomNorm = String(newUom).trim().toUpperCase();
      if (vendorUom && newUomNorm === vendorUom) {
        costToUse = costs.cost;
        costAutoResolved = true;
      }
    }
  }

  if (newCost !== undefined || costAutoResolved) {
    update.unit_cost = costToUse;
    update.total_cost = (costToUse || 0) * (line.quantity || 0);
    update.margin_pct = computeMarginPct(line.sell_price, costToUse || 0);
  }

  // Update cost_source tag
  if (newCost !== undefined) {
    update.cost_source = `manual override by ${user.profile?.full_name || user.user.email}`;
  } else if (costAutoResolved) {
    update.cost_source = `nsn_costs waterfall (auto-resolved after UoM fix to ${uomToUse})`;
  } else if (newUom !== undefined) {
    // UoM changed but cost didn't; strip the COST UNVERIFIED prefix if
    // present so the UI stops flagging it (UoM was the issue, they own it now).
    const src = line.cost_source || "";
    if (src.includes("COST UNVERIFIED")) {
      update.cost_source = src.replace(/\s*—\s*COST UNVERIFIED.*$/, "").trim();
    }
  }

  const { data: updated, error: updErr } = await supabase
    .from("po_lines")
    .update(update)
    .eq("id", lineId)
    .select("id, unit_cost, unit_of_measure, total_cost, margin_pct, cost_source")
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Also recompute the PO header total
  const { data: siblingLines } = await supabase
    .from("po_lines")
    .select("total_cost, po_id")
    .eq("po_id", (await supabase.from("po_lines").select("po_id").eq("id", lineId).single()).data?.po_id);
  if (siblingLines && siblingLines.length > 0) {
    const poId = siblingLines[0].po_id;
    const totalCost = siblingLines.reduce((s, l) => s + (Number(l.total_cost) || 0), 0);
    await supabase.from("purchase_orders").update({ total_cost: totalCost, updated_at: new Date().toISOString() }).eq("id", poId);
  }

  return NextResponse.json({
    ok: true,
    line: updated,
    cost_auto_resolved: costAutoResolved,
  });
}
