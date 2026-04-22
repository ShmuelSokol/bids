# NPI Workflow — new items + add-supplier → AX

When a PO line in DIBS lands on an NSN that AX doesn't know yet, OR on a vendor that isn't set up to supply an existing AX item, we can't push that line to AX as a PO. First we need to register the item (and/or the vendor relationship) in AX. That's what the NPI (New Product Import) sheet does.

## The template

`\\nyevrvdc001\Users\ssokol\Documents\New Product Import Dashboard.xlsm`

It's a macro-enabled workbook with 7 tabs:

- **RawData** — the only one you fill by hand (or from DIBS). 6 cols: `Item# | Description | Vendor | External | BarcodeValue | Price`
- **RPCreate**, **RPV2**, **APPROVEDVENDOR**, **EXTERNALITEMDESC**, **BarCode**, **TradeAgreement** — auto-populated by the macro

`ThisWorkbook.runfillingprocedure` is the macro that reads RawData and fans it out to the other tabs.

## The flow

1. **DIBS generates the RawData rows** per PO (see next section).
2. Operator downloads the xlsx from DIBS.
3. Opens the NPI Dashboard xlsm template.
4. **Pastes the DIBS rows into RawData** (overwriting any existing content). A `_DIBS_Notes` tab in the DIBS download shows mode + source line for each row (traceability — don't paste that one into RawData).
5. Runs the macro: `Developer → Macros → ThisWorkbook.runfillingprocedure`
6. Saves the file as a plain xlsx (drop the macro).
7. Uploads to AX at https://szy-prod.operations.dynamics.com/?cmp=szyh&mi=DM_DataManagementWorkspaceMenuItem. Yosef's one-touch project (setup pending) should handle the multi-tab mapping automatically. Until that's set up, map tab by tab manually.
8. Wait for AX to confirm import success.
9. Back in DIBS, refresh the Orders page — the formerly-red "not in AX" tags on the affected lines turn green (new items appear in AX catalog, vendor relationships land in VendorProductDescriptions).
10. Now the regular "Download Header DMF" / "Download Lines DMF" → "Push to AX" flow works on those POs.

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

## Limits + TODOs

- **Macros aren't preserved by the download.** DIBS generates a plain xlsx with RawData populated. The user has to paste into the xlsm template and run the macro themselves. A future iteration could preserve macros via direct ZIP manipulation (keeping `vbaProject.bin` intact) for a one-click experience. For now, copy/paste is the handoff.
- **Collision check is local-only.** We check against `nsn_catalog.source` + `nsn_ax_vendor_parts.ax_item_number` (both cached from AX). If a SKU was created in AX after our last nightly catalog refresh, we could generate a duplicate. Likelihood is low (~1%) but non-zero; Yosef would see the DMF import error and adjust. A future addition: live OData check against `ReleasedProductsV2` before returning the sheet.
- **AX-side project that accepts the NPI workbook isn't pinned down yet.** Yosef was moving toward a "one-touch" DM project; once that name is confirmed, document it here + link directly to the project URL from DIBS.
- **No "check AX back" loop yet.** DIBS doesn't automatically notice when a new item lands in AX. For now the operator refreshes the Orders page manually; the next `populate-nsn-costs-from-ax` nightly run will update `nsn_catalog`. A real-time check endpoint is a future build.

## Canonical files

- `src/app/api/orders/generate-npi/route.ts` — the generator
- `src/app/orders/awards-list.tsx` — "Generate NPI" button on each PO with unfilled-in AX data
- Template: `\\nyevrvdc001\Users\ssokol\Documents\New Product Import Dashboard.xlsm`
