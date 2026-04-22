# NPI Workflow — new items + add-supplier → AX

When a PO line in DIBS lands on an NSN that AX doesn't know yet, OR on a vendor that isn't set up to supply an existing AX item, we can't push that line to AX as a PO. First we need to register the item (and/or the vendor relationship) in AX. That's what the NPI (New Product Import) sheet does.

## The template

`\\nyevrvdc001\Users\ssokol\Documents\New Product Import Dashboard.xlsm`

It's a macro-enabled workbook with 7 tabs:

- **RawData** — input tab
- **RPCreate**, **RPV2**, **APPROVEDVENDOR**, **EXTERNALITEMDESC**, **BarCode**, **TradeAgreement** — the 6 tabs AX DMF actually imports. In the xlsm template they're filled by the VBA macro `ThisWorkbook.runfillinprocedure` (169 lines, extracted via COM 2026-04-22). **DIBS now runs the same transform directly** so the xlsx it produces has all 7 tabs pre-populated — skip the Excel round-trip entirely.

## The flow

1. **DIBS generates a fully-filled xlsx** (all 7 tabs including RawData + `_DIBS_Notes` audit) via `/api/orders/generate-npi`.
2. Operator downloads it.
3. Upload directly to AX at https://szy-prod.operations.dynamics.com/?cmp=szyh&mi=DM_DataManagementWorkspaceMenuItem. Yosef's one-touch DM project (name pending) should handle the multi-tab mapping. Until that's set up, map tab by tab manually (RPCreate, RPV2, APPROVEDVENDOR, EXTERNALITEMDESC, BarCode — RawData, TradeAgreement, `_DIBS_Notes` are skipped by the import mapping).
4. Wait for AX to confirm import success.
5. Back in DIBS, refresh the Orders page — the formerly-red "not in AX" tags on the affected lines turn green (new items appear in AX catalog, vendor relationships land in VendorProductDescriptions).
6. Now the regular "Submit to AX (Header)" / "Submit to AX (Lines)" flow works on those POs.

## How DIBS builds the RawData rows

For each PO line in the selection:

