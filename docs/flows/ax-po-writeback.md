# Flow: AX Purchase Order Write-Back (proposed)

Not built. This page is the spec + working assumptions for letting DIBS create purchase orders directly in D365 / AX instead of exporting to Excel for manual entry.

Same phased approach we used for the bid chain (`scripts/generate-bid-insert-sql.ts`) and plan to use for the invoice chain:

1. Recon — classify fields on existing POs so we know what's required, constant, and variable
2. Dry-run generator — builds the AX API payload without firing
3. `--execute` on ONE PO with someone watching AX
4. Scale

## Scope

For each `purchase_orders` row in Supabase with `status='draft'`, DIBS should be able to click a button and have AX:

1. Create a PO header (auto-assigned PO number, linked to the vendor)
2. Add each `po_lines` row as an AX purchase order line
3. Optionally confirm the PO (transition Draft → Confirmed, which is AX's "post" step — this is what sends the PO to the vendor EDI-side)

After success, DIBS flips the local row's `status` to `submitted` and records the AX PO number + AX internal ID so downstream receipt matching still works.

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

## Questions for Yosef (clean list, renumbered)

Context to include when sending:

> DIBS has a new feature that would let it create purchase orders directly in D365 instead of Abe exporting to Excel and someone keying them in. I've reverse-engineered most of the shape from 50 recent POs — need your answers on the remaining items before I flip the switch.

1. **Vendor accounts.** DIBS has ~34,000 vendor price records pulled from AX. The vendor codes we hold look like `AMAZON`, `000202`, `MCMAST`, `CHEMET`. The 50 POs we sampled used codes like `ZHEJIA`, `HAEMON`, `MEDPLU` (same shape). Can I assume every vendor in our DIBS data corresponds to a real `VendorAccountNumber` in AX, or should I expect misses? If misses, is there a translation we should maintain?

2. **Payment terms.** PO headers in the sample have `PaymentTermsName` values of `PPD`, `N30`, `N14`, `N7`, `N60`. If DIBS POSTs a PO without specifying payment terms, will AX pull them automatically from the vendor master, or does the create fail? If manual, we'll need to know which terms apply per vendor.

3. **Unit of measure match.** Our source data calls units `EA`, `PG`, `PK`, `BX`. AX lines show `ea`, `B1000`, etc. If we send a PO line with UoM `EA` but the item in AX is set up for `PG`, will AX auto-convert via the product's UoM conversion rules, or reject the line? Context: our bidding/UoM-match logic has already been fixed so we won't send bad UoM math — this is about the AX-side conversion only.

4. **Confirm permission.** After DIBS creates the PO (Draft state), we want to call AX's "Confirm" action so the PO transitions into the normal lifecycle. Does our OAuth service principal (the one with the D365 API credentials DIBS is already using for reads) have permission to call `confirmOrder` on `PurchaseOrderHeadersV2`? If no, DIBS will stop at Draft and you'll click Confirm manually in AX.

5. **Rejection behavior.** If we POST a PO with 10 lines and one line has a bad field, does AX reject the whole PO or just that line? We want all-or-nothing, because a partial PO (say 9 lines committed, 1 missing) is worse than none.

6. **Duplicate prevention.** If DIBS retries a POST after a partial network failure, will AX deduplicate, or would we end up with two real POs? I'm assuming no dedup on your side — DIBS will store the AX-assigned PO number on first success and refuse to re-POST the same DIBS draft — but let me know if there's anything server-side I should rely on instead.

7. **AX-side "new product import" for items not yet in AX.** You mentioned some items we're buying aren't set up in AX yet. What's the flow you want?
   - (a) DIBS detects missing items and creates a queue for you to set up manually before the PO goes through?
   - (b) DIBS creates the product in AX itself via `ReleasedProductsV2` (or whichever entity) using data from our bid sources? If so, what are the required fields — I'd need to know product group, tracking dimensions, storage dimensions, tax setup, UoM, etc.
   - (c) Some hybrid — DIBS creates the product with a "needs review" flag and you fill in the rest later?
   My recommendation is (a) for now (safe, non-destructive) and moving to (c) once we have confidence.

8. **Workflow approvals.** PO lines in the sample all show `WorkflowState='NotSubmitted'`. If workflows are configured on PurchaseOrderHeader in this tenant, and DIBS POSTs a new PO, will it automatically route to a human approver, or is that workflow off?

9. **Orderer / Requester employee number.** Every sampled PO had `OrdererPersonnelNumber='000001'` and `RequesterPersonnelNumber='000001'`. Is that a specific integration/service user, or just the default that always gets used? Should DIBS hardcode `000001`, or do you want a dedicated employee number for DIBS-generated POs (e.g., to audit which POs came from the system vs keyed manually)?

10. **`CustomerRequisitionNumber='DD219'`.** Every sampled line stamped DD219 (our DLA government customer). All DIBS-generated POs are DLA-origin, so DIBS will always stamp DD219 — can you confirm that's correct, or are there any DIBS POs that should carry a different code?

11. **Barcode / NSN scannability on lines.** None of the 143 sampled lines have `Barcode` / `BarCodeSetupId` populated. If DIBS populates `Barcode=<the NSN>` + `BarCodeSetupId='NSN'` on each line, would warehouse benefit (being able to scan NSN for receipt), or is there a reason these are intentionally left null?

12. **Ship-to address.** Sample shows 2 options: `SZY Brooklyn` (`000000203`, W01) and `SZY New NJ` (`000011805`, W03). You confirmed warehouse is always W01 for DIBS POs — can I take that to mean the ship-to is always Brooklyn (`000000203`), or is there a reason the ship-to would ever be different from the warehouse?

## Proposed implementation (post-answers)

### Phase 1 — Recon (do now, doesn't need answers)

`scripts/reverse-engineer-ax-po-schema.ts`:
- Pull 50 recent POs from `PurchaseOrderHeadersV2` + their lines from `PurchaseOrderLinesV2`
- Classify every field (auto / constant / small-set / variable / always-null) same pattern as `reverse-engineer-bid-schema.ts`
- Dump one complete header+lines chain
- Output a list of "fields populated in all 50 headers" — those are our de-facto required fields
- Print a refined version of the standing-questions list based on what the sample actually shows

Lets us narrow assumptions before asking Yosef 12 questions.

### Phase 2 — Dry-run generator

`scripts/generate-ax-po-json.ts`:
- Input: Supabase `purchase_orders` rows with `status='draft'` (optionally filtered by id)
- Output: a `.json` file per PO containing the exact AX OData body we WOULD POST, + a preview of the Confirm call
- `--dry-run` default; `--execute` actually POSTs
- On `--execute`, after each successful AX response:
  - Persist `ax_po_number` + `ax_po_internal_id` on the `purchase_orders` row
  - Flip `purchase_orders.status` from `draft` to `submitted`
  - If Confirm succeeded too, flip to `confirmed`
- On failure, leave the row at `draft` and log the AX error body to `sync_log`

### Phase 3 — UI surface

On `/orders` POs tab, add a button per PO:
- Label: "Create in AX" (while status=draft) → "In AX: <po_number>" (while status=submitted) → "Confirmed in AX" (while status=confirmed)
- Disabled while pending; shows spinner
- On click → POST to `/api/orders/push-to-ax` with `{ poId }`
- That route wraps the generator logic server-side

Also add a batch "Create All in AX" above the list (same pattern as the new "Download All as ZIP" button).

### Schema adds

Three new columns on `purchase_orders`:

- `ax_po_number text` — the AX-assigned PO number
- `ax_po_internal_id text` — the AX ETag / internal UUID for API follow-ups
- `ax_error text` — last AX error body, null when successful; cleared on retry

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
