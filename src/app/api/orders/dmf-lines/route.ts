import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import ExcelJS from "exceljs";

/**
 * POST /api/orders/dmf-lines
 *
 * Body: { poIds: number[] }
 *
 * Generates a DMF-format xlsx matching Yosef's 4-13-26
 * Purchase_order_lines_V2 template:
 *
 *   PURCHASEORDERNUMBER | LINENUMBER | ITEMNUMBER |
 *   ORDEREDPURCHASEQUANTITY | PURCHASEPRICE |
 *   PURCHASEUNITSYMBOL | RECEIVINGWAREHOUSEID
 *
 * All column headers UPPERCASE, sheet named "Purchase_order_lines_V2".
 * Values follow the template exactly:
 *   - PURCHASEUNITSYMBOL is lowercased
 *   - RECEIVINGWAREHOUSEID hardcoded 'W01' for DIBS POs (per Yosef)
 *
 * Precondition: each PO must have ax_po_number populated (header
 * import already ran). Skips any PO without one and reports it in
 * the response.
 */
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
    .select("id, po_number, supplier, ax_po_number, po_lines(id, nsn, quantity, unit_of_measure, unit_cost, vendor_item_number)")
    .in("id", poIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pos?.length) return NextResponse.json({ error: "no POs found" }, { status: 404 });

  const missing: number[] = [];
  const rows: any[] = [];
  for (const po of pos) {
    if (!po.ax_po_number) {
      missing.push(po.id);
      continue;
    }
    const lines = (po.po_lines || []).slice().sort((a: any, b: any) => a.id - b.id);
    let lineNo = 1;
    for (const l of lines) {
      rows.push({
        PURCHASEORDERNUMBER: po.ax_po_number,
        LINENUMBER: lineNo++,
        ITEMNUMBER: l.vendor_item_number || "",
        ORDEREDPURCHASEQUANTITY: l.quantity || 0,
        PURCHASEPRICE: l.unit_cost || 0,
        PURCHASEUNITSYMBOL: (l.unit_of_measure || "EA").toLowerCase(),
        RECEIVINGWAREHOUSEID: "W01",
      });
    }
  }

  if (missing.length === pos.length) {
    return NextResponse.json(
      {
        error: "No POs have ax_po_number set. Run the header DMF import first.",
        missing_ax_po_number: missing,
      },
      { status: 400 }
    );
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "DIBS";
  wb.created = new Date();
  const ws = wb.addWorksheet("Purchase_order_lines_V2");

  const cols = [
    "PURCHASEORDERNUMBER",
    "LINENUMBER",
    "ITEMNUMBER",
    "ORDEREDPURCHASEQUANTITY",
    "PURCHASEPRICE",
    "PURCHASEUNITSYMBOL",
    "RECEIVINGWAREHOUSEID",
  ];
  ws.addRow(cols);
  for (const r of rows) ws.addRow(cols.map((c) => r[c]));
  ws.columns.forEach((c, i) => {
    c.width = [22, 10, 20, 22, 14, 18, 20][i] || 16;
  });

  const buf = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Blob([buf as BlobPart]), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dibs-po-lines-${stamp}.xlsx"`,
      "X-Skipped-POs": missing.join(","),
    },
  });
}
