# Flow: Awards → POs → Supplier Switch

What happens after we win a bid. Award arrives, gets grouped into draft POs by supplier CAGE, can be switched to a cheaper vendor.

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
[User views POs tab]
[User clicks "Switch" on a line]
  GET /api/orders/vendor-prices?nsn=X
       │
       ▼
[Modal: list vendors with prices + last PO date]
[User selects new supplier CAGE]
  POST /api/orders/switch-supplier
       │
       ▼
[Find or create draft PO for new supplier]
[Update po_lines: set po_id + supplier]
[Recalc total_cost + line_count on both POs]
[Delete old PO if now empty]
       │
       ▼
[Submit to AX ← NOT IMPLEMENTED — see docs/flows/ax-po-writeback.md for spec]
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

### `/orders` POs tab

| Element | Result |
|---------|--------|
| PO row expansion | Show po_lines detail table |
| "Switch" button on line | Open supplier switch modal |
| Modal: vendor button | `POST /api/orders/switch-supplier` |
| Modal: "Cancel" | Close modal |

### `/purchase-orders` (legacy)

- "Create PO" button — **disabled**
- "Submit PO" on drafts — **disabled** ("Soon" label)

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/orders/vendor-prices?nsn=X` | GET | List vendors with prices + last PO date for NSN |
| `POST /api/orders/generate-pos` | POST | Group selected awards by supplier, create draft POs + lines |
| `POST /api/orders/switch-supplier` | POST | Move po_line to different supplier (auto-create PO if needed) |
| `POST /api/dibbs/awards` | POST | Scrape DIBBS awards page by NSN (batch of 10) |

### `POST /api/orders/generate-pos`

- Body: `{ awardIds: number[] }`
- Groups awards by `awards.cage`, creates 1 PO per group.
- Returns: `{ success, pos_created, lines_created }`

### `POST /api/orders/switch-supplier`

- Body: `{ line_id, new_supplier_cage }`
- Find or create draft PO for `new_supplier_cage`.
- Move line, recalc totals, delete empty old PO.
- Returns: `{ success, new_po_id, moved_line_id }`

## Supabase tables

| Table | R/W | Key columns |
|-------|-----|-------------|
| `awards` | read on page load, write on gen | `cage`, `contract_number`, `fsc`, `niin`, `unit_price`, `quantity`, `award_date`, `po_generated`, `po_id`, `fob`, `data_source` |
| `nsn_costs` | read on page load | `nsn`, `cost` (for margin enrichment) |
| `nsn_vendor_prices` | read on switch modal | `vendor`, `price`, `price_source`, `item_number`, `updated_at` |
| `abe_bids` | read on switch modal | `bid_date` (used as last-PO-date proxy) |
| `purchase_orders` | W on gen + switch, read on page | `po_number`, `supplier`, `status`, `total_cost`, `line_count`, `created_by`, `created_at` |
| `po_lines` | W on gen + switch | `po_id`, `award_id`, `nsn`, `description`, `quantity`, `unit_cost`, `sell_price`, `margin_pct`, `supplier`, `contract_number`, `order_number`, `fob`, `required_delivery` |

## External systems

- **AX/D365 `PurchaseOrders` + `PurchaseOrderLinesV2`** — **not wired**. POs never leave Supabase.
- **LamLinks k81_tab** — read by import script.
- **DIBBS awards page** — read by `/api/dibbs/awards`.

## Business invariants

1. **Our CAGE is always `0AG09`** — hardcoded in `/orders/page.tsx:11` as the awards filter.
2. **Government customer is `DD219`** — documented, NOT enforced in code. The `awards` table has no `customer_code` column.
3. **Grouping key is the CHEAPEST VENDOR per NSN** from `nsn_vendor_prices` — one vendor = one PO. NSNs with no vendor price land on a single `UNASSIGNED` PO that Abe can split via the supplier-switch flow. Note: the previous behavior grouped by `award.cage` which always equals our CAGE (`0AG09`) — that produced one giant PO for everything and was a bug.
4. **Cost waterfall uses pre-computed `nsn_costs`** — not re-run at PO generation.
5. **Margin = `(unit_price - our_cost) / unit_price * 100`** — shipping not subtracted here (only in enrichment).
6. **PO status lifecycle**: `draft` → `submitted` → `confirmed` → `received`. Currently only `draft` is reachable.
7. **FOB codes**: `"D"` = Destination, `"O"` = Origin.
8. **Switch-supplier empty-PO cleanup**: old PO is deleted if `line_count` drops to 0.

## Known gaps / TODOs

- **No AX submission endpoint** — `/api/orders/submit` doesn't exist. Draft POs never leave Supabase.
- **PO status stuck at "draft"** — no transition logic after the initial insert.
- **No `ax_po_number` column** — even if we submitted, can't link back to D365 for billing/invoicing.
- **No customer field on awards** — can't filter by DD219 vs commercial. All gov awards lumped together.
- **Supplier switch doesn't revalidate cost** — moves the line but `unit_cost` still reflects the original supplier's cost. Margin becomes misleading.
- **No supplier name resolution** — POs show `0AG09` (CAGE), not `Ever Ready Group` or the vendor name. `cage_directory` table is empty (planned PUB LOG re-export).
- **Vendor-prices endpoint uses `abe_bids.bid_date` as last-PO proxy** — it's not actually a PO date. Should use `po_lines` with join.
- **Cost enrichment happens on every page load** — re-queries `nsn_costs` per render. Should be materialized on the `awards` table.
- **Award import is 2-year window** — may miss older awards we'd want to re-visit.
- **`POST /api/dibbs/awards`** is not called from UI — only manually. Results vary in quality; not the primary awards source.
- **No invoicing trigger from PO received** — the invoicing page (see [invoicing.md](./invoicing.md)) loads from `awards`, not `purchase_orders`. The two flows are disconnected.

## Referenced files

- `src/app/orders/page.tsx` — page loader (cost enrichment 16-23)
- `src/app/orders/awards-list.tsx` — UI (PO gen 141-184, switch modal 108-139)
- `src/app/api/orders/generate-pos/route.ts` — PO creation (21-99)
- `src/app/api/orders/switch-supplier/route.ts` — supplier swap (9-99)
- `src/app/api/orders/vendor-prices/route.ts` — vendor lookup (8-78)
- `src/app/api/dibbs/awards/route.ts` — DIBBS awards scrape
- `src/app/purchase-orders/page.tsx` — legacy stub (submit button 71)
- `scripts/import-lamlinks-awards.ts` — LamLinks k81 → awards (27-51, upsert 79-81)
