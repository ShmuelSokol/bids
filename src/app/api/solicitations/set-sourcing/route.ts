import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import { computeMarginPct } from "@/lib/margin";

/**
 * POST /api/solicitations/set-sourcing
 *
 * Pre-award sourcing override for a solicitation. Lets Abe lock in UoM,
 * vendor cost, vendor, and vendor SKU at the solicitation stage so the
 * matching award doesn't need to be reviewed later.
 *
 * Writes to two places:
 *   1. `dibbs_solicitations` row (this specific solicitation): updates
 *      `bid_vendor`, `bid_cost`, `bid_uom`, `bid_item_number`,
 *      `bid_cost_source`, and re-derives `margin_pct` so the sourceable
 *      preview reflects the override immediately.
 *   2. `nsn_review_overrides` (persistent, keyed by `(nsn, vendor)`):
 *      upserts so future solicitations AND PO generations for the same
 *      (NSN, vendor) pair auto-use these values.
 *
 * Body: {
 *   solicitation_id: number,
 *   vendor: string,
 *   unit_of_measure?: string,
 *   unit_cost?: number,
 *   supplier_sku?: string,
 *   notes?: string,
 * }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { solicitation_id, vendor, unit_of_measure, unit_cost, supplier_sku, notes } = body;
  if (typeof solicitation_id !== "number") return NextResponse.json({ error: "solicitation_id required" }, { status: 400 });
  if (!vendor || typeof vendor !== "string") return NextResponse.json({ error: "vendor required" }, { status: 400 });

  const supabase = createServiceClient();

  const { data: sol, error: sErr } = await supabase
    .from("dibbs_solicitations")
    .select("id, nsn, suggested_price")
    .eq("id", solicitation_id)
    .single();
  if (sErr || !sol) return NextResponse.json({ error: sErr?.message || "Solicitation not found" }, { status: 404 });
  if (!sol.nsn) return NextResponse.json({ error: "Solicitation has no NSN — cannot persist override" }, { status: 400 });

  const vendorClean = vendor.trim().toUpperCase();
  const uomClean = typeof unit_of_measure === "string" && unit_of_measure.trim() ? unit_of_measure.trim().toUpperCase() : null;
  const costNum = typeof unit_cost === "number" && unit_cost > 0 ? Number(unit_cost) : null;
  const skuClean = typeof supplier_sku === "string" && supplier_sku.trim() ? supplier_sku.trim() : null;
  const reviewedBy = user.profile?.full_name || user.user.email || "unknown";

  // 1) Update this solicitation so its preview reflects the override right away.
  const solUpdate: Record<string, any> = {
    bid_vendor: vendorClean,
    bid_cost_source: `manual sourcing by ${reviewedBy}`,
  };
  if (uomClean) solUpdate.bid_uom = uomClean;
  if (costNum !== null) solUpdate.bid_cost = costNum;
  if (skuClean) solUpdate.bid_item_number = skuClean;
  if (costNum !== null && sol.suggested_price) {
    const m = computeMarginPct(sol.suggested_price, costNum);
    if (m !== null) solUpdate.margin_pct = m;
  }
  const { error: updErr } = await supabase
    .from("dibbs_solicitations")
    .update(solUpdate)
    .eq("id", solicitation_id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // 2) Upsert the persistent (nsn, vendor) override.
  const { error: ovErr } = await supabase
    .from("nsn_review_overrides")
    .upsert(
      {
        nsn: sol.nsn,
        vendor: vendorClean,
        unit_of_measure: uomClean,
        unit_cost: costNum,
        supplier_sku: skuClean,
        notes: notes || null,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: "nsn,vendor" }
    );
  if (ovErr) return NextResponse.json({ error: ovErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    nsn: sol.nsn,
    vendor: vendorClean,
    solicitation_updated: true,
    override_persisted: true,
  });
}

/**
 * GET /api/solicitations/set-sourcing?id=<solicitation_id>
 *
 * Returns existing sourcing state for the modal to pre-fill. Combines:
 *   - The solicitation's own bid_* fields
 *   - Any matching `nsn_review_overrides` keyed by (nsn, current bid_vendor)
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id") || 0);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: sol } = await supabase
    .from("dibbs_solicitations")
    .select("id, nsn, bid_vendor, bid_cost, bid_uom, bid_item_number, bid_cost_source, suggested_price")
    .eq("id", id)
    .single();
  if (!sol) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // All overrides for this NSN (may have multiple vendors on file)
  const { data: overrides } = await supabase
    .from("nsn_review_overrides")
    .select("nsn, vendor, unit_of_measure, unit_cost, supplier_sku, notes, reviewed_by, reviewed_at")
    .eq("nsn", sol.nsn || "");

  return NextResponse.json({ solicitation: sol, overrides: overrides || [] });
}
