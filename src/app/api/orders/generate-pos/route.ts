import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import { trackEvent, requestContext } from "@/lib/track";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const supabase = createServiceClient();

  const { awards } = await req.json();
  if (!awards || awards.length === 0) {
    return NextResponse.json({ error: "No awards provided" }, { status: 400 });
  }

  // Load alternative suppliers from D365 vendor-product data
  const { data: vendorProducts } = await supabase
    .from("nsn_costs")
    .select("nsn, cost, cost_source");
  // Also load the full vendor parts for alt supplier info
  // For now, we'll use CAGE as primary supplier and note alternatives exist

  // Group awards by supplier (CAGE code)
  const bySupplier = new Map<string, any[]>();
  for (const award of awards) {
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

    // Create PO
    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .insert({
        po_number: poNumber,
        supplier,
        status: "draft",
        total_cost: totalCost,
        line_count: supplierAwards.length,
        created_by:
          user?.profile?.full_name || user?.user?.email || "system",
      })
      .select()
      .single();

    if (poError || !po) continue;

    // Create PO lines
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
          ? Math.round(
              ((a.unit_price - a.our_cost) / a.unit_price) * 100
            )
          : null,
      supplier,
      contract_number: a.contract_number,
      order_number: a.order_number,
      fob: a.fob,
      required_delivery: a.required_delivery,
    }));

    await supabase.from("po_lines").insert(lines);

    // Mark awards as PO generated
    for (const a of supplierAwards) {
      await supabase
        .from("awards")
        .update({ po_generated: true, po_id: po.id })
        .eq("id", a.id);
    }

    createdPOs.push({
      po_number: poNumber,
      supplier,
      lines: supplierAwards.length,
      total_cost: totalCost,
    });
  }

  // Track PO generation
  const { ip, userAgent } = requestContext(req);
  trackEvent({
    userId: user?.user?.id,
    userName: user?.profile?.full_name || user?.user?.email,
    eventType: "order",
    eventAction: "po_created",
    page: "/orders",
    details: { po_count: createdPOs.length, line_count: awards.length, total_value: createdPOs.reduce((s, p) => s + p.total_cost, 0) },
    ip,
    userAgent,
  });

  return NextResponse.json({
    success: true,
    po_count: createdPOs.length,
    line_count: awards.length,
    pos: createdPOs,
  });
}
