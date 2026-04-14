# Flow: Scraping & Ingestion

Getting solicitations, awards, and live bids from external systems into Supabase.
Does NOT cover enrichment (NSN matching, pricing — see [enrichment.md](./enrichment.md)).

## Entry points

| Source | Trigger | Endpoint / Script | Frequency |
|--------|---------|-------------------|-----------|
| DIBBS HTTP scrape | GitHub Actions cron | `POST /api/dibbs/scrape-now` | 6am + 12pm ET weekdays (cron `0 11,17 * * 1-5` UTC) |
| LamLinks solicitations import | Manual script | `scripts/import-lamlinks-solicitations.ts` | On-demand (local Windows box with SQL access) |
| LamLinks awards import | Manual script | `scripts/import-lamlinks-awards.ts` | On-demand (weekly-ish) |
| Abe's live bids sync | Windows Task Scheduler (proposed) | `scripts/sync-abe-bids-live.ts` | Every 5 min (local poll) |
| Shipping sync | Manual script | `scripts/sync-shipping.ts` | On-demand |
| Legacy DIBBS Playwright | Unused | `POST /api/dibbs/scrape` | Deprecated |

## Pipeline

### DIBBS HTTP scrape

```
[GitHub Actions cron] → POST /api/dibbs/scrape-now
       │
       ▼
[Load fsc_expansion table]
[Read last sync_log.details.active_fscs to skip LamLinks-covered FSCs]
[Apply 4-hour dedup window — skip FSCs scraped in last 4h]
       │
       ▼
[Accept DIBBS consent: GET + POST dodwarning.aspx, capture dw cookie]
       │
       ▼
[Batch into 30-FSC chunks, 5 parallel fetches each]
[Per-FSC: GET /Rfq/RfqRecs.aspx?category=FSC&value={fsc}&scope=today]
[Parse HTML table rows → NSN, solicitation_number, qty, issue_date, return_by_date]
       │
       ▼
[Upsert to dibbs_solicitations in batches of 100, onConflict (solicitation_number, nsn), ignoreDuplicates]
       │
       ▼
[Auto-trigger POST /api/dibbs/enrich]
[Log to sync_log action="scrape"]
```

### LamLinks solicitations import

```
[Local tsx script]
       │
       ▼
[SQL: k10 → k11 → k08 join, last 30 days]
[SQL: k34 → k35 join for competitor bids, last 90 days, top 5 CAGEs per NSN]
[SQL: distinct FSC list from k08 — saves as active_fscs to sync_log]
       │
       ▼
[Upsert to dibbs_solicitations, onConflict (solicitation_number, nsn)]
       │
       ▼
[Log to sync_log action="lamlinks_import" with active_fscs array]
```

### Abe's live bids sync

```
[Every 5 min via Task Scheduler]
       │
       ▼
[SQL: k34 → k35 → k11 → k10 → k08 → k33 join, today only]
[Derive status: "submitted" if batch sent%, "pending" if quotes added%, else "unknown"]
       │
       ▼
[Upsert to abe_bids_live, onConflict "bid_id"]
[Log to sync_log action="abe_bids_live_sync"]
```

### LamLinks awards import

```
[Local tsx script]
       │
       ▼
[SQL: k81 → k80 → k79 → k08 join, last 2 years, filter unit_price > 0]
       │
       ▼
[Upsert to awards, onConflict (contract_number, fsc, niin)]
[Log to sync_log action="lamlinks_awards_import"]
```

## API routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/dibbs/scrape-now` | POST | public | Main scraper — one batch of 30 FSCs |
| `/api/dibbs/scrape` | POST | public | **Legacy** — Playwright-based, not in production use |
| `/api/dibbs/sync-status` | GET | public | Returns `{ running, started_at }` (10-min auto-expiry) |
| `/api/dibbs/sync-status` | POST | public | `{ action: "start"\|"done" }` manual state marker |
| `/api/dibbs/enrich` | POST | public | Auto-called after scrape (see enrichment.md) |

### Request/response: `POST /api/dibbs/scrape-now`

- Body: empty
- Returns:
  ```ts
  {
    success: boolean,
    count: number,            // new solicitations inserted
    fscs_scraped: number,
    fscs_scraped_list: string[],
    fscs_remaining: number,   // still to be scraped in future calls
    fscs_total_expansion: number,
    fscs_from_lamlinks: number,
    errors: string[],
    elapsed_seconds: number,
    enrich: { /* enrichment summary */ }
  }
  ```

## External systems

| System | Protocol | Auth | Used for |
|--------|----------|------|----------|
| DIBBS | HTTPS + HTML parse | DoD consent cookie (`dw`) + ASP.NET `__VIEWSTATE` | Solicitation scraping, scope=today only |
| LamLinks SQL | mssql + Windows Auth | Trusted Connection (Windows domain) | k10/k11/k08, k33/k34/k35, k81/k80/k79 |
| Master DB API | HTTPS REST | `X-Api-Key` | Optional NSN cross-reference (15s timeout) |
| Supabase | PostgREST + SDK | Service role key | Persistence |

