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

## Working assumptions (to verify)

Everything in this section is our best guess from probing `PurchaseOrderLinesV2` earlier and from what we know about AX tenants generally. Each assumption has a stability grade:

- **S** = we've observed this directly
- **L** = likely based on standard AX behavior / tenant shape
- **G** = guess; needs verification

### Entities + fields

1. **[L] PO headers live in `PurchaseOrderHeaderV2`** (cross-company). We haven't probed this entity yet — the bids-side probe only looked at `PurchaseOrderLinesV2`.
2. **[S] `PurchaseOrderLinesV2` carries** `ItemNumber`, `PurchasePrice`, `PurchaseUnitSymbol`, `PurchasePriceQuantity`, `Barcode`, `BarCodeSetupId`. No `VendorAccountNumber` field on the line — vendor is on the header.
3. **[G] AX auto-generates the PO number** when we POST the header without specifying one (standard AX behavior when "Auto-numbered" is on for the purchase order number sequence). We'll POST without a `PurchaseOrderNumber` and read the assigned one from the response.
4. **[L] Company code / legal entity** is `szyh` — observed on the `ProductBarcodesV3` probe as `dataAreaId`. Headers API calls need `?cross-company=true` plus `dataAreaId` on the body (or in a header).

### Required fields on the header (guesses, ordered by likelihood of being mandatory)

- **[G]** `OrderVendorAccountNumber` — the AX vendor to bill
- **[G]** `RequestedDeliveryDate` — from our `po_lines.required_delivery`, or today+N days if null
- **[G]** `DeliveryAddressPostalAddressLocationId` — probably has a company default; may or may not need explicit
- **[G]** `DefaultShippingSiteId` + `DefaultShippingWarehouseId` — likely required; probably "1" / main warehouse
- **[G]** `PurchaseOrderDocumentStateDescription` — probably has a default; we'd POST without it and let AX set "Draft"
- **[G]** `PurchaseOrderPlacedDate` = today
- **[G]** `PurchaseOrderStatus` = "Backorder" or "Open order" (AX-y names)
- **[G]** `ProcurementSiteId` / `RequesterPersonnelNumber` — may not be required depending on policy

### Required fields on each line (guesses)

- **[S]** `ItemNumber` — we already carry this on `po_lines` as `vendor_item_number` once populated
- **[S]** `PurchasePrice` — unit cost
- **[S]** `PurchaseUnitSymbol` — UoM (`po_lines.unit_of_measure`)
- **[G]** `OrderedPurchaseQuantity` — the qty
- **[G]** `LineDescription` — we carry this on `po_lines.description`
- **[G]** `RequestedDeliveryDate` — `po_lines.required_delivery`
- **[L]** `Barcode` + `BarCodeSetupId='NSN'` — populate so the line is scannable by NSN
- **[G]** `DeliveryAddressLocationId` — may inherit from header
- **[G]** `SalesTaxGroupCode` / `SalesTaxItemGroupCode` — may inherit from vendor master

### Confirm (post) step

- **[G]** AX exposes a `ConfirmPurchaseOrder` OData action (or similar) that transitions Draft → Confirmed and triggers any EDI-to-vendor flows.
- **[L]** Our OAuth service principal may NOT have permission to call Confirm — Confirm is usually a role-gated action in AX. Worst case we stop at "Draft created" and a human confirms in the AX UI. Same pattern as the bid chain where we never touch the transmit fields.

## Standing questions (for Yosef / the AX admin)

When we get answers, come back here and mark each with **[ANSWERED]** + the answer.

1. **Legal entity / dataAreaId.** Is `szyh` the right company for all our POs, or do some vendors go through another LE?
2. **PO number generation.** Does AX auto-number our POs, or is there a custom sequence where DIBS needs to supply the next number?
3. **Vendor identifiers.** `nsn_costs.vendor` + `nsn_vendor_prices.vendor` today hold values like `AMAZON`, `000202`, `MCMAST`, `CHEMET`. Are those all valid `VendorAccountNumber` values AX will accept as-is, or do some need translation?
4. **Header required fields.** Which of these are required vs default-settable: `DefaultShippingSiteId`, `DefaultShippingWarehouseId`, `DeliveryAddressPostalAddressLocationId`, `RequesterPersonnelNumber`, `ProcurementSiteId`?
5. **Payment terms / delivery terms.** Does the vendor master supply these automatically, or do we need to pass `PaymentTermsName` and `DeliveryTermsCode` on the header?
6. **Currency.** Always USD? Or does AX need `PurchaseCurrencyCode='USD'` explicitly?
7. **Line UoM match.** If the award shipped in `EA` but the vendor master on AX prefers `PG` for the same item, does AX auto-convert, or do we need to pass the matching UoM?
8. **Confirm permissions.** Does the `dibs-api` service principal have permission to call the Confirm action? Or do we stop at Draft and let a human click Confirm in AX?
9. **Rejection behavior.** If we POST an invalid line (missing field, bad item number), does AX reject the whole PO or just the line? We'd prefer all-or-nothing so DIBS can retry cleanly.
10. **Cross-company header.** Does `PurchaseOrderHeaderV2` accept `?cross-company=true` on POST, or do we need to scope to a specific company endpoint?
11. **Duplicate prevention.** If DIBS sends the same PO twice (retry after a partial failure), does AX deduplicate, or do we end up with two POs for the same lines? If no dedup, we need to persist an idempotency key.
12. **EDI-to-vendor flow.** Once a PO is Confirmed, does AX automatically send it to the vendor via EDI/email, or is there another manual step? This tells us whether Abe still needs to do something after DIBS fires Confirm.

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
