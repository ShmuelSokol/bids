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

  // Gather NSNs to check against cached AX data.
  const allNsns = [...new Set((pos || []).flatMap((p: any) => (p.po_lines || []).map((l: any) => l.nsn).filter(Boolean)))];
  const { data: catalog } = await supabase.from("nsn_catalog").select("nsn, source").in("nsn", allNsns);
  const axItemByNsn = new Map<string, string>();  // nsn → existing AX ItemNumber (from nsn_catalog.source)
  for (const c of catalog || []) {
    const m = /^AX:(.+)$/.exec((c.source || "").trim());
    if (m) axItemByNsn.set(c.nsn, m[1].trim());
  }

  const { data: vpBySnv } = await supabase
    .from("nsn_ax_vendor_parts")
    .select("nsn, vendor_account, ax_item_number")
    .in("nsn", allNsns);
  const vendorHasItem = new Set<string>();
  for (const v of vpBySnv || []) {
    vendorHasItem.add(`${v.nsn}__${(v.vendor_account || "").trim().toUpperCase()}`);
  }

  // UPC lookup — nsn_upc_map is populated from ProductBarcodesV3 and carries
  // the default UPC per item. When present we add a second BarCode row with
  // BARCODESETUPID="UPC" alongside the NSN row.
  const { data: upcMap } = await supabase
    .from("nsn_upc_map")
    .select("nsn, upc")
    .in("nsn", allNsns);
  const upcByNsn = new Map<string, string>();
  for (const u of upcMap || []) {
    if (u.upc) upcByNsn.set(u.nsn, String(u.upc).trim());
  }

  // Current AX cost per NSN (primary vendor). Used to decide whether a
  // TradeAgreement row is needed — if our cost matches what AX already
  // has for this vendor+NSN, we skip; if different/missing, we include.
  const { data: costsForNsns } = await supabase
    .from("nsn_costs")
    .select("nsn, vendor, cost")
    .in("nsn", allNsns);
  const axCostByKey = new Map<string, number>();
  for (const c of costsForNsns || []) {
    if (c.cost > 0) {
      axCostByKey.set(`${c.nsn}__${(c.vendor || "").trim().toUpperCase()}`, Number(c.cost));
    }
  }

  // Build existing-SKU set for collision checking on generated Item#s.
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

  // Group by NSN first. For each NSN, pick ONE canonical Item# (either the
  // existing AX one, or generate a new one using the alphabetically-first
  // vendor's supplier SKU — so two vendors supplying the same new item
  // share a single AX item record).
  type VendorLine = {
    vendor: string;          // supplier account (e.g. "AMERIB")
    supplierSku: string;     // vendor's part number
    price: number;           // our unit_cost for this line
    lineId: number;          // DIBS po_line.id for audit
    description: string;
    vendorAlreadyOnItem: boolean;
    axCostMatch: boolean;    // true iff AX has this (nsn,vendor) at the same cost
  };
  type NsnGroup = {
    nsn: string;
    barcode: string;         // 13-digit no-dash form of the NSN
    upc?: string;            // default UPC for the item if known (from nsn_upc_map)
    nsnBarcodeInAx: boolean; // does AX already have a BarCode row for this NSN?
    itemNumber: string;      // canonical Item# (existing or newly generated)
    isNewItem: boolean;      // true iff we need to CREATE the AX item (RPCreate + RPV2)
    description: string;
    vendors: VendorLine[];
  };
  const byNsn = new Map<string, NsnGroup>();

  for (const po of pos || []) {
    for (const line of po.po_lines || []) {
      if (!line.nsn || !line.supplier || line.supplier === "UNASSIGNED") continue;
      const supplierSku = line.vendor_item_number || "";
      if (!supplierSku) continue;
      const vendor = String(line.supplier || "").trim().toUpperCase();
      const vKey = `${line.nsn}__${vendor}`;
      const vendorAlreadyOnItem = vendorHasItem.has(vKey);
      const axCost = axCostByKey.get(vKey);
      const axCostMatch = axCost !== undefined && Math.abs(axCost - Number(line.unit_cost || 0)) < 0.005;

      const existing = byNsn.get(line.nsn);
      if (existing) {
        // Dedupe: same NSN+vendor across multiple POs collapses to one entry
        if (existing.vendors.some((v) => v.vendor.toUpperCase() === vendor)) continue;
        existing.vendors.push({
          vendor: line.supplier,
          supplierSku,
          price: Number(line.unit_cost) || 0,
          lineId: line.id,
          description: line.description || "",
          vendorAlreadyOnItem,
          axCostMatch,
        });
        continue;
      }

      byNsn.set(line.nsn, {
        nsn: line.nsn,
        barcode: line.nsn.replace(/-/g, ""),
        upc: upcByNsn.get(line.nsn),
        nsnBarcodeInAx: axItemByNsn.has(line.nsn),
        itemNumber: "", // filled in below
        isNewItem: !axItemByNsn.has(line.nsn),
        description: line.description || "",
        vendors: [{
          vendor: line.supplier,
          supplierSku,
          price: Number(line.unit_cost) || 0,
          lineId: line.id,
          description: line.description || "",
          vendorAlreadyOnItem,
          axCostMatch,
        }],
      });
    }
  }

  // Resolve itemNumber per group: if AX already has the item, use that;
  // else generate from the alphabetically-first vendor's supplier SKU so
  // multiple vendors for the same new NSN share one AX item.
  for (const g of byNsn.values()) {
    const existingItem = axItemByNsn.get(g.nsn);
    if (existingItem) {
      g.itemNumber = existingItem;
      g.isNewItem = false;
    } else {
      g.vendors.sort((a, b) => a.vendor.localeCompare(b.vendor));
      g.itemNumber = generateSku(g.vendors[0].vendor, g.vendors[0].supplierSku);
      g.isNewItem = true;
    }
  }

  // Skip any group where every (vendor,cost) pair is a total no-op:
  // vendor already on item AND cost already matches AND NSN barcode already
  // in AX AND item already in AX. (Everything we'd write is redundant.)
  const groups = [...byNsn.values()].filter((g) => {
    if (g.isNewItem) return true;
    if (!g.nsnBarcodeInAx) return true;
    return g.vendors.some((v) => !v.vendorAlreadyOnItem || !v.axCostMatch);
  });

  if (groups.length === 0) {
    return NextResponse.json({
      error: "Nothing to put on an NPI sheet. Every selected PO line is already fully set up in AX (item exists, supplier on item, cost matches).",
    }, { status: 400 });
  }

  // Build xlsx with all 7 tabs pre-populated. Replicates the output of
  // `ThisWorkbook.runfillinprocedure` VBA (169 lines, extracted 2026-04-22)
  // with dedup + TradeAgreement additions per ssokol 2026-04-22.
  //
  // Dedup rules per sheet:
  //   RPCreate / RPV2 / BarCode — dedup by Item#. Generate once per new
  //     item, even if multiple vendors supply the NSN in this batch.
  //   APPROVEDVENDOR / EXTERNALITEMDESC / TradeAgreement — dedup by
  //     (Item#, Vendor). One row per supplier relationship.
  //
  // BarCode population rule: BarCode row is needed whenever the NSN isn't
  // yet recorded in AX (nsn_catalog), independent of whether the item
  // itself is new. Covers "existing AX item needs a new NSN barcode added."
  //
  // TradeAgreement population rule: include the row only when our cost
  // differs from what AX has recorded for this (NSN, Vendor), or AX
  // has nothing on file. Skip when cost is already matching (within
  // half a cent) — otherwise we'd re-write the same price agreement.
  const wb = new ExcelJS.Workbook();
  wb.creator = "DIBS";

  // 1) RawData — one row per (NSN, Vendor) pair. Matches the xlsm template
  //    shape; informational only for operators who want to re-run the macro.
  const rawData = wb.addWorksheet("RawData");
  rawData.addRow(["Item#", "Description", "Vendor", "External", "BarcodeValue", "Price"]);
  for (const g of groups) {
    for (const v of g.vendors) {
      rawData.addRow([g.itemNumber, g.description, v.vendor, v.supplierSku, g.barcode, v.price]);
    }
  }

  // 2) RPCreate — 16 cols, one row per NEW item (dedup by item#)
  const rpCreate = wb.addWorksheet("RPCreate");
  rpCreate.addRow([
    "ITEMNUMBER", "BOMUNITSYMBOL", "INVENTORYRESERVATIONHIERARCHYNAME", "INVENTORYUNITSYMBOL",
    "ITEMMODELGROUPID", "PRODUCTGROUPID", "PRODUCTNAME", "PRODUCTNUMBER",
    "PRODUCTSEARCHNAME", "PRODUCTSUBTYPE", "PRODUCTTYPE", "PURCHASEUNITSYMBOL",
    "SALESUNITSYMBOL", "SEARCHNAME", "STORAGEDIMENSIONGROUPNAME", "TRACKINGDIMENSIONGROUPNAME",
  ]);
  const rpCreateSeen = new Set<string>();
  for (const g of groups) {
    if (!g.isNewItem) continue;
    if (rpCreateSeen.has(g.itemNumber)) continue;
    rpCreateSeen.add(g.itemNumber);
    rpCreate.addRow([
      g.itemNumber, "EA", "Warehouse", "EA",
      "FIFO-Stock", "FG-NonRX", g.description, g.itemNumber,
      g.description, "Product", "Item", "EA",
      "EA", g.description, "SiteWHLoc", "None",
    ]);
  }

  // 3) RPV2 — 5 cols, dedup by item#
  const rpv2 = wb.addWorksheet("RPV2");
  rpv2.addRow(["ITEMNUMBER", "DEFAULTORDERTYPE", "PRODUCTCOVERAGEGROUPID", "RAWMATERIALPICKINGPRINCIPLE", "UNITCONVERSIONSEQUENCEGROUPID"]);
  const rpv2Seen = new Set<string>();
  for (const g of groups) {
    if (!g.isNewItem) continue;
    if (rpv2Seen.has(g.itemNumber)) continue;
    rpv2Seen.add(g.itemNumber);
    rpv2.addRow([g.itemNumber, "Purch", "Req.", "OrderPicking", "EA Only"]);
  }

  // 4) APPROVEDVENDOR — 2 cols, dedup by (item#, vendor). Skip vendors
  //    already on the item in AX.
  const approved = wb.addWorksheet("APPROVEDVENDOR");
  approved.addRow(["APPROVEDVENDORACCOUNTNUMBER", "ITEMNUMBER"]);
  const approvedSeen = new Set<string>();
  for (const g of groups) {
    for (const v of g.vendors) {
      if (v.vendorAlreadyOnItem) continue;
      const key = `${g.itemNumber}__${v.vendor.toUpperCase()}`;
      if (approvedSeen.has(key)) continue;
      approvedSeen.add(key);
      approved.addRow([v.vendor, g.itemNumber]);
    }
  }

  // 5) EXTERNALITEMDESC — 3 cols, dedup by (item#, vendor)
  const externalItem = wb.addWorksheet("EXTERNALITEMDESC");
  externalItem.addRow(["ITEMNUMBER", "VENDORACCOUNTNUMBER", "VENDORPRODUCTNUMBER"]);
  const extSeen = new Set<string>();
  for (const g of groups) {
    for (const v of g.vendors) {
      if (v.vendorAlreadyOnItem) continue;
      const key = `${g.itemNumber}__${v.vendor.toUpperCase()}`;
      if (extSeen.has(key)) continue;
      extSeen.add(key);
      externalItem.addRow([g.itemNumber, v.vendor, v.supplierSku]);
    }
  }

  // 6) BarCode — 6 cols, dedup by (item#, setup).
  //    NSN row: fire whenever the NSN isn't in AX yet, regardless of whether
  //    the item itself is new. Handles "existing item, new NSN" correctly.
  //    BARCODE column is the 13-digit no-dash NSN (NOT the UPC).
  //    UPC row: emit a second row with BARCODESETUPID="UPC" when we have a
  //    UPC for this NSN in nsn_upc_map. NSN stays default scanned; UPC is
  //    secondary.
  const barcode = wb.addWorksheet("BarCode");
  barcode.addRow(["ITEMNUMBER", "BARCODESETUPID", "BARCODE", "ISDEFAULTSCANNEDBARCODE", "PRODUCTQUANTITY", "PRODUCTQUANTITYUNITSYMBOL"]);
  // UPC row fires alongside the NSN row only — our UPC source is AX's own
  // ProductBarcodesV3 dump, so if the item/NSN is already in AX the UPC
  // is too (emitting it again would be a redundant DMF write).
  const barcodeSeen = new Set<string>();
  let barcodeNsnRows = 0;
  let barcodeUpcRows = 0;
  for (const g of groups) {
    if (g.nsnBarcodeInAx) continue;
    const nsnKey = `${g.itemNumber}__NSN`;
    if (!barcodeSeen.has(nsnKey)) {
      barcodeSeen.add(nsnKey);
      barcode.addRow([g.itemNumber, "NSN", g.barcode, "Yes", "1", "EA"]);
      barcodeNsnRows++;
    }
    if (g.upc) {
      const upcKey = `${g.itemNumber}__UPC__${g.upc}`;
      if (!barcodeSeen.has(upcKey)) {
        barcodeSeen.add(upcKey);
        barcode.addRow([g.itemNumber, "UPC", g.upc, "No", "1", "EA"]);
        barcodeUpcRows++;
      }
    }
  }

  // 7) TradeAgreement — 14 cols, one row per (item#, vendor) where our
  //    cost is missing in AX or doesn't match. Operator fills in the
  //    TRADEAGREEMENTJOURNALNUMBER after creating the journal in AX
  //    (auto-generation of that ID requires the macro's InputBox prompt
  //    or AX-side setup which isn't exposed to DIBS yet).
  const trade = wb.addWorksheet("TradeAgreement");
  trade.addRow([
    "TRADEAGREEMENTJOURNALNUMBER", "LINENUMBER", "ITEMNUMBER", "PRICE",
    "PRICEAPPLICABLEFROMDATE", "PRICEAPPLICABLETODATE", "PRICECURRENCYCODE", "PRICESITEID",
    "PURCHASEPRICEQUANTITY", "QUANTITYUNITSYMBOL", "TOQUANTITY", "VENDORACCOUNTNUMBER",
    "WILLDELIVERYDATECONTROLDISREGARDLEADTIME", "WILLSEARCHCONTINUE",
  ]);
  const tradeSeen = new Set<string>();
  let tradeLineNo = 1;
  for (const g of groups) {
    for (const v of g.vendors) {
      if (v.axCostMatch) continue;              // AX already has the exact cost
      if (!v.price || v.price <= 0) continue;   // no meaningful price to write
      const key = `${g.itemNumber}__${v.vendor.toUpperCase()}__${v.price.toFixed(4)}`;
      if (tradeSeen.has(key)) continue;
      tradeSeen.add(key);
      trade.addRow([
        "",                          // TRADEAGREEMENTJOURNALNUMBER — operator fills in after AX journal is created
        tradeLineNo++,
        g.itemNumber,
        v.price,
        "1900-01-01 00:00:00",
        "1900-01-01 00:00:00",
        "USD",
        "S01",
        1,
        "EA",                        // QUANTITYUNITSYMBOL — default EA (macro computed from pack size; we don't have that field yet)
        ".000000",
        v.vendor,
        "Yes",
        "Yes",
      ]);
    }
  }

  // Audit tab — maps generated rows back to source po_line ids
  const notes = wb.addWorksheet("_DIBS_Notes");
  notes.addRow(["Item#", "NSN", "UPC", "Vendor", "External Part#", "Price", "Scenario", "NSN barcode row?", "UPC barcode row?", "TradeAgreement row?", "DIBS po_line.ids"]);
  for (const g of groups) {
    for (const v of g.vendors) {
      const scenario = g.isNewItem
        ? (v.vendorAlreadyOnItem ? "new-item (first-seen vendor on this item)" : "new-item + new-vendor")
        : (v.vendorAlreadyOnItem ? "existing-item, vendor already in AX, cost mismatch" : "existing-item, add-supplier");
      notes.addRow([
        g.itemNumber, g.barcode, g.upc || "", v.vendor, v.supplierSku, v.price,
        scenario,
        !g.nsnBarcodeInAx ? "yes" : "no",
        (!g.nsnBarcodeInAx && g.upc) ? "yes" : "no",
        (!v.axCostMatch && v.price > 0) ? "yes" : "no",
        String(v.lineId),
      ]);
    }
  }

  for (const ws of [rawData, rpCreate, rpv2, approved, externalItem, barcode, trade, notes]) {
    ws.columns.forEach((c) => (c.width = 20));
  }

  const newItemsCount = groups.filter((g) => g.isNewItem).length;
  const addSupplierCount = groups.reduce((n, g) => n + g.vendors.filter((v) => !v.vendorAlreadyOnItem && !g.isNewItem).length, 0);

  // Log for audit
  await supabase.from("sync_log").insert({
    action: "npi_generated",
    details: {
      user: user.profile?.full_name || user.user.email,
      po_ids: poIds,
      groups: groups.length,
      vendor_relationships: groups.reduce((n, g) => n + g.vendors.length, 0),
      new_items: newItemsCount,
      add_suppliers: addSupplierCount,
      rpcreate_rows: rpCreateSeen.size,
      approvedvendor_rows: approvedSeen.size,
      barcode_nsn_rows: barcodeNsnRows,
      barcode_upc_rows: barcodeUpcRows,
      tradeagreement_rows: tradeSeen.size,
    },
  });

  const buf = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  const todayIso = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Blob([buf as BlobPart]), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dibs-npi-${todayIso}.xlsx"`,
      "X-New-Items": String(newItemsCount),
      "X-Add-Suppliers": String(addSupplierCount),
      "X-RPCreate-Rows": String(rpCreateSeen.size),
      "X-ApprovedVendor-Rows": String(approvedSeen.size),
      "X-Barcode-NSN-Rows": String(barcodeNsnRows),
      "X-Barcode-UPC-Rows": String(barcodeUpcRows),
      "X-TradeAgreement-Rows": String(tradeSeen.size),
    },
  });
}