| Column | Source |
|---|---|
| Item# | Generated AX SKU: first 3 uppercase letters of vendor name + supplier's SKU. E.g., vendor `AMERIB` + supplier SKU `12345678` → `AME12345678`. Collision-checked against cached AX items; if taken, suffix `-2`, `-3`, etc. |
| Description | `po_line.description` (carried from the award's description) |
| Vendor | `po_line.supplier` — the AX vendor account (e.g., `AMERIB`, `BBRAUN`) |
| External | `po_line.vendor_item_number` — the vendor's own part # |
| BarcodeValue | NSN, 13-digit no-dashes format AX expects (e.g., `6509017139629`) |
| Price | `po_line.unit_cost` |

## Two modes per row (DIBS decides automatically)

- **new-item**: NSN not in `nsn_catalog` (AX doesn't know this NSN). All 6 columns get filled. Macro populates RPCreate, RPV2, APPROVEDVENDOR, EXTERNALITEMDESC, BarCode, TradeAgreement.
- **add-supplier**: NSN IS in `nsn_catalog` but `nsn_ax_vendor_parts` doesn't have this `(nsn, supplier)` pair. Same 6 columns, but macro skips RPCreate / RPV2 / BarCode since those sheets would duplicate existing AX data. Only APPROVEDVENDOR + EXTERNALITEMDESC + TradeAgreement get populated.

DIBS tags each row in the `_DIBS_Notes` tab so operators can sanity-check what mode each row lands in.

## Macro transform details (extracted from VBA)

Source: `ThisWorkbook.runfillinprocedure`. Full dump in `scripts/` as extracted on 2026-04-22 via COM automation (after enabling `HKCU:\...\Excel\Security\AccessVBOM=1`).

| Output Sheet | Cols | Defaults (constants) | Source of per-row values |
|---|---|---|---|
| **RPCreate** | 16 | `BOMUNITSYMBOL="EA"`, `INVENTORYRESERVATIONHIERARCHYNAME="Warehouse"`, `INVENTORYUNITSYMBOL="EA"`, `ITEMMODELGROUPID="FIFO-Stock"`, `PRODUCTGROUPID="FG-NonRX"`, `PRODUCTSUBTYPE="Product"`, `PRODUCTTYPE="Item"`, `PURCHASEUNITSYMBOL="EA"`, `SALESUNITSYMBOL="EA"`, `STORAGEDIMENSIONGROUPNAME="SiteWHLoc"`, `TRACKINGDIMENSIONGROUPNAME="None"` | `ITEMNUMBER`, `PRODUCTNUMBER` = RawData.Item#; `PRODUCTNAME`, `PRODUCTSEARCHNAME`, `SEARCHNAME` = RawData.Description |
| **RPV2** | 5 | `DEFAULTORDERTYPE="Purch"`, `PRODUCTCOVERAGEGROUPID="Req."`, `RAWMATERIALPICKINGPRINCIPLE="OrderPicking"`, `UNITCONVERSIONSEQUENCEGROUPID="EA Only"` | `ITEMNUMBER` = RawData.Item# |
| **APPROVEDVENDOR** | 2 | — | `APPROVEDVENDORACCOUNTNUMBER` = RawData.Vendor; `ITEMNUMBER` = RawData.Item# |
| **EXTERNALITEMDESC** | 3 | — | `ITEMNUMBER`, `VENDORACCOUNTNUMBER`, `VENDORPRODUCTNUMBER` = RawData.Item#, Vendor, External |
| **BarCode** | 6 | **NSN row**: `BARCODESETUPID="NSN"`, `ISDEFAULTSCANNEDBARCODE="Yes"`, `PRODUCTQUANTITY="1"`, `PRODUCTQUANTITYUNITSYMBOL="EA"`. **Optional UPC row**: same item#, `BARCODESETUPID="UPC"`, `ISDEFAULTSCANNEDBARCODE="No"`. NSN stays default scanned; UPC is secondary. | NSN row: `ITEMNUMBER`, `BARCODE` = Item#, 13-digit NSN (dashes stripped). UPC row: sourced from `nsn_upc_map` (populated from AX ProductBarcodesV3 — see `scripts/populate-nsn-upc-map.ts`). UPC row only emits alongside an NSN row (if AX already has the NSN, it has the UPC too). |
| **TradeAgreement** | 14 | `PRICECURRENCYCODE="USD"`, `PRICESITEID="S01"`, `PURCHASEPRICEQUANTITY=1`, `QUANTITYUNITSYMBOL="EA"`, `TOQUANTITY=".000000"`, `PRICEAPPLICABLEFROM/TODATE="1900-01-01 00:00:00"`, `WILLDELIVERYDATECONTROLDISREGARDLEADTIME="Yes"`, `WILLSEARCHCONTINUE="Yes"`, `TRADEAGREEMENTJOURNALNUMBER=""` (operator fills in after creating journal in AX) | `ITEMNUMBER`, `PRICE`, `VENDORACCOUNTNUMBER` from PO line; `LINENUMBER` sequential |

**add-supplier mode** (NSN already in AX, just adding a new vendor): DIBS writes rows only into APPROVEDVENDOR + EXTERNALITEMDESC. RPCreate, RPV2, BarCode stay headers-only. Matches the macro's behavior when RawData rows have the Item# already present in AX.

## Limits + TODOs

- **Collision check is local-only.** We check against `nsn_catalog.source` + `nsn_ax_vendor_parts.ax_item_number` (both cached from AX). If a SKU was created in AX after our last nightly catalog refresh, we could generate a duplicate. Likelihood is low (~1%) but non-zero; Yosef would see the DMF import error and adjust. Future: live OData check against `ReleasedProductsV2` before returning the sheet.
- **AX-side DM project name isn't pinned down yet.** Yosef was moving toward a "one-touch" DM project that auto-maps all 6 import tabs. Until that's confirmed, operators map each tab manually per import.
- **No "check AX back" loop yet.** DIBS doesn't automatically notice when a new item lands in AX. The operator refreshes the Orders page manually; the next `populate-nsn-costs-from-ax` nightly run updates `nsn_catalog`. Future: real-time check endpoint.

## Dedup rules

Different sheets dedup at different grains because AX's DMF expects different import keys per entity.

| Sheet | Dedup grain | Why |
|---|---|---|
| RawData | none — all rows kept | informational audit of every (NSN, Vendor) pair in the selection |
| RPCreate | Item# | one item master record regardless of vendor count |
| RPV2 | Item# | one item master record regardless of vendor count |
| APPROVEDVENDOR | (Item#, Vendor) | one supplier relationship per item; skipped if already in AX |
| EXTERNALITEMDESC | (Item#, Vendor) | one external part# per (item, vendor); skipped if already in AX |
| BarCode | (Item#, SetupID) | one NSN row per item + optional one UPC row per item |
| TradeAgreement | (Item#, Vendor, Price) | emit only when AX cost is missing or diverges >$0.005 |

## When each sheet fires

| Sheet | Trigger |
|---|---|
| RPCreate, RPV2 | Item doesn't exist in AX yet (new item) |
| APPROVEDVENDOR, EXTERNALITEMDESC | Vendor not yet in `nsn_ax_vendor_parts` for this NSN |
| BarCode (NSN) | NSN not yet in `nsn_catalog` — fires even for existing items that just need a new NSN barcode |
| BarCode (UPC) | UPC present in `nsn_upc_map` AND the NSN row is also firing (prevents redundant writes when AX already has both) |
| TradeAgreement | Our cost differs from `nsn_costs` for (NSN, Vendor), OR AX has nothing on file |

## Canonical files

- `src/app/api/orders/generate-npi/route.ts` — the generator
- `src/app/orders/awards-list.tsx` — "Generate NPI" button on each PO with unfilled-in AX data
- `scripts/populate-nsn-upc-map.ts` — backfills `nsn_upc_map` from cached `data/d365/barcodes.json`. Run whenever AX barcodes are refreshed.
- Template: `\\nyevrvdc001\Users\ssokol\Documents\New Product Import Dashboard.xlsm`
