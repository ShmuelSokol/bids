# Flow: Bidding

Abe's daily loop. Solicitations arrive, get reviewed, priced, and submitted.

## Entry points

| Path | Who | Purpose |
|------|-----|---------|
| `/` (dashboard) | Abe | Overview + "Top Sourceable by Value" + Abe's bids today (top 20). Links to `/solicitations?filter=sourceable` and `/bids/today`. |
| `/bids/today` | Abe | Full sortable, filterable view of all of Abe's live bids from LamLinks today (often 600+). Loads from `abe_bids_live` filtered to today. **Click any row to expand inline NSN history** (awards + prior bids) — uses the same `<NsnHistoryDetail>` component as the solicitations detail panel. |
| `/solicitations` | Abe | Main working list. Default filter = `sourceable`. |
| `/solicitations?filter=<X>` | Abe | Filters by state: `sourceable`, `quoted`, `submitted`, `skipped`, `already_bid`, `all_unsourced`, `ll_active`, `dibbs_only`, `expired`, `all`. |
| `/solicitations?sort=<X>` | Abe | Sorts: `score`, `value`, `margin`, `qty`, `due`. |
| `/solicitations/[id]` | Abe | Detail page for a single solicitation (currently the client-side detail panel does most of the work). |

## State machine

A row in `dibbs_solicitations` is in exactly one state:

```
                     ┌──────────────┐
                     │  UNSOURCED   │  is_sourceable = false
                     └──────┬───────┘
                            │ enrich finds NSN match
                            ▼
 ┌──────────────┐     ┌──────────────┐      ┌──────────────┐     ┌──────────────┐
 │  ALREADY     │◀────│  SOURCEABLE  │─────▶│   QUOTED     │────▶│  SUBMITTED   │
 │  BID         │     │              │      │              │     │              │
 └──────────────┘     └──────┬───────┘      └──────────────┘     └──────────────┘
                             │
                             │ Abe clicks "Skip"
                             ▼
                      ┌──────────────┐
                      │   SKIPPED    │
                      └──────────────┘

                      ┌──────────────┐
                      │   EXPIRED    │ (return_by_date < today, filter-only pseudo-state)
                      └──────────────┘
```

### State predicates

Defined canonically in `src/lib/solicitation-filters.ts`:

| State | Predicate |
|-------|-----------|
| `sourceable` (open) | `is_sourceable && !already_bid && !bid_status && !liveBidSols.has(sol#) && !decisionKeys.has(sol#_nsn) && isOpen(return_by_date)` |
| `quoted` | `bid_decisions.status === "quoted"` |
| `submitted` | `bid_decisions.status === "submitted"` |
| `skipped` | `bid_decisions.status === "skipped"` |
| `already_bid` | `dibbs_solicitations.already_bid === true` OR `solicitation_number ∈ abe_bids_live (today)` |
| `unsourced` | `is_sourceable === false` |
| `expired` | `!isOpen(return_by_date)` — MM-DD-YYYY → YYYY-MM-DD string compare, not `new Date()` |

### Transitions

| From | To | Trigger | Code |
|------|-----|---------|------|
| Unsourced | Sourceable | NSN match found during enrichment | `src/app/api/dibbs/enrich/route.ts` |
| Sourceable | Quoted | `handleApprove(sol)` | `src/app/solicitations/solicitations-list.tsx:321` |
| Sourceable | Skipped | `handleSkip(sol)` | `solicitations-list.tsx:356` |
| Quoted | Submitted | `handleSubmitAll()` (batch) | `solicitations-list.tsx:382` |
| Any | Already Bid | LamLinks sync writes to `abe_bids_live` | `scripts/sync-abe-bids-live.ts` |
| Sourceable → Sourceable (price refresh) | Reprice | `POST /api/dibbs/reprice` | `src/app/api/dibbs/reprice/route.ts` |

**No reverse transitions exist in code.** A quoted bid can be re-quoted (upsert on `bid_decisions`), but there's no explicit "unquote" button. Skipped items can be re-quoted by overwriting the decision row.

## User actions

### On the dashboard (`/`)

| Action | Element | Result |
|--------|---------|--------|
| Click "Total Open Bid Potential" card | Green gradient card (top) | → `/solicitations?filter=sourceable&sort=value` |
| Click Sourceable stat | Green card | → `/solicitations?filter=sourceable` |
| Click Quoted stat | Blue card | → `/solicitations?filter=quoted` |
| Click Submitted stat | Purple card | → `/solicitations?filter=submitted` |
| Click No Source stat | Amber card | → `/solicitations?filter=all_unsourced` |
| Click Total stat | Grey card | → `/solicitations?filter=all` |
| Click row in Top Sourceable table | Any NSN cell | Navigates to solicitation detail (or link) |

### On the solicitations page (`/solicitations`)

#### Top bar buttons

