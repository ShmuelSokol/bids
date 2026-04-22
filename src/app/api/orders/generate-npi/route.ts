import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import ExcelJS from "exceljs";

/**
 * POST /api/orders/generate-npi
 *
 * Generates a "New Product Import" xlsx with the RawData tab populated,
 * ready for Abe/Yosef to paste into their existing NPI Dashboard xlsm,
 * run the `ThisWorkbook.runfillingprocedure` macro, and upload to AX's
 * Data Management workspace.
 *
 * Two modes per input row (both produced in the same sheet — the macro
 * decides which tabs to fill based on what's present):
 *   - New item: AX doesn't know the NSN yet. Full RawData row —
 *     Item#, Description, Vendor, External, BarcodeValue, Price.
 *   - Add supplier to existing item: AX has the NSN, but this vendor
 *     isn't set up to supply it. Same RawData row; Yosef's macro only
 *     populates APPROVEDVENDOR + EXTERNALITEMDESC + TradeAgreement for
 *     these (skips RPCreate / RPV2 / BarCode when data already exists —
 *     per 2026-04-22 walkthrough with ssokol).
 *
 * AX SKU generation (when creating a NEW item):
 *   first 3 uppercase letters of vendor name + supplier SKU
 *   e.g. supplier "AMERIB", SKU "12345678" → "AME12345678"
 *   Collision check against our cached AX catalog (nsn_catalog +
 *   nsn_ax_vendor_parts). If collision, append "-2", "-3", …
 *
 * Body: { poIds: number[], mode?: "auto" | "new-item" | "add-supplier" }
 *
 * Returns the xlsx file as an attachment.
 */

type NpiRow = {
  itemNumber: string;
  description: string;
  vendor: string;
  external: string;
  barcode: string;
  price: number;
  mode: "new-item" | "add-supplier";
  source_line_id: number;
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const poIds: number[] = body.poIds || [];
  if (poIds.length === 0) {
    return NextResponse.json({ error: "poIds[] required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Pull the relevant POs + lines
  const { data: pos, error } = await supabase
    .from("purchase_orders")
    .select("*, po_lines(*)")
    .in("id", poIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Gather NSNs to check against cached AX data (for "is it a new item?")
  const allNsns = [...new Set((pos || []).flatMap((p: any) => (p.po_lines || []).map((l: any) => l.nsn).filter(Boolean)))];
  const { data: catalog } = await supabase.from("nsn_catalog").select("nsn, source").in("nsn", allNsns);
  const nsnInAx = new Set<string>();
  for (const c of catalog || []) if (c.source?.startsWith("AX:")) nsnInAx.add(c.nsn);

  const { data: vpBySnv } = await supabase
    .from("nsn_ax_vendor_parts")
    .select("nsn, vendor_account, ax_item_number")
    .in("nsn", allNsns);
  const vendorHasItem = new Set<string>();
  for (const v of vpBySnv || []) {
    vendorHasItem.add(`${v.nsn}__${(v.vendor_account || "").trim().toUpperCase()}`);
  }

  // Build existing-SKU set so we can collision-check
  const existingSkus = new Set<string>();
  const { data: allCatalog } = await supabase.from("nsn_catalog").select("source");
  for (const c of allCatalog || []) {
    const m = /^AX:(.+)$/.exec((c.source || "").trim());
    if (m) existingSkus.add(m[1].trim().toUpperCase());
  }
  const { data: allVp } = await supabase.from("nsn_ax_vendor_parts").select("ax_item_number");
  for (const v of allVp || []) {
    if (v.ax_item_number) existingSkus.add(String(v.ax_item_number).trim().toUpperCase());
  }

  function generateSku(vendor: string, supplierSku: string): string {
    const prefix = (vendor || "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "XXX";
    const base = `${prefix}${(supplierSku || "").replace(/\s+/g, "").toUpperCase()}`;
    if (!existingSkus.has(base)) { existingSkus.add(base); return base; }
    let n = 2;
    while (existingSkus.has(`${base}-${n}`)) n++;
    const out = `${base}-${n}`;
    existingSkus.add(out);
    return out;
  }

  const npiRows: NpiRow[] = [];
  for (const po of pos || []) {
    for (const line of po.po_lines || []) {
      if (!line.nsn || !line.supplier || line.supplier === "UNASSIGNED") continue;
      const nsnIsInAx = nsnInAx.has(line.nsn);
      const vendorKey = `${line.nsn}__${(line.supplier || "").trim().toUpperCase()}`;
      const vendorAlreadyOnItem = vendorHasItem.has(vendorKey);
      if (nsnIsInAx && vendorAlreadyOnItem) continue; // nothing to add

      const supplierSku = line.vendor_item_number || "";
      if (!supplierSku) continue; // can't create NPI row without a supplier SKU

      const mode: "new-item" | "add-supplier" = nsnIsInAx ? "add-supplier" : "new-item";
      const itemNumber = mode === "new-item"
        ? generateSku(line.supplier, supplierSku)
        : (line.ax_item_number || generateSku(line.supplier, supplierSku));

      npiRows.push({
        itemNumber,
        description: line.description || "",
        vendor: line.supplier,
        external: supplierSku,
        barcode: line.nsn.replace(/-/g, ""), // AX stores NSN as 13-digit no-dashes
        price: Number(line.unit_cost) || 0,
        mode,
        source_line_id: line.id,
      });
    }
  }

  if (npiRows.length === 0) {
    return NextResponse.json({
      error: "Nothing to put on an NPI sheet. All line items already have their item + vendor in AX, or no supplier SKU was available.",
    }, { status: 400 });
  }

  // Build the xlsx (RawData only — user pastes into their xlsm template
  // and runs the macro to populate the other tabs).
  const wb = new ExcelJS.Workbook();
  wb.creator = "DIBS";
  const ws = wb.addWorksheet("RawData");
  ws.addRow(["Item#", "Description", "Vendor", "External", "BarcodeValue", "Price"]);
  for (const r of npiRows) {
    ws.addRow([r.itemNumber, r.description, r.vendor, r.external, r.barcode, r.price]);
  }
  ws.columns.forEach((c) => (c.width = 22));

  // Also add a "_DIBS_Notes" sheet with mode + source line traceability
  // so operators know which rows are new-item vs add-supplier, and
  // DIBS-side audit can be done later.
  const notes = wb.addWorksheet("_DIBS_Notes");
  notes.addRow(["Item#", "Mode", "DIBS po_line.id", "NSN", "Supplier"]);
  for (const r of npiRows) {
    notes.addRow([r.itemNumber, r.mode, r.source_line_id, r.barcode, r.vendor]);
  }
  notes.columns.forEach((c) => (c.width = 18));

  // Log for audit
  await supabase.from("sync_log").insert({
    action: "npi_generated",
    details: {
      user: user.profile?.full_name || user.user.email,
      po_ids: poIds,
      rows: npiRows.length,
      new_items: npiRows.filter((r) => r.mode === "new-item").length,
      add_suppliers: npiRows.filter((r) => r.mode === "add-supplier").length,
    },
  });

  const buf = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  const todayIso = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Blob([buf as BlobPart]), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dibs-npi-${todayIso}.xlsx"`,
      "X-Rows": String(npiRows.length),
      "X-New-Items": String(npiRows.filter((r) => r.mode === "new-item").length),
      "X-Add-Suppliers": String(npiRows.filter((r) => r.mode === "add-supplier").length),
    },
  });
}
