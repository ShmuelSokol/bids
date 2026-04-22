# Flow: AX Purchase Order Write-Back

**Built + wired as of 2026-04-22.** Flow A (DIBS generates header + lines DMF workbooks, AX auto-assigns PO#) is implemented. NPI is a separate precondition flow (see `docs/npi-workflow.md`).

UI entry: `/orders` POs tab, per-PO action buttons + bulk toolbar. State machine in `purchase_orders.dmf_state`:

```
drafted → awaiting_po_number → lines_ready → awaiting_lines_import → posted
```

Transitions:
- `drafted` → `awaiting_po_number`: `POST /api/orders/submit-po-header` uploads header xlsx, marks state.
- `awaiting_po_number` → `lines_ready`: `POST /api/orders/poll-ax-po-number` reads AX `PurchaseOrderHeadersV2?$filter=VendorOrderReference eq '<ax_correlation_ref>'` and writes `ax_po_number`.
- `lines_ready` → `awaiting_lines_import`: `POST /api/orders/submit-po-lines` uploads lines xlsx.
- `awaiting_lines_import` → `posted`: `POST /api/orders/check-ax-lines` polls `PurchaseOrderLinesV2?$filter=PurchaseOrderNumber eq '<ax_po_number>'` and confirms line count.

Operator then clicks "Send Confirmation" in AX; Dynamics emails PDF to vendor. DIBS' job ends at `posted`.

## Architecture locked 2026-04-15 — Flow A

See `docs/meeting-2026-04-15.md` for the full meeting decisions. Summary:

- **Two separate DMF imports**: header first, then lines. NOT a single bundled workbook.
- **Header import uses the "auto-generate PO number" DMF checkbox** — AX assigns numbers from its own UI sequence. DIBS does NOT supply PO numbers.
- Between the two imports, DIBS polls AX via OData to learn the assigned PO numbers, then generates the lines file with those numbers + line numbers filled in.
- Yosef is setting up two named DMF projects in Abe's AX account — one for header, one for lines — so Abe runs them without touching the underlying entity mapping.
- **DO NOT unchecked that auto-generate checkbox.** Whole thing breaks if it gets manually turned off.

Flow-A sequence per batch of DIBS POs:
1. DIBS generates **header.xlsx** — one row per PO with vendor + ship-to + a DIBS correlation tag in some field that AX will preserve (candidate: `VendorOrderReference` or a custom ref field — needs confirmation)
2. Abe runs the "PO Header" DMF project in AX with that file → AX creates headers, assigns PO numbers
3. DIBS polls `PurchaseOrderHeadersV2?$filter=<correlation tag>` → pulls back the assigned `PurchaseOrderNumber`s
4. DIBS generates **lines.xlsx** — `PURCHASEORDERNUMBER` (from step 3), `LINENUMBER` (sequential), `ITEMNUMBER`, `ORDEREDPURCHASEQUANTITY`, `PURCHASEPRICE`, `PURCHASEUNITSYMBOL`, `RECEIVINGWAREHOUSEID='W01'`
5. Abe runs the "PO Lines" DMF project → AX creates lines linked to the headers
6. DIBS polls `PurchaseOrderLinesV2?$filter=PurchaseOrderNumber eq <n>` → flips DIBS state to `posted`

After that, Abe selects the new POs and clicks **Send Confirmation** in the AX UI — Dynamics emails the PDF to the vendor using the vendor's stored email address. **Don't rebuild this in DIBS**; Dynamics already has it.

## Architectural pivot (2026-04-15, from Yosef)

The OData service principal DIBS uses is **read-only.** No POST, PUT, PATCH on PurchaseOrderHeaders / Lines / ReleasedProducts / etc. That kills every "just POST to AX" plan. Yosef's established pattern across his projects is:

1. DIBS generates spreadsheets in the exact format AX's **Data Management Framework** (DMF) imports expect
2. Yosef (or Abe) downloads the file, uploads it into AX DMF, runs the import
3. DIBS then polls AX via OData READ to confirm the rows landed and pick up auto-assigned identifiers (PO numbers, etc.)
4. DIBS UI shows "Pending / Posted" status per PO

### PO-number reality (clarified 2026-04-15 ssokol, round 2)

AX's DMF **can** accept operator-supplied PO numbers on the header import — Yosef's Amazon flow just doesn't set it up that way (he creates headers in the UI instead). For DIBS, that means the cleaner end-to-end "DIBS generates everything, Yosef imports, done" path is available if we want it.

**Two viable flows** — decide with Yosef which to implement first:

**Flow A — fully generated (preferred):**

1. DIBS generates `<PO-number>` per would-be PO in its own numeric range (or a prefix like `PO-DIBS-<n>`) to avoid colliding with the AX auto-number sequence
2. DIBS generates a header sheet + lines sheet (2-sheet workbook, or two separate files — TBD by DMF processing order)
3. Yosef imports the workbook in AX
4. DIBS polls `/data/PurchaseOrderHeadersV2?$filter=PurchaseOrderNumber eq '<our-number>'` → sees it → flips state to `posted`

**Flow B — operator-created header (what Yosef does for Amazon):**

1. DIBS shows "ready to create" card with vendor + ship-to + total
2. Operator creates header in AX UI (AX auto-assigns number, e.g. `PO014330`)
3. Operator pastes PO number back into DIBS (or DIBS auto-detects by polling for new headers matching vendor + date)
4. DIBS generates the lines-only DMF sheet with that PO number
5. Operator imports lines via DMF; DIBS polls and flips state

Flow A takes one less manual step per PO but requires the header DMF template + Yosef's blessing on the PO-number pattern. Flow B is what Yosef already knows.

### Generators in scope

- **PO header sheet** (Flow A only, if chosen)
- **PO lines sheet** — always; single-sheet 7-col `Purchase_order_lines_V2`
- **NPI multi-sheet workbook** — conditional on items that need to be released in AX first
- **Sales orders (government-flow)** — need template from Yosef

## Scope (revised)

For each ready-to-fulfill batch of awards in DIBS:

1. **Sales order sheet** — one row per award line, in the government-flow template. Yosef imports → AX creates SOs and returns SO numbers. DIBS polls + displays.
2. **NPI sheet (conditional)** — for any line whose `ItemNumber` isn't in AX yet, DIBS generates the multi-entity product-release workbook first. Yosef imports. DIBS re-polls AX for the new items, then the PO flow can proceed.
3. **PO (Flow A or B — per Yosef's choice)** — see PO-number reality section above.
4. DIBS UI per-PO state (depending on flow):
   - Flow A: `drafted` → `workbook_ready` → `awaiting_import` → `posted`
   - Flow B: `ready_for_ax_header` → `awaiting_po_number` → `lines_generated` → `awaiting_lines_import` → `posted`
5. Vendor transmission (EDI / email / portal) remains manual per Yosef — DIBS' job ends at `posted`.

## Working assumptions (updated 2026-04-15 after recon)

Graded by stability:

- **S** = observed directly in the recon sample (`scripts/reverse-engineer-ax-po-schema.ts`, 50 recent POs + 143 lines)
- **L** = likely based on the sample or standard AX behavior
- **G** = still a guess; needs verification

### Entities + fields

1. **[S] PO headers live in `PurchaseOrderHeadersV2`** (plural). Cross-company supported.
2. **[S] `PurchaseOrderLinesV2` carries** `ItemNumber`, `PurchasePrice`, `PurchaseUnitSymbol`, `PurchasePriceQuantity`, `Barcode`, `BarCodeSetupId`, `OrderedPurchaseQuantity`, `LineDescription`, `LineNumber`. No vendor field — vendor is on the header.
3. **[S] AX auto-generates the PO number.** Confirmed: 50 headers returned 50 distinct `PurchaseOrderNumber` values with no gaps in the normal-sequence range. POST without one, read it back from the response.
4. **[S] Company / legal entity** is `szyh`. Every sampled header had `dataAreaId='szyh'`.

### Header fields — what's actually populated (from 50-row sample)

Constants across all sampled POs (hardcode on insert):

- **[S]** `CurrencyCode='USD'`
- **[S]** `DefaultReceivingSiteId='S01'`
- **[S]** `PurchaseOrderPoolId='DOM'`
- **[S]** `PurchaseOrderHeaderCreationMethod='Purchase'`
- **[S]** `SalesTaxGroupCode='NY-Exempt'`
- **[S]** `VendorPaymentMethodName='Check'`
- **[S]** `VendorPostingProfileId='ALL'`
- **[S]** `LanguageId='en-US'`
- **[S]** `InvoiceType='Invoice'`
- **[S]** `DeliveryAddressCountryRegionId='USA'`
- **[S]** `IsOneTimeVendor='No'` + `IsDeliveredDirectly='No'` + `IsChangeManagementActive='No'`

Small-set (2-5 values — depends on vendor/warehouse):

- **[S]** `DefaultReceivingWarehouseId` — `W01` or `W03`
- **[S]** `DeliveryAddressLocationId` — `000000203` (SZY Brooklyn) or `000011805` (SZY New NJ)
- **[S]** `DeliveryAddressDescription` — `SZY Brooklyn` or `SZY New NJ`
- **[S]** `DeliveryAddressStreet` / `City` / `StateId` / `ZipCode` — follow from `DeliveryAddressDescription`
- **[S]** `PaymentTermsName` — `PPD`, `N30`, `N14`, `N7`, `N60` (driven by vendor master; we can likely let it default)
- **[S]** `DocumentApprovalStatus` — `Confirmed` or `Approved` in the sample; see State section below

Variable (we supply per-PO):

- **[S]** `OrderVendorAccountNumber` — `ZHEJIA`, `HAEMON`, `MEDPLU`, etc. 31 distinct across 50 POs → this IS the AX vendor code (short form, not DUNS).
- **[S]** `PurchaseOrderName` — human-readable vendor name, 31 distinct. Likely auto-populated from vendor master.
- **[S]** `InvoiceVendorAccountNumber` — same 31 distinct; matches `OrderVendorAccountNumber` in sample.

User attribution:

- **[S]** `OrdererPersonnelNumber='000001'` + `RequesterPersonnelNumber='000001'` — same employee on all 50. Likely "the AX integration user." Safe to hardcode.

### Line fields — what's actually populated

Constants across all sampled lines:

- **[S]** `CustomerRequisitionNumber='DD219'` — **this is the DLA government customer code** (matches memory). Every PO line carries it.
- **[S]** `PurchaseOrderLineCreationMethod='Purchase'`
- **[S]** `CalculateLineAmount='Yes'`
- **[S]** `SalesTaxGroupCode='NY-Exempt'`
- **[S]** `SalesTaxItemGroupCode='Taxable'`
- **[S]** `VendorInvoiceMatchingPolicy='ThreeWayMatch'`
- **[S]** `OrderedInventoryStatusId='Available'`

Variable (we supply):

- **[S]** `ItemNumber` — 127 distinct of 143 lines.
- **[S]** `OrderedPurchaseQuantity`, `PurchasePrice`, `PurchaseUnitSymbol`, `LineDescription`.
- **[S]** `LineNumber` — we assign sequentially.

Inherits from header (don't set on line):

- **[L]** `DeliveryAddress*` fields — all populated on lines in the sample, but they match the header → AX is denormalizing. On insert we can probably omit and AX will backfill.
- **[L]** `ExternalItemNumber` — often equals `ItemNumber` on sampled lines. Optional.

### Barcode / NSN on the line

- **[S]** `Barcode` and `BarCodeSetupId` are **null on every sampled line**. Warehouse isn't populating them today. If we want NSN-scannable receiving, we'd populate `Barcode=<nsn-digits>` + `BarCodeSetupId='NSN'` on each line. Worth doing but optional.

### State fields + confirm/post step

- **[S]** `WorkflowState` on lines is `'NotSubmitted'` constant in sample. This field likely controls submission-workflow routing; safe to omit on insert.
- **[S]** `DocumentApprovalStatus` on headers: `Confirmed` (most) or `Approved` (rest). **We didn't see any `Draft` or `NotApproved` values** — either (a) OData filters them out, (b) our sample only returned confirmed ones, or (c) the tenant auto-confirms. Need to check how a draft POST will behave.
- **[S]** `PurchaseOrderStatus`: `Backorder` (most — means open, not yet received), `Invoiced`, `Received`, `Canceled`. These are post-confirm lifecycle states. On insert we likely don't set this; AX sets `Backorder` after Confirm.
- **[S]** `PurchaseOrderLineStatus`: matches — `Backorder` for open lines, `Received`/`Invoiced` for closed.
- **[G]** To transition Draft → Confirmed, AX exposes a bound action (e.g., `Microsoft.Dynamics.DataEntities.confirmOrder` or similar). Needs probing — the recon sample doesn't show the action name. The standard pattern is `POST .../PurchaseOrderHeadersV2(dataAreaId='szyh',PurchaseOrderNumber='X')/Microsoft.Dynamics.DataEntities.confirmOrder`.
- **[L]** Our OAuth service principal may lack permission to call Confirm. Fallback: stop at Draft, human confirms in AX UI.

## Standing questions (for Yosef / the AX admin)

When we get answers, come back here and mark each with **[ANSWERED]** + the answer.

**[ANSWERED 2026-04-15 from recon]** 1. Legal entity is `szyh` — all 50 sampled POs. Single LE.
**[ANSWERED 2026-04-15 from recon]** 2. AX auto-numbers POs — 50 distinct `PurchaseOrderNumber` values returned, sequential in the normal range.
**[ANSWERED 2026-04-15 from recon]** 6. Currency is constant `USD`.
**[ANSWERED 2026-04-15 from recon]** 10. Cross-company works (`?cross-company=true` on the recon succeeded).
**[ANSWERED 2026-04-15 ssokol]** 4. Warehouse is always `W01` (Brooklyn). No per-item/per-vendor routing to W03 NJ for DIBS-generated POs.
**[ANSWERED 2026-04-15 ssokol]** 12. AX does NOT auto-send to vendors after Confirm. Some vendors have portals (operator re-enters the PO in their web UI), others receive by email. So DIBS' job ends at Confirm; Abe/Yosef handles per-vendor transmission manually.

**[NEW 2026-04-15 from ssokol]** Gap identified: some items being purchased aren't yet set up in AX. We need an "NPI" (New Product Import) procedure — when a DIBS PO line's NSN/item doesn't exist in AX, create it before the PO can land. Needs its own sub-flow (product master + vendor-item-link + UoM conversion rules). Out of scope for phase 2; add as a phase 2.5 prerequisite.

Still open (see "Questions for Yosef" below — these are the renumbered, plain-English versions you can paste into a message).

## DMF template specs (from Yosef's 4-13-26 workbooks)

### Purchase order lines — `Purchase_order_lines_V2`

Single-sheet workbook. 7 columns, all required:

| # | Column                    | Sample         | Source in DIBS                               |
|---|---------------------------|----------------|----------------------------------------------|
| 1 | PURCHASEORDERNUMBER       | `PO014330`     | DIBS-generated (see open Q3 below)           |
| 2 | LINENUMBER                | `1`, `2`, ...  | sequential within PO                         |
| 3 | ITEMNUMBER                | `UNF159433-2`  | `po_lines.vendor_item_number` (from AX)      |
| 4 | ORDEREDPURCHASEQUANTITY   | `12`           | `po_lines.quantity`                          |
| 5 | PURCHASEPRICE             | `5.64`         | `po_lines.unit_cost`                         |
| 6 | PURCHASEUNITSYMBOL        | `ea`           | `po_lines.unit_of_measure` lowercased        |
| 7 | RECEIVINGWAREHOUSEID      | `W03`          | `W01` for DIBS POs (confirmed by Yosef)      |

Observation: the sample uses `W03` because it's an Amazon consumer-fulfillment PO. DIBS-side will always stamp `W01`. UoM is lowercase in the template — we'll need to downcase our `EA/PG/PK/BX` values.

**Still needed**: the matching PO HEADER template (Yosef referenced "2 imports, headers and lines" in his voice note — we only have lines so far).

### New Product Import — 7-sheet workbook

Sheet names observed: `RawData`, `RPCreate`, `RPV2`, `APPROVEDVENDOR`, `EXTERNALITEMDESC`, `BarCode`, `TradeAgreement`.

**`RawData`** — Yosef's working sheet; not imported to AX. Becomes the source that DIBS's generator can mirror to stay in his mental model. 6 cols: `Item#`, `Description`, `Vendor`, `External`, `BarcodeValue`, `Price`.

**`RPCreate`** — 16 cols. Constants in sample (hardcode for DIBS items unless noted):
- `BOMUNITSYMBOL` / `INVENTORYUNITSYMBOL` / `PURCHASEUNITSYMBOL` / `SALESUNITSYMBOL` = `EA` (uppercase here, unlike on PO lines)
- `INVENTORYRESERVATIONHIERARCHYNAME` = `Warehouse`
- `ITEMMODELGROUPID` = `FIFO-Stock`
- `PRODUCTGROUPID` = `FG-NonRX` — **open question**: right product group for DIBS/DLA medical items?
- `PRODUCTSUBTYPE` = `Product`
- `PRODUCTTYPE` = `Item`
- `STORAGEDIMENSIONGROUPNAME` = `SiteWHLoc`
- `TRACKINGDIMENSIONGROUPNAME` = `None`

Variable (per item):
- `ITEMNUMBER`, `PRODUCTNUMBER` — identical in sample; pattern like `EMW48178`
- `PRODUCTNAME`, `PRODUCTSEARCHNAME`, `SEARCHNAME` — all three get the same long description in sample

**`RPV2`** — 5 cols. Constants:
- `DEFAULTORDERTYPE` = `Purch`
- `PRODUCTCOVERAGEGROUPID` = `Req.`
- `RAWMATERIALPICKINGPRINCIPLE` = `OrderPicking`
- `UNITCONVERSIONSEQUENCEGROUPID` = `EA Only`

Variable: `ITEMNUMBER` (matches RPCreate).

**`APPROVEDVENDOR`** — 2 cols: `APPROVEDVENDORACCOUNTNUMBER`, `ITEMNUMBER`. One row per (item, vendor) pair.

**`EXTERNALITEMDESC`** — 3 visible col headers but 4 columns of data in rows (the 4th col has barcodes but no header in row 1 — appears to be a template bug or DMF consumes it positionally): `ITEMNUMBER`, `VENDORACCOUNTNUMBER`, `VENDORPRODUCTNUMBER`, `[unnamed=barcode]`.

**`BarCode`** — 6 cols: `ITEMNUMBER`, `BARCODESETUPID` (sample=`UPC` — DIBS would use `NSN` for gov items), `BARCODE`, `ISDEFAULTSCANNEDBARCODE` (`Yes`), `PRODUCTQUANTITY` (`1`), `PRODUCTQUANTITYUNITSYMBOL` (`EA`).

**`TradeAgreement`** — 14 cols, mostly empty in sample (1 row). Use only when a locked-in vendor price agreement needs to land in AX simultaneously: `TRADEAGREEMENTJOURNALNUMBER`, `LINENUMBER`, `ITEMNUMBER`, `PRICE`, `PRICEAPPLICABLEFROMDATE`, `PRICEAPPLICABLETODATE`, `PRICECURRENCYCODE`, `PRICESITEID`, `PURCHASEPRICEQUANTITY`, `QUANTITYUNITSYMBOL`, `TOQUANTITY`, `VENDORACCOUNTNUMBER`, `WILLDELIVERYDATECONTROLDISREGARDLEADTIME`, `WILLSEARCHCONTINUE`.

## Questions for Yosef

The big architectural fork at the top; everything else is detail:

1. **Flow A or Flow B?** (see "PO-number reality" above)
   - A = DIBS generates PO number + header sheet + lines sheet; you import the whole thing.
   - B = You create the header in AX UI (AX auto-numbers); DIBS generates lines-only once you hand back the number.

   A is one less manual step per PO, but only works if (a) you're OK with DIBS-supplied PO numbers in your AX PO sequence, (b) you share the header DMF template, and (c) DMF processes header-then-lines in a single bundle correctly.

2. **If Flow A:**
   - (a) Can you share the PO headers DMF template — entity/sheet name, column list, and one sample row?
   - (b) What pattern should DIBS use for PO numbers to avoid colliding with AX's auto-number sequence — its own numeric range, or a prefix like `DIBS-<n>` / `PO-DIBS-<n>`?
   - (c) When DMF imports a workbook with header sheet + lines sheet, does it process them in the right order (header first, then lines referencing the header) automatically, or do you have to import them as separate DMF jobs?

3. **If Flow B, auto-detect or paste-back?** After you create a new PO in AX manually:
   - (a) Paste the AX-assigned PO number back into DIBS (simple — DIBS shows a small input box per pending PO)
   - (b) DIBS auto-detects by polling `/data/PurchaseOrderHeadersV2` for new entries matching the expected vendor + today's date + rough line count, and suggests the match for you to confirm

4. **Sales order template.** Need the government-flow SO template — a recent example + column list unblocks that whole side of scope. (Applies regardless of Flow A vs B.)

5. **DIBS vendor coverage in AX.** Our vendor codes (`AMAZON`, `000202`, `MCMAST`, `CHEMET`, etc.) — are those all guaranteed to resolve to real `VendorAccountNumber`s in AX? If not, DIBS should pre-flight via OData read before showing the "ready to push" card so missing vendors surface in DIBS before you step into AX.

6. **Product group for DIBS items.** NPI sample uses `PRODUCTGROUPID = FG-NonRX`. Right for DLA / NSN medical items, or a different group (e.g. `FG-MIL`, `FG-GOV`)?

7. **`EXTERNALITEMDESC` 4th column.** Sheet has 3 header labels but every data row has 4 values (4th = barcode). Missing header in the template, or does DMF consume it positionally?

8. **`BarCode` sheet — NSN vs UPC.** Sample uses `BARCODESETUPID=UPC`. For DLA items we'd want `NSN` with NSN digits. Any reason not to, and does warehouse receiving handle NSN-setup barcodes the same way as UPC?

9. **NPI ordering inside one workbook.** Does DMF process the 7 sheets in a guaranteed order on one Import (RPCreate → RPV2 → APPROVEDVENDOR → EXTERNALITEMDESC → BarCode → TradeAgreement), or do you run each sheet as a separate DMF import job?

10. **Polling cadence.** After you click Import, how long until the rows show up via OData? Seconds? 1 min? 5 min?

11. **Partial-failure reporting.** When DMF rejects some rows, is there anything DIBS can read via OData for the rejection list, or does that report live only in AX DMF Execution Details UI?

## Proposed implementation (post-answers)

### Phase 1 — AX entity recon (done)

`scripts/reverse-engineer-ax-po-schema.ts` — sampled 50 POs + 143 lines, classified fields. Output sits in `data/d365/po-*-sample.json`. **Still useful post-pivot**: the "constant fields" table tells us what values to hardcode into the DMF templates regardless of how the data gets to AX.

### Phase 2 — DMF spreadsheet generators (after Yosef shares templates)

Three generators, each behind `--dry-run`:

- `scripts/generate-ax-po-xlsx.ts` — reads DIBS `purchase_orders` + `po_lines` → produces a 2-sheet workbook matching Yosef's PO DMF template. Each PO header row gets a DIBS-tracking reference populated into whichever field answered Q3 (so DIBS can correlate on read-back).
- `scripts/generate-ax-npi-xlsx.ts` — reads DIBS lines whose `ItemNumber` isn't in AX → produces the multi-sheet product-release workbook (Released products + Approved vendors + External descriptions + Trade agreements per Yosef's multi-entity pattern).
- `scripts/generate-ax-so-xlsx.ts` — reads DIBS `awards` → produces the government-flow sales order template.

All three use the existing `exceljs` dep (already in package.json from the PO-export feature).

### Phase 3 — UI surface on /orders

For each state the PO can be in:

- **drafted** — DIBS generated the row but Yosef hasn't pulled the file yet. Button: "Download DMF workbook". Label changes based on whether NPI is needed first.
- **awaiting_import** — workbook downloaded. Small hint: "Import in AX; DIBS will detect posting automatically." Manual button "Mark as imported" to trigger polling early.
- **posted** — DIBS has polled AX and seen the PO number. Label "AX: `<po_number>`".
- **import_error** — if polling finds the row never landed after N minutes, surface as error with a "Download again" action.

### Phase 4 — Polling infrastructure

Background job (Windows Task Scheduler, every 5 min): for DIBS POs in `awaiting_import` state, query `/data/PurchaseOrderHeadersV2` filtered by whichever correlation field we chose in Q3. If found, flip state to `posted` and persist the AX PO number. If not found after a time-out window, flip to `import_error`.

### Schema adds on `purchase_orders`

- `ax_po_number text` — AX-assigned PO number after import + read-back
- `ax_correlation_ref text` — the DIBS-generated ID we populate into a DMF column so we can find the row again via OData (value depends on Q3 answer)
- `dmf_state text` — `drafted` | `awaiting_import` | `posted` | `import_error`
- `dmf_last_polled_at timestamptz`
- `dmf_error text` — last error from a polling attempt or from Abe manually reporting

### Schema adds on a new `awards` companion (for sales orders)

TBD after Yosef shares the SO template. Similar shape: `ax_so_number`, `ax_so_correlation_ref`, `dmf_state`, etc.

## Invariants / things that MUST stay true

1. **DIBS never mutates an AX PO after it's been Confirmed.** Once AX owns the record, AX is source of truth. DIBS can read for reporting but not write.
2. **Draft → Confirmed is ONE direction.** If Abe wants a PO un-confirmed, that happens in AX, not DIBS. Then AX's sync back to our `purchase_orders` table flips the status.
3. **UoM mismatch is already filtered out earlier.** By the time a `purchase_orders` row exists, the PO generator has already routed UoM-mismatch lines to UNASSIGNED — so every line reaching the AX push has matching UoM. AX receives clean data.
4. **One AX PO per Supabase PO.** No merging, no splitting. If a user wants to split, they switch supplier in DIBS first, which changes which Supabase PO the line belongs to.
5. **Idempotency.** The generator's write to `purchase_orders` on success (`ax_po_number`, `status='submitted'`) is the idempotency key. If it gets retried, the first action is to read the row — if `ax_po_number` is already populated, skip.

## Referenced scripts (to exist)

- `scripts/reverse-engineer-ax-po-schema.ts` — phase 1 recon
- `scripts/generate-ax-po-json.ts` — phase 2 dry-run generator
- `src/app/api/orders/push-to-ax/route.ts` — phase 3 UI backend

## Referenced fields in Supabase

- `purchase_orders` — id, po_number, supplier, status, total_cost, line_count, created_by (+ new: ax_po_number, ax_po_internal_id, ax_error)
- `po_lines` — nsn, description, quantity, unit_of_measure, unit_cost, total_cost, supplier, contract_number, order_number, fob, required_delivery, cost_source, vendor_item_number
- `nsn_costs.vendor` — the AX vendor account (used as supplier on `purchase_orders`)
