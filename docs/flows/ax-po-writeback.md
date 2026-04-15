# Flow: AX Purchase Order Write-Back (proposed)

Not built. This page is the spec + working assumptions.

## Architectural pivot (2026-04-15, from Yosef)

The OData service principal DIBS uses is **read-only.** No POST, PUT, PATCH on PurchaseOrderHeaders / Lines / ReleasedProducts / etc. That kills every "just POST to AX" plan. Yosef's established pattern across his projects is:

1. DIBS generates spreadsheets in the exact format AX's **Data Management Framework** (DMF) imports expect
2. Yosef (or Abe) downloads the file, uploads it into AX DMF, runs the import
3. DIBS then polls AX via OData READ to confirm the rows landed and pick up auto-assigned identifiers (PO numbers, etc.)
4. DIBS UI shows "Pending / Posted" status per PO

This means three separate spreadsheet generators, one per AX entity group:

- **PO headers + lines** (2-sheet import)
- **New product release** (multi-entity: Released products + Approved vendors + External item descriptions + possibly Trade agreements)
- **Sales orders** (government-flow specific — different from the vendor-facing template Yosef had originally designed)

Same "dry-run first, Yosef reviews, then we generate per-PO" phased rollout as bid/invoice chains, but the "execute" step is Yosef clicking Import in AX rather than DIBS firing an API call.

## Scope (revised)

For each ready-to-fulfill batch of awards in DIBS:

1. **Sales order sheet** — one row per award line, in the government-flow template. Yosef imports → AX creates SOs and returns SO numbers. DIBS polls + displays.
2. **NPI sheet (conditional)** — for any line whose `ItemNumber` isn't in AX yet, DIBS generates a multi-entity product-release workbook first. Yosef imports. DIBS re-polls AX for the new items, then generates the PO sheet.
3. **PO header + PO lines sheets** — one row per DIBS-generated PO header, one row per line. Yosef imports → AX creates draft POs, assigns numbers, returns them. DIBS polls + displays with AX PO #.
4. DIBS UI shows per-PO state: `drafted` → `awaiting_import` → `posted`. `posted` means DIBS has seen the AX PO number in its read-back.
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

## Questions for Yosef (revised for DMF-spreadsheet plan)

Context to include when sending:

> From your voice note — you confirmed the service principal is read-only and you import via DMF spreadsheets. That changes the whole write-back design from "DIBS POSTs to AX OData" to "DIBS generates the DMF template, you import." I've reframed the open questions below around the spreadsheet format specifically — most of the old API-side concerns go away.

1. **DMF template files.** Can you share the exact template spreadsheets you use today for each of these imports — column headers, sample rows, any special formatting (dates, percentages, required empty columns)?
   - Purchase order headers
   - Purchase order lines
   - Released products (NPI — new product release)
   - Approved vendors
   - External item descriptions
   - Trade agreements (if you use it for DIBS-type items)
   - Sales orders (government-flow)
   If there's a Git repo or shared folder, a link is fine.

2. **Data entity names per sheet.** When you configure the DMF import, each sheet maps to a specific data entity (e.g., `Purchase order headers V2`). Can you list the exact entity name per template? That gets baked into DIBS' polling logic so we know what OData entity to read back from.

3. **Key fields for read-back correlation.** When DIBS generates a PO row in the header sheet, it needs to recognize that row AFTER your import assigns a PO number. What field(s) can DIBS populate that will (a) round-trip into AX and (b) be readable via OData so DIBS can match imported→posted rows? Candidates: `VendorOrderReference`, `PurchaseOrderName`, a custom field, or an "External reference" column on the template.

4. **Unit of measure conventions in the template.** Our source data uses `EA / PG / PK / BX`. AX shows `ea / B1000 / ...`. In YOUR DMF templates specifically, what's the column name and expected casing — `Purchase unit` in lowercase `ea`, `PurchaseUnitSymbol` matching AX's enum? Does DMF normalize, or will `EA` vs `ea` fail import?

5. **Vendor reconciliation.** Our DIBS vendor data (~34K rows) holds codes like `AMAZON`, `000202`, `MCMAST`, `CHEMET`. Are all of those guaranteed to exist as `VendorAccountNumber`s in AX? If some don't, does your DMF flow catch it (per-row error) or silently drop them? We may need a pre-flight validation step against `/data/Vendors`.

6. **Payment terms per vendor.** The template presumably has a `PaymentTermsName` column. If DIBS leaves it blank, will DMF pull the default from the vendor master on import, or error? If we have to fill it, should DIBS query AX's vendor master first to copy the default, or do you have a lookup table?

7. **NPI gating.** For lines whose item doesn't exist in AX, the order of operations is:
   (a) DIBS generates the NPI multi-sheet workbook
   (b) You import it; AX creates the released product
   (c) DIBS re-polls AX until the new `ItemNumber` shows up
   (d) DIBS then generates the PO lines with those now-real item numbers
   Does that match how you'd want it? Alternative: DIBS generates one combined workbook with NPI sheets AND PO sheets, DMF processes in order. Does DMF support dependent-entity ordering in one bundle?

8. **Sales order template fields.** You mentioned a government-flow SO design that's different from the vendor-facing one. Can you share the template + a recent imported example? Specifically interested in: how the government customer (DD219) gets stamped, how the DLA contract number is referenced, how line-level contract modifiers (CLIN etc) are passed.

9. **Ship-to default.** Now that warehouse is always W01, is the ship-to always `SZY Brooklyn` (`000000203`), or are there cases where a DLA-origin PO ships to a different location even though the warehouse is W01?

10. **NSN / barcode population on PO lines.** Nothing in the sample populates `Barcode` / `BarCodeSetupId`. If DIBS populates them in the template (`Barcode=<nsn digits>`, `BarCodeSetupId='NSN'`), does DMF accept it, does warehouse benefit from NSN-scan receipts, or should we leave it blank?

11. **Polling cadence for "Posted" confirmation.** After you click Import in AX, roughly how long before the rows are readable via OData? Seconds? Minutes? We want to know how often DIBS should poll before it gives up and shows "import pending (check AX)" instead.

12. **Failure surface.** When a DMF import has partial failure (some rows committed, some rejected), where does the rejected-row report live — in AX UI only, or is there a file/entity DIBS can read to surface "these 2 PO lines didn't make it" to Abe?

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
