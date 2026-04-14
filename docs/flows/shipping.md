# Flow: Shipping

Sync shipment records from LamLinks (ka8 → kaj → kad chain) into Supabase for visibility. Identify consolidation opportunities.

## Entry points

| Path | Purpose |
|------|---------|
| `/shipping` | Dashboard — table of shipments with status filters + consolidation hints |
| `scripts/sync-shipping.ts` | Manual CLI sync (local Windows only) |

No API routes — purely a read-only dashboard over synced data.

## Pipeline

```
[Award in LamLinks k81_tab]
       │
       ▼
[Job created in ka8_tab — job_type="Ship", status="Shipping"]
       │
       ▼
[Shipment header in kaj_tab — ship_number, ship_date, edi_id]
       │
       ▼
[Shipment lines in kad_tab — qty, weight, box_count, tracking, transport_mode, FOB]
       │
       ▼
[User runs: npx tsx scripts/sync-shipping.ts]
  - Connect to NYEVRVSQL001/llk_db1 via Windows Auth
  - Run SQL from scripts/tmp-shipping-v2.sql  ← FILE MISSING FROM REPO
  - Extract: ship_number, ship_status, ship_date, transport_mode, tracking,
    weight, boxes, qty, sell_value, job_status, clin, fob, required_delivery,
    contract_number, nsn (from FSC-NIIN), description
  - Upsert to ll_shipments onConflict (ship_number, contract_number, clin)
  - Log sync_log action="shipping_sync"
       │
       ▼
[User opens /shipping]
  - Read ll_shipments
  - Client-side filter + search + consolidation hint UI
```

## User actions

| Element | Result |
|---------|--------|
| Status filter buttons (Shipped, Packing, Shipping, Delivered) | Client-side filter |
| Search box | Filter by contract, NSN, description, ship_number, tracking |
| "Multi-Line Contracts" panel | Shows contracts with >1 CLIN grouped — informational only |
| (No action buttons) | Read-only dashboard |

## API routes

None. The page is fully server-rendered from Supabase; no user writes.

## Supabase tables

| Table | R/W | Key fields |
|-------|-----|-----------|
| `ll_shipments` | W by script, R by dashboard | `ship_number`, `ship_status`, `ship_date`, `transport_mode`, `tracking_number`, `weight_lbs`, `box_count`, `edi_id`, `quantity`, `sell_value`, `job_status`, `clin`, `fob`, `required_delivery`, `contract_number`, `nsn`, `description`, `data_source="lamlinks"` |
| `sync_log` | W by script | `action="shipping_sync"`, `details: { total, saved }` |

## External systems

- **LamLinks SQL Server** (NYEVRVSQL001/llk_db1) — `ka8_tab → kaj_tab → kad_tab → k81_tab` chain.
- Windows Auth only. Requires ERG domain membership.

## Business invariants

1. **Unique key**: `(ship_number, contract_number, clin)`.
2. **FOB codes**:
   - `"D"` = Destination (seller pays freight)
   - `"O"` = Origin (buyer pays)
   - Empty/null = unknown
3. **Transport modes** (observed): `"UPS"`, `"FedEx"`, `"USPS"`, `"LTL Freight"`. Freeform from LamLinks.
4. **CLIN format**: 1-6 char string. Identifies line items within a contract.
5. **NSN format**: `FSC-NIIN` (4-digit FSC + 9-digit NIIN).
6. **Status values** (trimmed, case-insensitive): `"Shipped"`, `"Packing"`, `"Shipping"`, `"Delivered"`, `"In Transit"`.
7. **Consolidation hint**: contracts with >1 CLIN are flagged as potential consolidation opportunities — advisory only.

## Known gaps / TODOs

- **`scripts/tmp-shipping-v2.sql` is missing from the repo** — referenced by `sync-shipping.ts:26` but doesn't exist. Sync will fail when run fresh.
- **Manual sync only** — no scheduler, webhook, or cron. Data is stale until someone runs the script.
- **No carrier API integration** — tracking numbers imported but no real-time status from FedEx/UPS.
- **No freight cost tracking** — weight and quantity imported but no carrier rate / freight cost / insurance.
- **No EDI 856 (ASN) generation** — can't advance-notify WAWF when goods ship.
- **Consolidation is advisory only** — no UI to actually merge CLINs or consolidate shipments.
- **Depends on Windows box** — if the local machine is offline, shipments stop syncing silently.

## Referenced files

- `src/app/shipping/page.tsx` — page loader (29-37)
- `src/app/shipping/shipping-dashboard.tsx` — UI (41-254, manual sync instruction at 215)
- `scripts/sync-shipping.ts` — CLI sync (21-78, missing SQL reference at 26)
- `scripts/tmp-shipping-v2.sql` — **MISSING** — needs to be recreated/restored