| Button | Handler | API | Notes |
|--------|---------|-----|-------|
| "Sync Data" | `handleSync` | `POST /api/dibbs/scrape-now` then `POST /api/dibbs/enrich` | Calls both sequentially |
| "Enrich" (hidden behind Sync) | `handleEnrich` | `POST /api/dibbs/enrich` | Standalone enrichment |
| "Reprice" (hidden) | — | `POST /api/dibbs/reprice` | Recomputes suggested_price using winning-history priority |

#### State-tab buttons (pipeline stats)

Clicking changes `filter` state. 5 tabs: Sourceable, Quoted, Submitted, Skipped, Bid in LL.

#### Source-filter badges

| Badge | Filter key |
|-------|-----------|
| LamLinks FSCs | `ll_active` |
| DIBBS Expansion | `dibbs_only` |
| No Source | `all_unsourced` |
| All | `all` |

#### Search + column filters

- Search box: matches NSN, nomenclature, solicitation number, FSC (`searchQuery` state, client-side).
- Date filter dropdown: All / Today / Today+Yesterday / This Week / Closing Soon.
- FSC / Score / FOB / Margin / Source / Qty / Value column filters — all client-side on the loaded dataset.

#### Row actions

| Button | Condition | Handler | Effect |
|--------|-----------|---------|--------|
| Row click | any state | `setDetailId(sol.id)` | Opens inline detail panel (right side) |
| "Quote" button in detail panel | `sourceable` only | `handleApprove(sol)` | POST to `/api/bids/decide` with `status=quoted` + final_price from `editPrice` field |
| "Skip" button in detail panel | `sourceable` only | `handleSkip(sol)` | POST to `/api/bids/decide` with `status=skipped` |
| "Find Suppliers" button | row-level | `handleFindSuppliers(sol)` | GET `/api/solicitations/find-suppliers?nsn=X` |
| "Check DIBBS" button | detail panel | — (inline fetch) | GET `/api/dibbs/check-open?sol=X` |
| Checkbox in Quoted tab | `bid_status === "quoted"` only | Toggles `selectedQuoted` Set | Selection state for batch |
| "Select all quoted" | Quoted tab only | Toggles all quoted into `selectedQuoted` | |
| "Submit N Bids" | Quoted tab, `selectedQuoted.size > 0` | `handleSubmitAll()` | Loops POST to `/api/bids/decide` with `status=submitted` for each selected |

## API routes

### `POST /api/bids/decide`

**Auth required** (session cookie via `getCurrentUser()`). Otherwise 401.

Body:
```ts
{
  solicitation_number: string,  // required
  nsn: string,                  // required
  status: "quoted"|"submitted"|"skipped",  // required
  nomenclature?: string,
  quantity?: number,
  suggested_price?: number,
  final_price?: number | null,
  lead_time_days?: number,  // default 45
  comment?: string | null,
  source?: string,
  source_item?: string,
}
```

Upserts into `bid_decisions` with `onConflict: "solicitation_number,nsn"`.

Fires `trackEvent({ eventType: "bid", eventAction: status })` via `src/lib/track.ts`.

### `POST /api/dibbs/reprice`

No auth in middleware (public path). Recomputes `suggested_price` and `margin_pct` for sourceable items, favoring winning-bid history over bracket markup.

### `GET /api/dibbs/check-open?sol=X`

No auth. Hits DIBBS directly with the full consent cookie flow, returns `{ is_open, checked_at }`.

### `GET /api/solicitations/find-suppliers?nsn=X`

Queries AX `VendorProductDescriptionsV2` + Master DB for alternate vendor pricing.

### `POST /api/quotes/export`

Takes `{ quotes, format: "lamlinks"|"dibbs", download?: boolean }` and returns a CSV (`LamLinks batch format` or `DIBBS batch format`). Not currently wired to a UI button — the export helper is used but no button surface exists in the bidding flow at present.

## Supabase tables

### Read in this flow

| Table | Columns used |
|-------|--------------|
| `dibbs_solicitations` | all (see `cols` in `solicitations/page.tsx:22`) |
| `bid_decisions` | `solicitation_number, nsn, status, final_price, comment, decided_by` |
| `abe_bids_live` | `nsn, bid_price, lead_days, bid_qty, bid_time, fob, solicitation_number` (filtered to today) |
| `nsn_matches` | `nsn, match_type, confidence, matched_part_number, matched_description, matched_source` (limit 1000) |
| `sync_log` | latest row for "last sync" badge |

### Written in this flow

| Table | When | By |
|-------|------|-----|
| `bid_decisions` | On quote/skip/submit | `/api/bids/decide` |
| `user_activity` | Every decision | `trackEvent()` via `/api/track` |
| `dibbs_solicitations` | On reprice | `/api/dibbs/reprice` |

## External systems

