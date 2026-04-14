# Flow: Analytics

Win/loss analytics, FSC performance, expansion targeting.

## Entry points

| Path | Purpose |
|------|---------|
| `/analytics` | Main dashboard — FSC heatmap, win rates, DLA spend |
| `/analytics/expansion` | FSC expansion candidates (unbid, low-rate, active) |
| `/analytics/competitors` | **Mock data only** — placeholder |

## Data sources

- `fsc_heatmap` — pre-computed per-FSC metrics, ordered by `total_bids` desc, limit 500.
- `awards` — filtered by `cage=0AG09`, loaded via parallel range queries (0-999, 1000-1999, etc.) to get past the 1K Supabase limit.
- `fsc_expansion` — FSC expansion targets with status (unbid / low_rate / active).

## Metrics computed

| Metric | Formula | File:line |
|--------|---------|-----------|
| Per-FSC win rate | `(awards_won / total_bids) * 100` | `/analytics/page.tsx:32` |
| Overall win rate | `(totalAwards / totalBids) * 100` | `:38` |
| FSC heat bucket | Pre-computed (`hot` / `warm` / `cold`) stored in `fsc_heatmap.bucket` | `:47` |
| 6-month DLA spend | Sum of `fsc_heatmap.dla_spend_6mo` | `:39` |
| Expansion bid rate | `bids_last_6mo / sols_last_6mo` | `/analytics/expansion/page.tsx` |
| Expansion status | Categorization: unbid (no bids), low_rate (<10%), active | `:24-29` |

## Supabase tables

| Table | Columns read |
|-------|-------------|
| `fsc_heatmap` | `fsc_code`, `total_bids`, `bids_last_6_months`, `bids_last_month`, `dla_spend_6mo`, `bucket` |
| `awards` | `fsc` (filtered to `cage=0AG09`) |
| `fsc_expansion` | `fsc_code`, `status`, `sols_last_6mo`, `bids_last_6mo`, `bids_placed`, `solicitations_received`, `bid_rate_pct` |

## Known gaps / TODOs

- **Parallel range queries are a band-aid** — manual 5-range split for awards. Needs cursor/keyset pagination or a materialized view.
- **Stale pre-computed data** — `fsc_heatmap` and `fsc_expansion` are seeded, no refresh timestamp. Could be days old.
- **Sampling skew** — win-rate formula `(awards / bids)` assumes every bid has a corresponding award record. Historical data loss skews low.
- **No data-source labels** — metrics don't indicate whether they came from DIBBS, LamLinks, or USASpending. Causality unclear.
- **Hot/Warm/Cold algorithm is opaque** — bucket assignment logic not in the app. Unclear if based on velocity, rate, or spend threshold.
- **No time-series** — snapshot only, no trend charts or month-over-month comparisons.
- **Competitors page uses mock hardcoded CAGEs** — no live join with `awards` to show true competitive set.
- **No export** — can't download FSC tables as CSV for external analysis.

## Referenced files

- `src/app/analytics/page.tsx` — main dashboard (getData 5-42, FSC loop, win rate 32, overall 38, DLA spend 39)
- `src/app/analytics/expansion/page.tsx` — expansion categories (8-11, 24-29)
- `src/app/analytics/competitors/page.tsx` — mock data only
