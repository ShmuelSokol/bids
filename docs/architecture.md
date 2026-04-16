# Architecture

How the pieces actually fit together, what runs where, and why.

## The stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4) — the UI and the API layer.
- **Supabase** (Postgres + Auth + RLS) — project `jzgvdfzboknpcrhymjob`, aka `dibs-gov`. Source of truth for everything DIBS-native.
- **Railway** — hosts the Next.js app, auto-deploys from GitHub pushes to `master`.
- **GitHub Actions** — runs the cron-based scrapers (DIBBS scrape 2x/day, job processor every 10 min).
- **LamLinks SQL Server** (NYEVRVSQL001/llk_db1) — read-only mirror of the vendor's internal DB. Windows Auth only, accessible from the local Windows box.
- **D365 / AX** — OData API, OAuth2 client credentials. Source for NSN→item mappings and pricing history.
- **Master DB** — FastAPI service at `masterdb.everreadygroup.com`. 405K item records.
- **Chrome headless** — local PDF generation (daily briefings).
- **Twilio WhatsApp** — daily briefing delivery + auto-fix error notifications.
- **Playwright** (CI only) — visual regression tests on staging deploys.

## Why Next.js, not a separate API

The alternative was a Python FastAPI backend and a separate React frontend. We chose Next.js because:

- **One deployment unit.** Railway auto-deploys one thing. Shipping the app and API together means no version drift.
- **Server components for data loading.** Pages like `/solicitations` load 3,000+ rows from Supabase and render server-side. This is 10x faster than client-side fetching for our data volumes.
- **API routes under `src/app/api/`** are colocated with the UI that uses them. When we change a Supabase column, we update the page and the API route in the same PR.

The tradeoff: we can't run the app on a CDN (no static export), and Railway serverless has a **~30s timeout** that shapes everything we do in API routes.

## Data flow, end to end

```
┌──────────────┐   GitHub Actions cron
│   DIBBS      │◀── (6am, 12pm ET)
│ (scraper)    │                          ┌──────────────────┐
└──────┬───────┘                          │  Railway         │
       │                                  │  (Next.js app)   │
       ▼                                  │                  │
┌──────────────┐                          │  /api/dibbs/*    │
│  Supabase    │◀─────────────────────────│  /api/jobs/*     │
│  (dibs-gov)  │                          │  /api/awards/*   │
│              │                          │  /api/whatsapp/* │
│  - solicits  │                          │                  │
│  - awards    │                          │  /wiki/*         │
│  - decisions │◀─────────────────────────│  /solicitations  │
│  - jobs      │                          │  /dashboard      │
│  - nsn_*     │                          └──────────────────┘
└──────┬───────┘                                    ▲
       │                                            │
       │                                            │
       │     ┌────────────┐      ┌──────────┐       │
       └────▶│  LamLinks  │◀─────│  Local   │───────┘
             │  SQL (R/O) │      │  scripts │
             └────────────┘      └──────────┘
                   ▲
                   │
             ┌──────────┐
             │   AX /   │
             │   D365   │  (OAuth2 OData)
             └──────────┘
```

The key thing to internalize: **Railway has no access to LamLinks SQL Server**. It's a local network resource, Windows Auth, accessible only from the office box. That's why every LamLinks-touching script (`sync-abe-bids-live`, `import-lamlinks-solicitations`, `import-lamlinks-awards`, `sync-shipping`) runs locally and writes into Supabase. Railway only reads the Supabase copy.

These scripts are scheduled via Windows Task Scheduler on the office Windows box — see `scripts/windows/README.md` for install and verification. The scheduled jobs are the only way fresh data flows into DIBS; if the office box goes offline for more than a few hours, the whole pipeline visibly stales (we saw this from 2026-03-27 through 2026-04-14: dashboard sourceable count was correct, but the underlying inventory had expired because nothing was syncing).

This constraint drove several design decisions:

- Abe's live bids are synced *into* Supabase, not queried live from LamLinks.
- Awards are imported in bulk (34K rows) rather than queried on-demand.
- Any future bid-submission automation has to run locally too (or go through a hole-punched VPN tunnel — not scoped).

## Deployment

- **GitHub**: `ShmuelSokol/bids` (private), master branch (production) + staging branch.
- **Production Railway**: auto-deploys from `master` at `https://dibs-gov-production.up.railway.app`. Supabase project: `jzgvdfzboknpcrhymjob`.
- **Staging Railway**: auto-deploys from `staging` at `https://dibs-gov-staging-staging.up.railway.app`. Supabase project: `envwajwgsmuyskmtwsxv` (dibs-staging).
- **Workflow**: feature branch → PR to staging → merge → Railway deploys staging → Playwright visual tests run → PR to master → merge → production deploys.
- **Playwright visual regression** runs automatically on every staging push (GitHub Actions). Screenshots 8 key pages, checks for error boundaries, compares against baselines.
- **Verify**: after every push, hit the live URL with Playwright to confirm the feature actually works. Build passing ≠ working.