- **DIBBS** — `check-open` only (live solicitation status check).
- **No direct writes to LamLinks or AX from this flow.** Submission to LamLinks is currently manual copy-paste.

## Business invariants

1. **Exactly one `bid_decisions` row per `(solicitation_number, nsn)`.** Enforced by `onConflict`.
2. **A row can only be quoted/submitted/skipped if `is_sourceable = true`.** (Not enforced in the API — the UI hides the buttons on non-sourceable rows, but `/api/bids/decide` doesn't check.)
3. **`final_price` should be set when `status = "quoted"` or `"submitted"`.** Not enforced — `null` is allowed.
4. **Sourceable count = dashboard count.** Both pages must use `isSourceableOpen()` from `src/lib/solicitation-filters.ts`. Enforced by shared helper.
5. **`abe_bids_live` must always be filtered to today.** Stale rows contaminate `already_bid` flagging. Enforced in both `src/app/page.tsx:39` and `src/app/solicitations/page.tsx:44`.
6. **Date comparisons use `YYYY-MM-DD` string comparison, never `new Date()`.** Timezone hazard. Enforced in `isOpenSolicitation()` + the client useMemo counts in `solicitations-list.tsx:176`.
7. **Decided_by is populated from `profile.full_name` or email.** Set by `/api/bids/decide` — not nullable in practice but not enforced by DB.
8. **Default lead time = 45 days.** Hardcoded in `/api/bids/decide:42`.

## History on detail panel

When a row is clicked, the detail panel opens and `loadNsnHistory()` lazy-fetches `/api/awards/search?nsn=X` to populate three tables side-by-side:

- **Our Awards** — historical wins for this NSN from the `awards` table (LamLinks k81 import)
- **Our Bids** — historical bids on this NSN from `abe_bids`
- **Item spec** — best-known title + UoM + manufacturer part number from PUB LOG (`publog_nsns` table)

The cache (`historyCache: Map<nsn, ...>`) is per-session and persists across row toggles. If the API returns 5xx the cache is populated with an empty result so we don't spin retrying.

If a freshly-imported NSN shows "No awards / No bids on record" — that's truthful, not a bug. We may simply have never bid on or won that item before.

## Known gaps / TODOs

- **Submission to LamLinks is not automated.** "Submit" just writes `status=submitted` to `bid_decisions`. Abe still copy-pastes to LamLinks. Blocker: Yosef verification of `k33/k34/k35` chain.
- **No server-side auth check that the user can modify this decision.** Any authenticated user can overwrite any other user's `bid_decisions` row. (RLS not configured on `bid_decisions`.)
- **No audit trail on decision changes.** Upsert overwrites the previous row. `updated_at` is the only trace. If Abe quotes then changes his mind, we lose the original price.
- **`handleSubmitAll` POSTs sequentially in a loop.** For 50 bids this is ~2-3 seconds of sequential API calls. Could be parallelized (or a batch endpoint added).
- **`/api/quotes/export` has no UI surface.** The helper exists and works but no button in `solicitations-list.tsx` invokes it.
- **Reprice button is not user-visible.** Only triggered by Sync Data's auto-enrich flow.
- **No unquote/unsubmit action.** If Abe submits a bid by mistake, he has to manually clean up the `bid_decisions` row.
- **`bid_decisions` foreign-keying** is by `(solicitation_number, nsn)` string match, not by `dibbs_solicitations.id`. If a solicitation is re-imported with a different ID, the decision silently follows (usually correct, but non-obvious).
- **No rate limiting on `/api/bids/decide`.** An authenticated user could DOS the endpoint.
- **`find_suppliers` results are not cached.** Hitting AX repeatedly for the same NSN.
- **The detail panel's bid history loads lazily but never refreshes.** If an award lands while the panel is open, it won't show until the panel reopens.

## Referenced files

- `src/app/page.tsx` — dashboard
- `src/app/solicitations/page.tsx` — server-side list loader
- `src/app/solicitations/solicitations-list.tsx` — client-side list + detail panel (~1500 lines)
- `src/app/solicitations/[id]/page.tsx` — individual solicitation page (less-used)
- `src/app/api/bids/decide/route.ts` — the one write endpoint for bid state
- `src/app/api/dibbs/enrich/route.ts` — pricing + NSN matching
- `src/app/api/dibbs/reprice/route.ts` — reprice existing sourceable rows
- `src/app/api/dibbs/check-open/route.ts` — live DIBBS status check
- `src/app/api/solicitations/find-suppliers/route.ts` — alternate vendor search
- `src/app/api/quotes/export/route.ts` — CSV batch export (orphaned)
- `src/lib/solicitation-filters.ts` — shared `isSourceableOpen()`, `isOpenSolicitation()`
- `src/lib/bid-score.ts` — AI score (0-100)
- `src/lib/quote-exporter.ts` — LamLinks/DIBBS CSV generators
- `src/lib/track.ts` — activity tracking
