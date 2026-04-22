# Flow: Awards → POs → AX Write-Back

What happens after we win a bid. Award arrives, gets grouped into draft POs by cheapest vendor (not our own CAGE), is edited / switched / bulk-acted-upon, then pushed to AX via DMF (header + lines) with a polling loop. NPI workbook is generated on-demand for lines whose items or NSNs aren't in AX yet.

## Entry points

| Path | Purpose |
|------|---------|
| `/orders` | Orders & POs page — Awards tab + POs tab |
| `/orders` Awards tab | Shows CAGE 0AG09 awards from last 90 days |
| `/orders` POs tab | Shows draft POs with per-line supplier switch |
| `/purchase-orders` | **Legacy stub** — mock data, placeholder for D365 integration |
| `scripts/import-lamlinks-awards.ts` | Pulls k81_tab → `awards` table (2-year window) |
| `POST /api/dibbs/awards` | Scrapes DIBBS awards page by NSN (10 NSN limit) |

## Pipeline

```
[Award arrives in LamLinks k81_tab]
       │
       ▼
[scripts/import-lamlinks-awards.ts (manual)]
  - Upsert to `awards` (cage=0AG09, po_generated=false, po_id=null)
       │
       ▼
[User opens /orders]
  - Load awards (CAGE=0AG09, last 90d)
  - Enrich in page load with nsn_costs → compute margin
       │
       ▼
[User selects awards + clicks "Generate POs"]
  POST /api/orders/generate-pos
       │
       ▼
[For each NSN in selection: pull waterfall-winner cost from nsn_costs]
  (source preference: Recent PO 2mo > 3mo > price_agreement > older PO)
[Check UoM match between award.unit_of_measure and nsn_costs.unit_of_measure]
[If UoM mismatch or no cost row → route to UNASSIGNED (Abe uses Switch)]
[Group eligible awards by waterfall-winner vendor]
[For each group:]
  - Create purchase_orders row:
    po_number = "PO-{YYYYMMDD}-{timestamp}-{i}"
    status = "draft"
    total_cost = SUM(unit_cost * qty)
  - For each award in group: insert po_lines row (with UoM + cost_source)
  - Mark awards.po_generated=true, po_id={po.id}
       │
       ▼
[User views POs tab — each PO card has bulk-select checkbox + inline per-line edits]
[Options per PO or bulk across selected POs:]
  - Inline edit UoM / unit_cost on a line          POST /api/orders/po-lines/update
  - Switch supplier on a line                      POST /api/orders/switch-supplier
  - Generate NPI workbook (new items / add vendor) POST /api/orders/generate-npi
  - Submit to AX Header (DMF import step 1)        POST /api/orders/submit-po-header
  - Poll for assigned AX PO# after header import   POST /api/orders/poll-ax-po-number
  - Submit to AX Lines (DMF import step 2)         POST /api/orders/submit-po-lines
  - Verify lines landed in AX                      POST /api/orders/check-ax-lines
  - Bulk ZIP download of header + lines sheets     POST /api/orders/bulk-download-dmf
  - Delete draft PO(s) (pre-AX only)               POST /api/orders/delete-pos-batch
       │
       ▼
[State machine per PO (purchase_orders.dmf_state):]
  drafted → awaiting_po_number → lines_ready → awaiting_lines_import → posted
       │
       ▼
[In AX: operator clicks "Send Confirmation" — Dynamics emails PDF to vendor]
```

## User actions

### `/orders` Awards tab

| Element | Result |
|---------|--------|
| "From / To" date inputs | Client-side filter on award_date |
| "New only (no PO yet)" checkbox | Filter `po_generated=false` |
| "Select All Visible" button | Select up to 1,000 awards |
| Row checkbox | Toggle individual selection |
| "Generate POs" button | `POST /api/orders/generate-pos` with selected award IDs |

### `/orders` Review tab

One-line-at-a-time review queue for PO lines on draft POs that need operator attention. Each resolution can be remembered per-NSN+vendor so future PO generations land clean.

**What qualifies a line for the queue:**

| Reason | Rule |
|---|---|
| UoM mismatch | `cost_source` contains `COST UNVERIFIED` |
| Negative margin | `margin_pct < 0` |
| Low margin | `margin_pct < 10` |
| Suspiciously high margin | `margin_pct > 50` (usually signals bad cost) |
| Missing cost | `unit_cost` null/zero |
| Missing sell price | `sell_price` null/zero |
| Missing margin | `margin_pct` null |

