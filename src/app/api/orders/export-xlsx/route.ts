import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import ExcelJS from "exceljs";
import JSZip from "jszip";

/**
 * POST /api/orders/export-xlsx
 *
 * Body: { poIds: number[] }
 *
 * Returns:
 *   - 1 PO  → single .xlsx file
 *   - 2+ POs → .zip containing one .xlsx per PO (named PO-<number>-<supplier>.xlsx)
 *
 * Each sheet contains the line-level detail Abe (or a vendor) needs to
 * fulfill the PO: NSN, item, qty, UoM, unit cost, extended cost,
 * required delivery, FOB, plus a header block with PO #, supplier,
 * total, and cost source per line so vendor sees where each price
 * came from.
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
    .select("*, po_lines(*)")
    .in("id", poIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pos || pos.length === 0) {
    return NextResponse.json({ error: "no POs found" }, { status: 404 });
  }

  // Build one workbook per PO. Returns Buffer.
  async function buildWorkbook(po: any): Promise<Uint8Array> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "DIBS";
    wb.created = new Date();
    const ws = wb.addWorksheet(po.po_number || `PO-${po.id}`);

    // Header block
    ws.mergeCells("A1:H1");
    ws.getCell("A1").value = `Purchase Order ${po.po_number}`;
    ws.getCell("A1").font = { size: 14, bold: true };
    ws.getRow(1).height = 22;

    ws.getCell("A2").value = "Supplier:";
    ws.getCell("B2").value = po.supplier || "";
    ws.getCell("A3").value = "Created:";
    ws.getCell("B3").value = po.created_at ? new Date(po.created_at).toISOString().slice(0, 10) : "";
    ws.getCell("A4").value = "Lines:";
    ws.getCell("B4").value = po.line_count ?? (po.po_lines?.length || 0);
    ws.getCell("A5").value = "Total Cost:";
    ws.getCell("B5").value = po.total_cost || 0;
    ws.getCell("B5").numFmt = '"$"#,##0.00';
    ws.getCell("A6").value = "Status:";
    ws.getCell("B6").value = po.status || "draft";

    for (const r of [2, 3, 4, 5, 6]) ws.getCell(`A${r}`).font = { bold: true };

    // Spacer row
    ws.getRow(7).height = 8;

    // Column headers
    const headerRow = ws.addRow([
      "Line",
      "NSN",
      "Description",
      "Qty",
      "UoM",
      "Unit Cost",
      "Extended Cost",
      "Required Delivery",
      "Cost Source",
      "FOB",
      "Contract",
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };

    const lines = (po.po_lines || []).slice().sort((a: any, b: any) => a.id - b.id);
    let lineNo = 1;
    for (const l of lines) {
      ws.addRow([
        lineNo++,
        l.nsn || "",
        l.description || "",
        l.quantity || 0,
        l.unit_of_measure || "",
        l.unit_cost || 0,
        l.total_cost || 0,
        l.required_delivery ? new Date(l.required_delivery).toISOString().slice(0, 10) : "",
        l.cost_source || "",
        l.fob || "",
        l.contract_number || "",
      ]);
    }

    // Totals row
    const totalRowIdx = ws.lastRow!.number + 1;
    const totalRow = ws.addRow([
      "",
      "",
      "TOTAL",
      lines.reduce((s: number, l: any) => s + (l.quantity || 0), 0),
      "",
      "",
      lines.reduce((s: number, l: any) => s + (l.total_cost || 0), 0),
      "",
      "",
      "",
      "",
    ]);
    totalRow.font = { bold: true };
    totalRow.getCell(7).numFmt = '"$"#,##0.00';

    // Number formats on the data rows (rows 9..lastRow-1)
    const headerRowIdx = headerRow.number;
    for (let r = headerRowIdx + 1; r < totalRowIdx; r++) {
      ws.getCell(`F${r}`).numFmt = '"$"#,##0.00';
      ws.getCell(`G${r}`).numFmt = '"$"#,##0.00';
    }

    // Reasonable column widths
    ws.columns.forEach((col, i) => {
      const widths = [6, 18, 40, 8, 6, 12, 14, 14, 28, 6, 18];
      col.width = widths[i] || 14;
    });

    const ab = await wb.xlsx.writeBuffer();
    return new Uint8Array(ab as ArrayBuffer);
  }

  function safeName(s: string): string {
    return s.replace(/[^A-Za-z0-9._-]+/g, "_");
  }

  if (pos.length === 1) {
    const po = pos[0];
    const buf = await buildWorkbook(po);
    const filename = `${safeName(po.po_number || `PO-${po.id}`)}.xlsx`;
    return new NextResponse(new Blob([buf as BlobPart]), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // Multi-PO → ZIP it
  const zip = new JSZip();
  for (const po of pos) {
    const buf = await buildWorkbook(po);
    const fname = `${safeName(po.po_number || `PO-${po.id}`)}-${safeName(po.supplier || "supplier")}.xlsx`;
    zip.file(fname, buf);
  }
  const zipBuf = await zip.generateAsync({ type: "uint8array" });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Blob([zipBuf as BlobPart]), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="dibs-pos-${stamp}.zip"`,
    },
  });
}
