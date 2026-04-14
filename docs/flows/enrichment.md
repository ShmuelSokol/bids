# Flow: Enrichment

Take a raw solicitation in `dibbs_solicitations` and compute: NSN source match (AX
first, Master DB second), cost, suggested price, margin, FOB shipping, sourceable
flag, already_bid flag, channel tag.

## Entry points

| Source | Trigger |
|--------|---------|
| `POST /api/dibbs/enrich` | Auto-called at the end of `POST /api/dibbs/scrape-now` |
| `POST /api/dibbs/enrich` | Manual call (standalone) |
| `POST /api/dibbs/reprice` | Manual — price-only refresh of already-sourceable rows |

No UI button directly triggers enrich. The "Sync Data" button on Solicitations calls scrape-now which auto-chains to enrich.

## Pipeline

```
POST /api/dibbs/enrich
       │
       ▼
[Load reference data in parallel, all paginated by 1000]
  - nsn_catalog (AX)
  - nsn_costs
  - awards (for winning-history lookup)
  - ndc_nsn_map (pharma NDC → NSN)
  - fsc_heatmap (channel assignment)
  - awards FOB map
  - abe_bids (already-bid lookup)
  - Master DB (optional HTTPS fetch, 15s timeout, silently swallowed on failure)
       │
       ▼
[For each row in dibbs_solicitations WHERE is_sourceable = false]
       │
       ▼
[NSN match]
  1. AX (nsn_catalog) — authoritative, sets source="ax"
  2. Master DB — fallback, sets source="masterdb"
  3. Neither → leave is_sourceable=false, skip
       │
       ▼
[Cost lookup from nsn_costs map → { cost, cost_source }]
       │
       ▼
[Pricing decision] — see "Pricing rules" below
       │
       ▼
[Channel assignment]
  - lamlinks  if FSC ∈ fsc_heatmap (hot or warm)
  - dibbs_only otherwise
       │
       ▼
[FOB shipping adjustment (only if FOB="D")]
  est_shipping by bracket:
    <$25:  $5
    $25-100: $8
    $100-500: $12
    $500+: $20
  adjusted margin = (suggested - cost - est_shipping) / suggested
       │
       ▼
[Already-bid check]
  already_bid = (abe_bids map has key solicitation_number)
       │
       ▼
[Update dibbs_solicitations]
  Set: is_sourceable, source, source_item, suggested_price, our_cost, margin_pct,
       cost_source, price_source, channel, fob, est_shipping, potential_value,
       already_bid, last_bid_price, last_bid_date
       │
       ▼
[Log to sync_log action="enrich"]
```

## Cost waterfall

The `nsn_costs` table is pre-populated by `scripts/sync-ax-barcodes.ts` and related
scripts. Each row has `{ nsn, cost, cost_source }`. The `cost_source` string records
which upstream source won:

| Priority | `cost_source` value | Origin | Confidence (bid-score.ts:73-82) |
|----------|--------------------|--------|-----|
| 1 | `recent_po_2mo` | AX `PurchaseOrderLinesV2` (last 2 months) | 10/10 |
| 2 | `recent_po_3mo` | AX `PurchaseOrderLinesV2` (2-3 months) | 7/10 |
| 3 | `masterdb` | Master DB export | 8/10 |
| 4 | `price_agreement` | AX `PurchasePriceAgreements` (cheapest vendor) | 5/10 |
| 5 | `older_po` | AX `PurchaseOrderLinesV2` (>3 months) | 3/10 |

Enrichment itself does NOT re-run the waterfall — it just reads pre-computed rows.
The waterfall is maintained by the AX sync jobs.

## Pricing rules

Decision tree in `src/app/api/dibbs/enrich/route.ts:173-210`:

### If cost is known AND winning-bid history exists

- Last winning price had **margin > 5%** → use last winning price unchanged
- Last winning price had **margin ≤ 5%** → use `cost × 1.10` (5% floor)

### If cost is known, no winning history — apply bracket markup

| Cost | Multiplier | Nominal margin |
|------|-----------|----------------|
| < $25 | 1.64x | 39% |
| $25 – $100 | 1.36x | 26% |
| $100 – $500 | 1.21x | 17% |
| $500+ | 1.16x | 14% |

These brackets were fit empirically against 2,591 historical bid-to-cost matches.
See [pricing-logic.md](../pricing-logic.md) for the full story.

### If cost unknown but last award exists

- `suggested_price = last_award + bracket-adjusted increment (1-3%)`

### If cost unknown AND no award history