**Never `railway up`.** Push to GitHub. Railway watches the repo.

## Environment boundaries

There's a hard rule that keeps biting people who forget it: **never add `msnodesqlv8`, `mssql`, `playwright`, or `dotenv` to `package.json`** (deps OR devDeps). They contain native C++ addons that fail to compile on Railway's Linux build machine, which crashes the entire deploy. These packages are installed locally with `npm install --no-save` and used only by local scripts that never run on Railway.

This means there are two classes of code in this repo:

1. **Railway-safe code** — everything in `src/app/`, `src/lib/`, `src/components/`. Uses only pure-JS deps.
2. **Local-only scripts** — everything in `scripts/`. Can use native packages. Must never be imported from Railway-safe code.

The build system doesn't enforce this. Discipline does.

## Auth and middleware

Everything in the app is gated behind a Supabase Auth login, except a handful of public API paths (see `src/middleware.ts`). The auth cookie is `sb-access-token`. The middleware redirects unauthenticated users to `/login` for any non-public path.

Public paths (no auth required):

- `/login`
- `/api/auth/*` (login/logout)
- `/api/dibbs/*` (scraper triggers — called by GitHub Actions)
- `/api/jobs/*` (background job processor)
- `/api/awards/*` (read-only award history for the details panel)
- `/api/notifications`, `/api/bug-report`, `/api/track`, `/api/bugs/respond`
- `/api/whatsapp/*` (briefing sender)

Everything else — dashboard, solicitations, orders, wiki — requires login.

## Key pages and what they do

| Route | Purpose |
|-------|---------|
| `/` (dashboard) | Sourceable count, today's bids, bid potential, sync controls |
| `/solicitations` | Abe's working list — Sourceable/Quoted/Submitted/Skipped tabs. Default: DIBBS-only (SPE\* prefix). Toggle to show all including W\* (Army, not bidable via LamLinks). |
| `/solicitations/[id]` | Detail panel — cost waterfall, award history, bid form |
| `/bids/today` | Abe's bids placed today (display-only, reads abe_bids_live) |
| `/orders` | Awards → PO generation. Group by supplier, supplier-switch with vendor P/N + AX item # from 152K vendor_parts, add new supplier |
| `/orders/followups` | PO follow-up surface |
| `/invoicing` | Invoice state monitor — tracks LamLinks kad_tab state transitions |
| `/invoicing/followups` | **New 2026-04-16.** Three panels: (1) posted invoices awaiting DLA payment (amber 21-30d / red >30d), (2) award↔PO linkage buckets (no PO / backorder / received / shipped), (3) open DD219 government POs in AX |
| `/lookup` | **New 2026-04-16.** NSN probe — enter any NSN, queries every source live: AX barcodes, nsn_costs, vendor prices, awards, bids, solicitations, PUB LOG. Debug tool for "is the bug in DIBS or the source?" |
| `/so` | Sales order pre-validation — upload awards, check DODAAC + NSN match in AX before handing to Yosef's MPI |
| `/shipping` | Shipping status tracker |
| `/settings/*` | Admin: FSC codes, DIBBS sync, import, suppliers, activity log, bugs |
| `/wiki` | Auto-rendered from `docs/*.md` — overview, architecture, data-sources, pricing, workflow, gotchas |

## Background jobs

Jobs live in the `background_jobs` Supabase table. The processor at `/api/jobs/process` runs every 10 minutes (via GitHub Actions) and pulls 2 jobs per type (fair rotation):

- `supplier_discovery` — search for alternate vendors per NSN. Currently blocked — Google and DuckDuckGo both block Railway IPs.
- `usaspending_awards` — pull competitor award data from USASpending API.
- `nsn_crawl` — hunt for more NSN metadata.
- `award_lookup` — pull award details from DIBBS given a solicitation.

Jobs that fail get retried up to 3 times. Jobs that hit rate limits get re-queued with backoff.

## Observability

There isn't much. The tools we have:

- **`railway logs -n 50`** — the production application log. First thing to check when SSR returns zeros and you don't know why. Supabase errors in server code only surface here, not in the browser.
- **`sync_log` table in Supabase** — every scrape, enrich, and import writes a row here with a JSON `details` blob. The daily WhatsApp briefing reads these.
- **Playwright** — take a screenshot after every meaningful change. The dashboard numbers changed? Screenshot it. Does it match what you expect? If not, the deploy hasn't landed yet or something is genuinely broken.

What we *don't* have: Sentry, Datadog, anything like that. A ~500-orders/week business doesn't warrant it yet. When we start writing to LamLinks we'll need real alerting.
