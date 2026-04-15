import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import ExcelJS from "exceljs";

/**
 * POST /api/orders/dmf-header
 *
 * Body: { poIds: number[] }
 *
 * Generates the PO HEADER DMF file — one row per PO. Sheet name must
 * match the DMF project Yosef sets up. Column list is based on the
 * 50-PO recon (scripts/reverse-engineer-ax-po-schema.ts) + standard
 * Purchase_order_headers_V2 entity fields.
 *
 * Critical: omits PURCHASEORDERNUMBER entirely — the DMF project has
 * "auto-generate" checked so AX assigns numbers from its UI sequence.
 *
 * DIBS stamps a correlation ref (VendorOrderReference field) so that
 * after import, /api/orders/poll-ax can find which AX PO number got
 * assigned to which DIBS purchase_orders.id.
 *
 * After successful generation, DIBS marks each PO's dmf_state as
 * 'awaiting_po_number' so the poll-ax job knows to watch it.
 *
 * Still needs Yosef's actual DMF template confirmation for column
 * casing + which exact fields his project consumes. Columns here are
 * my best-guess defaults from the recon; safe to tweak post-feedback.
 */

// Constants that were observed on ALL 50 sampled POs (hardcode).
const HEADER_CONSTANTS = {
  CURRENCYCODE: "USD",
  DEFAULTRECEIVINGSITEID: "S01",
  DEFAULTRECEIVINGWAREHOUSEID: "W01", // W01 confirmed for DIBS POs (Yosef 4-15)
  PURCHASEORDERPOOLID: "DOM",
  PURCHASEORDERHEADERCREATIONMETHOD: "Purchase",
  SALESTAXGROUPCODE: "NY-Exempt",
  VENDORPAYMENTMETHODNAME: "Check",
  VENDORPOSTINGPROFILEID: "ALL",
  LANGUAGEID: "en-US",
  INVOICETYPE: "Invoice",
  DELIVERYADDRESSCOUNTRYREGIONID: "USA",
  DELIVERYADDRESSLOCATIONID: "000000203", // Brooklyn, pairs with W01
  DELIVERYADDRESSDESCRIPTION: "SZY Brooklyn",
  DELIVERYADDRESSNAME: "SZY Brooklyn",
  DELIVERYADDRESSCITY: "Brooklyn",
  DELIVERYADDRESSSTATEID: "NY",
  DELIVERYADDRESSSTREET: "300 Liberty Avenue",
  DELIVERYADDRESSZIPCODE: "11207",
  ORDERERPERSONNELNUMBER: "000001",
  REQUESTERPERSONNELNUMBER: "000001",
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createServiceClient();
  const { poIds } = await req.json();
  if (!Array.isArray(poIds) || poIds.length === 0) {
    return NextResponse.json({ error: "poIds[] required" }, { status: 400 });
  }

  const { data: pos, error } = await supabase
    .from("purchase_orders")
    .select("id, po_number, supplier, total_cost, line_count, ax_correlation_ref, dmf_state")
    .in("id", poIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pos?.length) return NextResponse.json({ error: "no POs found" }, { status: 404 });

  // Exclude UNASSIGNED (no real supplier)
  const eligible = pos.filter((p) => p.supplier && p.supplier !== "UNASSIGNED");
  if (eligible.length === 0) {
    return NextResponse.json(
      { error: "No POs with a real vendor. Use Switch Supplier on UNASSIGNED lines first." },
      { status: 400 }
    );
  }

  // Assign correlation refs if not already set
  const correlationUpdates: { id: number; ax_correlation_ref: string }[] = [];
  for (const p of eligible) {
    if (!p.ax_correlation_ref) {
      const ref = `DIBS-${p.id}-${Date.now().toString(36)}`.toUpperCase();
      correlationUpdates.push({ id: p.id, ax_correlation_ref: ref });
      p.ax_correlation_ref = ref;
    }
  }
  for (const u of correlationUpdates) {
    await supabase.from("purchase_orders").update({ ax_correlation_ref: u.ax_correlation_ref }).eq("id", u.id);
  }

  // Build rows
  const cols = [
    "ORDERVENDORACCOUNTNUMBER",
    "INVOICEVENDORACCOUNTNUMBER",
    "VENDORORDERREFERENCE", // correlation — we find POs back through this
    ...Object.keys(HEADER_CONSTANTS),
  ];
  const rows = eligible.map((p) => ({
    ORDERVENDORACCOUNTNUMBER: p.supplier,
    INVOICEVENDORACCOUNTNUMBER: p.supplier,
    VENDORORDERREFERENCE: p.ax_correlation_ref,
    ...HEADER_CONSTANTS,
  }));

  const wb = new ExcelJS.Workbook();
  wb.creator = "DIBS";
  wb.created = new Date();
  const ws = wb.addWorksheet("Purchase_order_headers_V2");
  ws.addRow(cols);
  for (const r of rows) ws.addRow(cols.map((c) => (r as any)[c]));
  ws.columns.forEach((c) => (c.width = 22));

  // Flip state so poll-ax picks them up
  const ids = eligible.map((p) => p.id);
  await supabase
    .from("purchase_orders")
    .update({ dmf_state: "awaiting_po_number" })
    .in("id", ids);

  const buf = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Blob([buf as BlobPart]), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dibs-po-headers-${stamp}.xlsx"`,
      "X-Po-Count": String(eligible.length),
    },
  });
}