- 18% markup minimum (fallback in pricing.ts:240-245)

### Price source labels (price_source column)

- `"last_win"` — winning history
- `"cost_plus_10"` — thin-margin floor
- `"bracket_markup"` — bracket math
- `"award_increment"` — last award + small bump
- `"markup_default"` — fallback

## API routes

### `POST /api/dibbs/enrich`

- Public (no auth)
- Body: empty
- Returns:
  ```ts
  {
    success: boolean,
    total_checked: number,
    sourceable: number,
    with_cost_data: number,
    already_bid: number,
    ax_nsns_loaded: number,
    masterdb_nsns_loaded: number,
    costs_loaded: number,
  }
  ```

### `POST /api/dibbs/reprice`

- Public (no auth)
- Body: empty
- Only updates rows where `is_sourceable = true` and winning-history would change the price by >$0.01
- Returns:
  ```ts
  { success, updated, skipped, win_prices_loaded, costs_loaded }
  ```

## Supabase tables

### Read (all paginated by 1000)

- `nsn_catalog` — AX master (24K NSNs)
- `nsn_costs` — pre-computed cost waterfall
- `awards` — winning-bid history for pricing
- `fsc_heatmap` — hot/warm FSCs for channel assignment
- `ndc_nsn_map` — pharma NDC → NSN
- `abe_bids` — already-bid lookup
- `dibbs_solicitations` — rows to enrich

### Written

- `dibbs_solicitations` — 13 columns updated per row (see pipeline)
- `sync_log` — one row per enrichment run

## Business invariants

1. **AX priority over Master DB** — AX catalog checked first, Master DB only as fallback.
2. **Winning history priority** — if we've won this NSN before at margin >5%, reuse that price over any bracket math.
3. **5% margin floor** — if winning history was thin, apply `cost × 1.10` instead.
4. **Channel = "lamlinks"** if FSC is in `fsc_heatmap` (hot or warm); otherwise `"dibbs_only"`.
5. **FOB=D always estimates shipping** — non-D solicitations don't get shipping subtracted.
6. **Cost source determines score confidence** — recent_po_2mo = 10 pts, older_po = 3 pts (see `src/lib/bid-score.ts:73-82`).
7. **Pagination is always 1K batches** — Supabase's default limit. Missing data if any batch fails silently.
8. **Enrichment only runs on `is_sourceable=false` rows** — once enriched, only `reprice` can change the price.

## Known gaps / TODOs

- **Railway 30s timeout** — large enrichment batches may be cut off mid-flight. No resume logic.
- **Master DB silent failure** — 15s timeout, caught and ignored (enrich:63-80). If MDB is slow/down, `mdbNsnSet` is empty and we silently miss matches.
- **In-memory reference data goes stale mid-run** — if `nsn_catalog` or `nsn_costs` is updated during enrichment, the in-flight batch doesn't see new data.
- **No per-row error tracking** — if 1 of 5K updates fails, the report still says success.
- **NSN exact-string match only** — no fallback for malformed NSN (missing digit, different dash format).
- **NDC mapping loaded but unused in current logic** — comment-only code at 82-93.
- **Pricing bracket boundaries are brittle** — cost of $24.99 vs $25.01 flips 1.64x → 1.36x, a 17% price shift from a 1¢ cost change.
- **Winning history dedup** — if an NSN has multiple awards across different FSCs, only the most-recent-by-date wins (first-win-only in line 55).
- **FOB shipping brackets are crude** — no weight/carrier/zipcode logic, just flat dollar amounts per price bucket.
- **Reprice is never automatic** — winning-bid prices stay stale until manually invoked. Should auto-run after each award import.
- **`reprice` ignores non-sourceable rows** — if an item was previously unsourceable and suddenly has a cost (AX sync updated), reprice won't pick it up; only enrich will.

## Referenced files

- `src/app/api/dibbs/enrich/route.ts` — full pipeline
  - Reference loads: 18-93
  - NSN match: 159-165
  - Cost lookup: 167-170
  - Pricing: 178-210
  - Channel: 218-219
  - FOB shipping: 222-238
  - Update: 245-264
  - Log: 285-288
- `src/app/api/dibbs/reprice/route.ts` — price-only refresh
- `src/lib/bid-score.ts` — cost confidence mapping (73-82)
- `src/lib/pricing.ts` — bracket math + fallback (240-245 for 18% default)
- `scripts/find-nsn-matches.ts` — PUB LOG P/N matching (separate one-shot pass)
- `scripts/sync-ax-barcodes.ts` — AX → nsn_catalog sync
