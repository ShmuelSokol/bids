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
 * Writes up to four places:
 *   1. `dibbs_solicitations` row — updates `bid_vendor/bid_cost/bid_uom/
 *      bid_item_number` + re-derives `margin_pct` so the preview reflects
 *      the override immediately.
 *   2. `nsn_review_overrides` — upserts (nsn, vendor) so future
 *      `generate-pos` calls for the same pair auto-use these values.
 *   3. `nsn_sourcing_notes` — when `new_note` is provided, APPENDS a row
 *      (never overwrites) so historical context stays intact. E.g., a
 *      "we're blocked" note from last quarter stays visible when the NSN
 *      reappears on a new solicitation.
 *   4. Any DRAFT `po_lines` matching (nsn, vendor) — updates unit_cost,
 *      unit_of_measure, vendor_item_number, total_cost, margin_pct, and
 *      tags `cost_source` as "reviewed override by … on …". The parent
 *      PO's `total_cost` is recalculated too. AX-committed POs are never
 *      touched.
 *
 * Body: {
 *   solicitation_id: number,
 *   vendor: string,
 *   unit_of_measure?: string,
 *   unit_cost?: number,
 *   supplier_sku?: string,
 *   new_note?: string,            // appended to nsn_sourcing_notes
 * }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const { solicitation_id, vendor, unit_of_measure, unit_cost, supplier_sku, new_note } = body;
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
  const noteClean = typeof new_note === "string" && new_note.trim() ? new_note.trim() : null;
  const reviewedBy = user.profile?.full_name || user.user.email || "unknown";
  const reviewedAtIso = new Date().toISOString();

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

  // 2) Upsert the persistent (nsn, vendor) override for future PO generation.
  const { error: ovErr } = await supabase
    .from("nsn_review_overrides")
    .upsert(
      {
        nsn: sol.nsn,
        vendor: vendorClean,
        unit_of_measure: uomClean,
        unit_cost: costNum,
        supplier_sku: skuClean,
        reviewed_by: reviewedBy,
        reviewed_at: reviewedAtIso,
      },
      { onConflict: "nsn,vendor" }
    );
  if (ovErr) return NextResponse.json({ error: ovErr.message }, { status: 500 });

  // 3) Append note (never overwrite) so history accumulates.
  if (noteClean) {
    await supabase.from("nsn_sourcing_notes").insert({
      nsn: sol.nsn,
      vendor: vendorClean,
      note: noteClean,
      author: reviewedBy,
      created_at: reviewedAtIso,
    });
  }

  // 4) Cascade to ANY open draft PO lines for this (nsn, vendor). Only draft
  //    POs — anything with ax_po_number or an advanced dmf_state is locked.
  let draftLinesUpdated = 0;
  let draftPosRecalced = 0;
  if (costNum !== null || uomClean || skuClean) {
    // Which POs qualify (drafted + not yet in AX)?
    const { data: draftPos } = await supabase
      .from("purchase_orders")
      .select("id")
      .or("dmf_state.is.null,dmf_state.eq.drafted")
      .is("ax_po_number", null);
    const draftPoIds = (draftPos || []).map((p) => p.id);

    if (draftPoIds.length > 0) {
      const { data: matchingLines } = await supabase
        .from("po_lines")
        .select("id, po_id, nsn, supplier, quantity, unit_cost, unit_of_measure, sell_price, vendor_item_number")
        .in("po_id", draftPoIds)
        .eq("nsn", sol.nsn)
        .ilike("supplier", vendorClean);

      const affectedPoIds = new Set<number>();
      for (const l of matchingLines || []) {
        const newCost = costNum !== null ? costNum : Number(l.unit_cost || 0);
        const qty = Number(l.quantity || 0);
        const lineUpdate: Record<string, any> = {
          updated_at: reviewedAtIso,
          cost_source: `reviewed override by ${reviewedBy} on ${reviewedAtIso.slice(0, 10)} (cascaded from solicitation sourcing)`,
        };
        if (costNum !== null) {
          lineUpdate.unit_cost = newCost;
          lineUpdate.total_cost = newCost * qty;
          lineUpdate.margin_pct = computeMarginPct(l.sell_price, newCost);
        }
        if (uomClean) lineUpdate.unit_of_measure = uomClean;
        if (skuClean) lineUpdate.vendor_item_number = skuClean;
        const { error: lineErr } = await supabase.from("po_lines").update(lineUpdate).eq("id", l.id);
        if (!lineErr) {
          draftLinesUpdated++;
          affectedPoIds.add(l.po_id);
        }
      }

      // Recompute PO header totals for anything we touched.
      for (const poId of affectedPoIds) {
        const { data: siblings } = await supabase.from("po_lines").select("total_cost").eq("po_id", poId);
        const total = (siblings || []).reduce((s, x) => s + (Number(x.total_cost) || 0), 0);
        await supabase.from("purchase_orders").update({ total_cost: total, updated_at: reviewedAtIso }).eq("id", poId);
        draftPosRecalced++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    nsn: sol.nsn,
    vendor: vendorClean,
    solicitation_updated: true,
    override_persisted: true,
    note_appended: noteClean !== null,
    draft_lines_updated: draftLinesUpdated,
    draft_pos_recalced: draftPosRecalced,
  });
}

/**
 * GET /api/solicitations/set-sourcing?id=<solicitation_id>
 *
 * Returns existing sourcing state for the modal to pre-fill. Combines:
 *   - The solicitation's own bid_* fields
 *   - All `nsn_review_overrides` rows for this NSN (across vendors)
 *   - Full `nsn_sourcing_notes` history for this NSN (newest first)
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

  const [overrides, notes] = await Promise.all([
    supabase
      .from("nsn_review_overrides")
      .select("nsn, vendor, unit_of_measure, unit_cost, supplier_sku, reviewed_by, reviewed_at")
      .eq("nsn", sol.nsn || ""),
    supabase
      .from("nsn_sourcing_notes")
      .select("id, note, vendor, author, created_at")
      .eq("nsn", sol.nsn || "")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    solicitation: sol,
    overrides: overrides.data || [],
    notes: notes.data || [],
  });
}