## Supabase tables

| Table | Written | Key fields | Source |
|-------|---------|-----------|--------|
| `dibbs_solicitations` | scrape + import | `nsn`, `solicitation_number`, `quantity`, `issue_date`, `return_by_date`, `fsc`, `set_aside`, `data_source`, `approved_parts`, `detail_url` | DIBBS + LamLinks |
| `abe_bids_live` | live sync | `bid_id`, `bid_time`, `solicitation_number`, `nsn`, `bid_price`, `bid_qty`, `lead_days`, `bid_status`, `synced_at` | LamLinks k33/34/35 |
| `awards` | awards import + DIBBS awards scrape | `contract_number`, `cage`, `fsc`, `niin`, `unit_price`, `quantity`, `award_date`, `fob`, `order_number`, `data_source` | LamLinks k81 + DIBBS |
| `sync_log` | all syncs | `action`, `details` (JSON), `created_at` | insert-only |
| `fsc_expansion` | seed only | `fsc_code`, solicitations_received, bids_placed, bid_rate_pct, status | Manual seed |
| `fsc_heatmap` | seed only | `fsc_code`, total_bids, bucket, dla_spend_6mo | Manual seed |

## Business invariants

1. **Solicitation dedup key**: `(solicitation_number, nsn)` upsert. Ignores duplicates on DIBBS inserts; updates on LamLinks.
2. **LamLinks priority**: DIBBS scraper skips FSCs where `fsc_code ∈ last_lamlinks_import.active_fscs`. The authoritative LamLinks data wins.
3. **4-hour dedup window**: DIBBS scraper will not re-scrape the same FSC within 4 hours. Tracked via `sync_log.details.fscs_scraped_list`.
4. **Railway timeout**: one batch = 30 FSCs, scraped in chunks of 5 parallel with 15s per-FSC timeout. Total < 30s.
5. **DIBBS consent flow**: GET consent → extract 28 hidden fields + session cookie → POST `butAgree=OK` with `redirect: "manual"` to capture `dw` cookie → send merged cookies on all subsequent requests. See [gotchas.md](../gotchas.md#the-dibbs-consent-saga).
6. **LamLinks competitor intel**: last 90 days of k34 bids, exclude self (0AG09), top 5 CAGEs per NSN.
7. **Awards 2-year window**: import limited to last 2 years, `unit_price > 0`.
8. **Abe's live bids are ephemeral**: queries must filter `.gte("bid_time", today)` or stale yesterday-data contaminates "already bid" logic.

## Known gaps / TODOs

- **HTML parse fragility** — no API, DIBBS UI changes break parsing. Current parser is regex-based, only `scope=today`.
- **No per-FSC retry queue** — errors logged to `sync_log.details.errors[]` as strings. If one FSC fails, no targeted retry on next run.
- **Rate limiting is implicit** — 5 parallel + 15s timeout. No explicit per-domain throttle. Could get IP-banned.
- **Master DB timeout not tracked** — if the 15s MDB fetch in enrichment fails, it's silently swallowed. No warning.
- **Abe's bid daemon has no heartbeat** — if the local Windows machine dies, syncing stops silently. No alerting.
- **No automatic LamLinks rotation** — if LamLinks imports stop, DIBBS scraper doesn't auto-expand to cover the missing FSCs until the `active_fscs` list decays.
- **No cleanup of expired solicitations** — rows stay in `dibbs_solicitations` forever. Memory/index bloat over time.
- **Shipping sync SQL file missing** — `scripts/tmp-shipping-v2.sql` is referenced by `sync-shipping.ts:26` but not in the repo.
- **Competitor intel filter is hardcoded** to CAGE 0AG09. Can't track other CAGEs without code change.
- **Legacy `/api/dibbs/scrape`** using Playwright is dead code. Can't run on Railway (native dep). Should be removed.

## Referenced files

- `src/app/api/dibbs/scrape-now/route.ts` — main scraper (consent flow at 122-169, parallel fetch 171-200, upsert 204-216)
- `src/app/api/dibbs/scrape/route.ts` — legacy, unused
- `src/app/api/dibbs/sync-status/route.ts` — manual sync state
- `src/app/api/dibbs/enrich/route.ts` — auto-called after scrape (see enrichment.md)
- `src/lib/dibbs-scraper.ts` — legacy Playwright scraper (not in prod flow)
- `.github/workflows/scrape-dibbs.yml` — cron (5-8), 8 batch curl calls (17-54)
- `scripts/import-lamlinks-solicitations.ts` — SQL 32-58, competitor 98-115, FSC list 128-136, upsert 154-156
- `scripts/sync-abe-bids-live.ts` — SQL 26-60, upsert 91
- `scripts/import-lamlinks-awards.ts` — SQL 27-51, upsert 79-81
- `scripts/sync-shipping.ts` — references missing SQL file
