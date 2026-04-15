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

Still open:

3. **Vendor identifiers.** Our `nsn_costs.vendor` has values like `AMAZON`, `000202`, `MCMAST`, `CHEMET`, `000249`. The AX sample has `ZHEJIA`, `HAEMON`, `MEDPLU` — also short 6-char codes. Are our 34K nsn_vendor_prices all valid AX `VendorAccountNumber`s? Best check: run a sample of our distinct DIBS vendors against `/data/Vendors?$filter=VendorAccountNumber in ...` and see how many miss. If any miss, we need a translation table.
4. **Warehouse + address selection per PO.** When we create a new PO, which warehouse do we route to — `W01` or `W03`? Does it depend on the vendor, the item, or the operator's choice? Same question for the ship-to address (Brooklyn vs East Brunswick). **Proposed default until answered**: Brooklyn + W01 (more frequent in sample).
5. **Payment terms.** Small-set in sample (`PPD`, `N30`, `N14`, `N7`, `N60`). Does the vendor master supply this automatically if we omit `PaymentTermsName`? If yes, safer to omit. If no, we need a per-vendor lookup.
7. **Line UoM match.** If our DIBS-side UoM (from `po_lines.unit_of_measure`, ultimately `k81.cln_ui_k81`) doesn't match the UoM AX uses for that item, does AX auto-convert via the product's UoM conversion rules, or does it reject? The bid-side UoMs are `EA`, `PG`, `PK`, `BX`; AX lines show `ea`, `B1000`, etc.
8. **Confirm permissions.** Does the DIBS OAuth service principal have permission to call the `confirmOrder` action on `PurchaseOrderHeadersV2`? Probe-able: do a dry `OPTIONS` or just attempt Confirm on a test PO and see if AX returns 403. **If no permission**, DIBS stops at Draft and Abe/Yosef finishes in AX UI.
9. **Rejection behavior.** If we POST a PO header with one invalid line (missing field, bad ItemNumber), does AX fail the whole batch or just the line? We want all-or-nothing — on partial success we might end up with a PO with fewer lines than intended, which is worse than no PO.
11. **Duplicate prevention.** If DIBS retries a POST after a partial failure, will AX deduplicate, or will we get two POs for the same lines? Assumed NO dedup — we'll persist `ax_po_number` on first success and refuse to re-POST for that DIBS `purchase_orders.id`.
12. **EDI-to-vendor flow.** Once a PO is Confirmed in AX, does AX automatically send it to the vendor (EDI 850, email, fax), or is there another manual click? Affects whether Abe still has something to do after DIBS fires Confirm.

New questions raised by the recon:

13. **`WorkflowState` behavior on insert.** Lines in the sample all show `'NotSubmitted'`. Do we set this on POST, or does AX manage it? If we set `'NotSubmitted'`, does that route to a human approver in AX's workflow engine (if workflows are configured)?
14. **`DocumentApprovalStatus` transitions.** The sample shows only `Confirmed`/`Approved`. Are there never any drafts in this tenant, or is there a filter excluding them from OData? If drafts exist but aren't readable, we might still POST draft successfully but not be able to read the result.
15. **`Orderer`/`Requester` on hardcoded `000001`.** Is that a fixed integration user, or the default employee that happens to always be used? If our service principal POSTs without it, does AX use the service principal's identity or a system default?
16. **`CustomerRequisitionNumber='DD219'`.** Every sampled line carried this — confirms DD219 is THE DLA government customer code for our gov work. Should DIBS-generated POs always stamp `DD219`, or do some non-gov DIBS POs need a different code?
17. **Barcode population on lines.** Currently 0 of 143 sampled lines have `Barcode`/`BarCodeSetupId` populated. Worth having DIBS populate them as `(<nsn>, 'NSN')` so warehouse can scan? Would need confirmation that populating them doesn't break anything.

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