**UI:**
- Card showing NSN, description, PO#, supplier, qty, sell price, unit cost, margin (color-coded), `cost_source` trail, and badge chips for each reason flagged.
- UoM dropdown + unit_cost input + optional note.
- Three action buttons:
  - **Save + remember for this NSN** — upserts `nsn_review_overrides` (keyed by `(nsn, vendor)`). Future PO generation for the same pair uses these values, tagged `cost_source = "reviewed override by <user> on <date>"`, and skips the COST UNVERIFIED flag entirely.
  - **Save this line only** — writes only to this `po_line`; no override.
  - **Skip** — move to next line without saving.
- If the NSN+vendor already has an override on file (e.g., reviewed previously but a new award landed before the override took effect), the card shows the existing override above the edit form.
- "Open PO → switch supplier" link jumps into the regular POs tab with the parent PO expanded if the right fix is a supplier change instead.
- Prev/Next arrows + counter `X of Y`. Refresh button re-queries the endpoint.

### `/orders` POs tab

| Element | Result |
|---------|--------|
| PO row expansion | Show po_lines detail table with SourceTips on every field |
| PO card checkbox | Toggle in bulk selection |
| "Select all POs" / "Clear" toolbar buttons | Bulk-select helpers |
| Bulk toolbar: "Generate NPI" | One xlsx with 7 tabs across all selected POs |
| Bulk toolbar: "Submit Headers" | DMF header-stage for each selected PO |
| Bulk toolbar: "Submit Lines" | DMF lines-stage for each selected PO (requires AX PO# already assigned) |
| Bulk toolbar: "Check AX" | Poll `PurchaseOrderLinesV2` to verify posting completed |
| Bulk toolbar: "Download ZIP" | Combined header + lines xlsx + NPI xlsx for selected POs |
| Bulk toolbar: "Delete" | Only deletes POs still in `drafted` / null `dmf_state` (filters out AX-committed) |
| Inline UoM cell | Click → dropdown; save triggers `po-lines/update`, re-runs cost waterfall if UoM fix makes AX vendor UoM match |
| Inline unit_cost cell | Click → input; save tags `cost_source` as "manual override by <user>" |
| "Switch" on line | Supplier switch modal (also available on Recent PO History rows inside the modal) |
| SourceTip (hover on any field) | Shows where value came from (via portal + fixed positioning — escapes PO card `overflow:hidden`) |
| `AX Suppliers` column | Count of distinct vendors for the NSN in `nsn_vendor_prices`. Blue pill when >1 (supplier switch possible), grey "1" or "—" otherwise. |
| "Only lines with 2+ AX suppliers" toggle | Top-right of the PO toolbar. Hides lines whose NSN has ≤1 vendor in AX and collapses POs with no remaining lines — lets Abe scan only the switch-candidates. |

### `/purchase-orders` (legacy)

- Stub page — no longer used; the functional UI lives on `/orders` POs tab.

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/orders/vendor-prices?nsn=X` | GET | List vendors with prices + last PO date for NSN |
| `POST /api/orders/generate-pos` | POST | Group selected awards by cheapest vendor (not our CAGE), create draft POs |
| `GET /api/orders/review-lines` | GET | List draft-PO lines flagged for review (UoM issues / suspicious margins / missing data) |
| `POST /api/orders/po-lines/update` | POST | Inline edit UoM or unit_cost; re-runs waterfall on UoM fix. `persist_override=true` upserts `nsn_review_overrides` |
| `POST /api/orders/switch-supplier` | POST | Move po_line to different supplier (auto-create PO if needed) |
| `POST /api/orders/generate-npi` | POST | Multi-PO NPI workbook (7 tabs: RawData/RPCreate/RPV2/APPROVEDVENDOR/EXTERNALITEMDESC/BarCode/TradeAgreement) |
| `POST /api/orders/submit-po-header` | POST | DMF step 1: push header, AX auto-assigns PO# |
| `POST /api/orders/poll-ax-po-number` | POST | Poll `PurchaseOrderHeadersV2` by `VendorOrderReference` correlation tag |
| `POST /api/orders/submit-po-lines` | POST | DMF step 2: push lines (requires `ax_po_number` populated) |
| `POST /api/orders/check-ax-lines` | POST | Verify lines landed; flip state to `posted` |
| `POST /api/orders/bulk-download-dmf` | POST | ZIP of header + lines + NPI xlsx for selected POs |
| `POST /api/orders/delete-po` | POST | Delete single draft PO; resets awards.po_generated |
| `POST /api/orders/delete-pos-batch` | POST | Bulk delete drafts; filters out AX-committed POs |

### `POST /api/orders/generate-pos` (router behavior)

- Body: `{ awardIds: number[] }`
- Routing: NSN-keyed cheapest-vendor lookup in `nsn_costs`. Awards with no vendor cost OR unknown NSN → `UNASSIGNED` PO.
- UoM does NOT gate routing — it only flags cost trust via `cost_source` containing `COST UNVERIFIED`. Abe resolves via inline UoM edit or supplier switch.
- `nsn` is computed on the award via `${fsc}-${niin}` (awards table has no `nsn` column — this was the collapse-to-1-PO bug).
- Returns: `{ success, pos_created, lines_created }`

### `POST /api/orders/po-lines/update` (inline edit)

- Body: `{ line_id, unit_of_measure?, unit_cost? }`
- UoM-only edit: re-queries `nsn_costs` for the PO line's vendor; if vendor UoM now matches the new UoM, auto-resolves cost and tags `cost_source` as "nsn_costs waterfall (auto-resolved after UoM fix)". Also strips the `COST UNVERIFIED` prefix if UoM was the only issue.
- Cost-only edit: tags `cost_source` as "manual override by <user>".
- Recomputes `total_cost`, `margin_pct`, and the parent PO's header `total_cost`.

## Supabase tables

| Table | R/W | Key columns |
|-------|-----|-------------|
| `awards` | read on page load, write on gen | `cage`, `contract_number`, `fsc`, `niin`, `unit_price`, `quantity`, `award_date`, `po_generated`, `po_id`, `fob`, `data_source` |
| `nsn_costs` | read on PO gen + inline UoM fix | `nsn`, `vendor`, `cost`, `unit_of_measure`, `cost_source` |
| `nsn_catalog` | read on NPI | `nsn`, `source` (`AX:<ItemNumber>` form for already-known items) |
| `nsn_ax_vendor_parts` | read on NPI | `nsn`, `vendor_account`, `ax_item_number` — per-(NSN,vendor) AX item record |
| `nsn_upc_map` | read on NPI | `nsn`, `upc`, `ax_item_number` — optional UPC alongside NSN barcode. Populated by `scripts/populate-nsn-upc-map.ts` from cached AX `ProductBarcodesV3` dump |
| `nsn_review_overrides` | read on PO gen, write on review save | `(nsn, vendor)` UNIQUE → `unit_of_measure`, `unit_cost`, `notes`, `reviewed_by`, `reviewed_at`. Review-once state: `generate-pos` checks this first, falls back to waterfall only when no override. Tagged `cost_source = "reviewed override by …"` when used. |
| `nsn_vendor_prices` | read on switch modal | `vendor`, `price`, `price_source`, `item_number`, `updated_at` |
| `abe_bids` | read on switch modal | `bid_date` (used as last-PO-date proxy) |
| `purchase_orders` | W on gen + switch + all DMF stages | `po_number`, `supplier`, `status`, `total_cost`, `line_count`, `created_by`, `ax_po_number`, `ax_correlation_ref`, `dmf_state` (`drafted`/`awaiting_po_number`/`lines_ready`/`awaiting_lines_import`/`posted`), `dmf_last_polled_at`, `dmf_error` |
| `po_lines` | W on gen + switch + inline edit | `po_id`, `award_id`, `nsn`, `description`, `quantity`, `unit_of_measure`, `unit_cost`, `sell_price`, `margin_pct`, `supplier`, `contract_number`, `order_number`, `fob`, `required_delivery`, `cost_source`, `vendor_item_number` (AX), `ax_item_number` |
| `sync_log` | W on NPI gen | `action='npi_generated'`, `details` JSON (po_ids, new_items, barcode_nsn_rows, barcode_upc_rows, tradeagreement_rows, etc.) |

## External systems

- **AX/D365 DMF (header + lines imports)** — fully wired via `submit-po-header` / `poll-ax-po-number` / `submit-po-lines` / `check-ax-lines`. See `docs/flows/ax-po-writeback.md` for the full state machine.
- **AX/D365 OData `PurchaseOrderHeadersV2` / `PurchaseOrderLinesV2`** — READ-ONLY (service principal has no write perms). Used for polling.
- **NPI workbook** — bridges items/NSNs/vendors not yet in AX. See `docs/npi-workflow.md`.
- **LamLinks k81_tab** — read by import script.
- **DIBBS awards page** — read by `/api/dibbs/awards`.

## Business invariants

1. **Our CAGE is always `0AG09`** — hardcoded in `/orders/page.tsx:11` as the awards filter.
2. **Government customer is `DD219`** — lives as `CustomerRequisitionNumber` on every AX PO line, NOT as a customer account.
3. **Grouping key is the CHEAPEST VENDOR per NSN** from `nsn_costs` — one vendor = one PO. NSNs with no vendor cost (or unknown NSN) land on `UNASSIGNED` that Abe splits via supplier switch.
4. **NSN computed from fsc+niin on awards** — the `awards` table has no `nsn` column. Forgetting this collapses every award onto one PO.
5. **UoM never gates routing** — it only flags cost trust with a `COST UNVERIFIED` prefix on `cost_source`. Inline UoM fix auto-resolves the cost and strips the flag when AX vendor UoM matches.
6. **Margin = `(sell_price - unit_cost) / sell_price * 100`** — shipping subtracted only in enrichment.
7. **DMF state machine is ordered**: `drafted` → `awaiting_po_number` → `lines_ready` → `awaiting_lines_import` → `posted`. Each transition requires the prior one (UI enforces this on bulk actions).
8. **DIBS never mutates an AX PO after posting** — once `dmf_state='posted'` and `ax_po_number` is populated, AX is source of truth. Only status readbacks flow back.
9. **Delete is bounded** — `delete-pos-batch` refuses any PO with `ax_po_number` set or `dmf_state != 'drafted'`.
10. **FOB codes**: `"D"` = Destination, `"O"` = Origin.
11. **NPI blocks a PO push** — if any line's NSN/item/vendor isn't in AX, the PO can't land. Operator runs NPI, waits, retries. Detection is automatic via `nsn_catalog` + `nsn_ax_vendor_parts`.

## Known gaps / TODOs

- **No customer field on awards** — can't filter by DD219 vs commercial. All gov awards lumped together.
- **Supplier switch doesn't revalidate cost** — moves the line but `unit_cost` still reflects the original supplier's cost. Margin becomes misleading. (Inline cost edit is the workaround.)
- **No supplier name resolution** — POs show CAGE/vendor account, not company names. `cage_directory` table is empty (planned PUB LOG re-export).
- **Cost enrichment happens on every page load** — re-queries `nsn_costs` per render. Should be materialized.
- **NPI collision check is local-only** — checks against cached `nsn_catalog` + `nsn_ax_vendor_parts`. Live OData check against `ReleasedProductsV2` before xlsx download is a future improvement.
- **NPI UPC source is only AX's own dump** — `nsn_upc_map` has 74 entries (2026-04-22). External UPC sources (master DB, public databases) would expand coverage for new items.
- **No invoicing trigger from PO received** — invoicing page loads from `awards`, not `purchase_orders`. See `docs/flows/invoicing.md`.
- **DMF polling is manual** — "Check AX" button is operator-triggered. Background polling is a future job.

## Referenced files

- `src/app/orders/page.tsx` — page loader (cost enrichment + PO fetch)
- `src/app/orders/awards-list.tsx` — UI: PO gen, inline edit, bulk-select toolbar, switch modal, SourceTip usage
- `src/components/source-tip.tsx` — portal-based tooltip (fixed positioning, escapes `overflow:hidden`)
- `src/app/api/orders/generate-pos/route.ts` — PO creation with cheapest-vendor routing + UoM cost-trust flag
- `src/app/api/orders/po-lines/update/route.ts` — inline UoM / unit_cost edit
- `src/app/api/orders/switch-supplier/route.ts` — supplier swap
- `src/app/api/orders/generate-npi/route.ts` — 7-tab NPI workbook
- `src/app/api/orders/submit-po-header/route.ts` — DMF header push
- `src/app/api/orders/poll-ax-po-number/route.ts` — AX PO# readback
- `src/app/api/orders/submit-po-lines/route.ts` — DMF lines push
- `src/app/api/orders/check-ax-lines/route.ts` — verify posted
- `src/app/api/orders/bulk-download-dmf/route.ts` — combined ZIP
- `src/app/api/orders/delete-po/route.ts` + `delete-pos-batch/route.ts` — draft cleanup
- `src/app/api/orders/vendor-prices/route.ts` — switch modal vendor lookup
- `scripts/import-lamlinks-awards.ts` — LamLinks k81 → awards
- `scripts/populate-nsn-upc-map.ts` — backfill UPC lookup from AX barcodes cache
