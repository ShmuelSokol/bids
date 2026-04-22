@AGENTS.md

# DIBS — Government Bidding System

Intelligence layer on top of LamLinks for Ever Ready First Aid (CAGE 0AG09). ~$8-9M/year government business, ~500 orders/week.

## Environment
- NEVER assume network drives (Z:, UNC paths like \\server\share) are accessible. If working directory is on a network drive and Bash fails, immediately suggest cloning to a local directory (C:\Projects or ~/projects) instead of repeatedly trying to fix the drive.
- If Bash tool fails due to working directory issues, try Read/Write tools as a fallback before giving up.

## Windows Compatibility
- Watch for CRLF/LF newline issues when editing files. Use consistent line endings.
- PowerShell commands differ from bash — don't assume Linux command syntax works.

## Debugging Rules
- When fixing bugs, always check for cascading effects in related files before committing. Run the app and verify the fix doesn't break other functionality.
- Do NOT attempt more than 3 different approaches to the same bug without stopping to explain the root cause analysis to the user and asking for direction.

## KNOWLEDGE BASE — read before non-trivial work

Narrative, long-form context lives in `docs/`. This file has the critical rules and quick reference. `docs/` has the *why*.

- `docs/overview.md` — what DIBS is and who uses it. Read first.
- `docs/architecture.md` — stack, deployment, data flow. Read before adding integrations or API routes.
- `docs/data-sources.md` — LamLinks, AX, DIBBS, PUB LOG, Master DB field guide. Read before touching scrapers or importers.
- `docs/pricing-logic.md` — empirical markup brackets and cost waterfall. Read before changing pricing.
- `docs/bidding-workflow.md` — Abe's daily flow and bid states. Read before changing the solicitations UI.
- `docs/gotchas.md` — **read this first when something breaks inexplicably**. Supabase 1K limit, DIBBS consent cookies, timezone bugs, etc.

When you learn something new that future sessions would benefit from, add it to the appropriate `docs/` page. Gotchas go in `gotchas.md` with symptom → cause → fix structure.

## CRITICAL DEPLOYMENT RULES
- **After ANY `npm install`, verify native deps:** `node -e "require('mssql/msnodesqlv8')"` — if it throws, run `npm install --no-save mssql msnodesqlv8`. A single npm install wiped sub-deps and caused a 5-day silent sync outage in April 2026.
- **NEVER add msnodesqlv8, mssql, playwright, or dotenv to package.json** (deps OR devDeps). They crash Railway builds (native compilation fails on Linux). Install locally with `npm install --no-save` only.
- **Railway auto-deploys from GitHub** — do NOT use `railway up`. Just `git push`.
- **Check deploy after every push**: `railway logs 2>&1 | tail -5` — look for "Ready in" (success) or errors.
- **Always run `npm run build` locally before pushing** to catch errors.
- **After pushing, verify with Playwright** that the page actually loads data (build passing ≠ working).
- **After editing Python files, always run a syntax check** (`python -c 'import py_compile; py_compile.compile("<file>")'`) before deploying.
- **Be aware of Railway 30-second timeouts** — never run batch operations synchronously in request handlers. Use background tasks, chunked processing, or local scripts (e.g. `scripts/reprice-all.ts`).

## AX ODATA RULES (learned the hard way)
- **AX OData silently caps filtered queries at 1,000 rows** — no `@odata.nextLink`, no error, no warning. Unfiltered bulk pulls paginate fine; the cap only bites on `$filter`'d queries.
- **NEVER write raw `fetch()` against AX with a `$filter`** — use the shared helpers: `scripts/ax-fetch.ts` (node scripts) or `src/lib/ax-fetch.ts` (API routes).
- **`fetchAxPaginated(token, url, opts)`** — follows nextLink, warns + returns `truncated=true` when the cap heuristic fires (exactly 1000 rows + no nextLink + has $filter).
- **`fetchAxByMonth(token, opts)`** — auto-chunks by a date field in monthly slices; auto-narrows to weekly if a month exceeds the cap. Use this when expected results may exceed 1000.
- **DD219 = `CustomerRequisitionNumber`** on PO lines (field `purchline.custreq`). Case variants exist — always use `toupper(CustomerRequisitionNumber) eq 'DD219'` or an OR filter.
- See `docs/gotchas.md` for full details on discovery and the detection heuristic.

## SUPABASE QUERY RULES (learned the hard way)
- **Supabase default limit is 1,000 rows** — `.limit(5000)` does NOT work, you MUST paginate with `.range()` or use parallel range queries.
- **NEVER use `unstable_cache`** — it breaks silently on Railway serverless (returns empty data, no error).
- **Only SELECT columns that EXIST in the table** — computed fields like `est_value` cause silent failures. Check the actual table schema, not what the code computes.
- **Railway serverless has a ~30s timeout** — while-loop pagination over 14K+ rows will time out. Use parallel `.range()` queries instead (e.g., `Promise.all([range(0,999), range(1000,1999)])`).
- **Always check Railway logs after deploy**: `railway logs -n 50` — Supabase errors only show in server logs, not in the browser.
- **Test with Playwright after every deploy** to verify data actually loads (server errors are swallowed in SSR).

## Deployment
- **GitHub:** ShmuelSokol/bids (master branch)
- **Railway:** auto-deploys from GitHub pushes
- **Supabase:** project `jzgvdfzboknpcrhymjob` (dibs-gov)
- **Live URL:** https://dibs-gov-production.up.railway.app
- **Supabase mgmt token:** in memory (for running SQL via API)

## Spelling
- Correct: **LamLinks** (one word, no B, capital L twice). Never "Lamb Links" or "Lam Links".

## npm
- Always run npm/node/npx from `C:\tmp\dibs-init\dibs`, never from UNC network paths.
- Native packages (mssql, msnodesqlv8, playwright, dotenv) install with `npm install --no-save`.

## Team
- **Abe Joseph** (ajoseph@everreadygroup.com) — does all military bidding, ~50 bids/day in LamLinks + DIBBS
- **Yosef Schapiro** (yschapiro@everreadygroup.com) — EDI/LamLinks admin, D365/AX admin
- **M Perl** (mperl@everreadygroup.com)
- **Shmuel Sokol** (ssokol@everreadygroup.com) — project lead

## Core Workflow (Abe's Daily Flow)

### Solicitations: Sourceable → Quoted → Submitted
1. **Sync Data** button scrapes DIBBS + auto-enriches (NSN matching, pricing, cost, already-bid check)
2. **Sourceable** = NSN matched in AX (first, authoritative) or Master DB, with suggested price
3. Default view filters out: expired (past due date), already bid in LamLinks, not sourceable
4. **Already bid detection**: exact solicitation number match against LamLinks k10_tab.sol_no_k10
5. Abe reviews, overrides price if needed + comment → **Quoted**
6. Select all quoted → batch **Submit**

### Pricing Logic (empirical from 2,591 bid-to-cost matches)
- Cost known: apply markup by bracket (<$25=1.64x, $25-100=1.36x, $100-500=1.21x, $500+=1.16x)
- Cost unknown: last award + bracket-adjusted increment (1-3%)
- Cost waterfall: Recent PO (2mo) → Recent PO (3mo) → Master DB → Price agreement (cheapest vendor) → Older PO
- Margin subtracts estimated shipping for FOB Dest items
- Winning formula: median 1.29x cost, 23% margin, 55 day lead time

### Awards → PO Generation
1. Filter awards by date range
2. Select all → "Generate POs" groups by supplier (CAGE code)
3. POs show line items with cost, sell price, margin
4. **Supplier switch**: click "Switch" on any line → modal shows all vendors with prices + last PO date → one-click move

## Connected Data Sources

### LamLinks SQL Server (local only — Windows Auth)
- Server: NYEVRVSQL001 / Database: llk_db1
- Helper: `scripts/llk-query.ts` — requires mssql/msnodesqlv8 (local install only)
- Key tables: k34/k35 (bids), k81 (awards), k08 (items), k10/k11 (solicitations)
- Solicitation numbers in k10_tab.sol_no_k10 match DIBBS format exactly

### D365 / AX
- Environment: `https://szy-prod.operations.dynamics.com`
- Auth: OAuth2 client credentials
- Government customer account: **DD219**
- Key entities: ProductBarcodesV3 (25K NSN + 31K UPC), VendorProductDescriptionsV2 (152K), PurchaseOrderLinesV2 (61K), PurchasePriceAgreements (134K)

### Master DB API
- URL: `https://masterdb.everreadygroup.com`
- Auth: X-Api-Key header
- Bulk export: GET /api/dibs/items/export (supports ?has_mfr=1, ?has_nsn=1)
- Write NSN: POST /api/dibs/nsn
- ~405K items, 192K with mfr_part_number, ~657 verified NSNs

### DIBBS
- No login needed for browsing — just consent banner (#butAgree)
- Search: `/Rfq/RfqRecs.aspx?category=FSC&value={fsc}&scope={today|open|recent}`
- Pagination: ASP.NET __doPostBack, max 500 results per FSC (10 pages × 50)
- Daily cron: GitHub Actions at 6am + 12pm ET (needs secrets in repo settings)

## Supabase Tables
- **dibbs_solicitations** (~1,646) — scraped solicitations with sourcing, pricing, already-bid, FOB, channel
- **bid_decisions** — Abe's approve/skip/submit decisions with comments
- **awards** (5,000) — LamLinks awards for bid history
- **abe_bids** (10,000) — Abe's recent bids with solicitation numbers for exact matching
- **nsn_catalog** (24K) — AX NSN→item mappings
- **nsn_costs** (24K) — best cost per NSN (waterfall applied)
- **nsn_vendor_prices** (34K) — per-vendor pricing for supplier switch (5,930 NSNs with 2+ vendors)
- **nsn_ax_vendor_parts** — per-(NSN, vendor) AX item record (used by NPI to decide add-supplier vs new-item)
- **nsn_upc_map** (74) — optional UPC per NSN from AX ProductBarcodesV3; powers UPC row in NPI BarCode tab. Refresh via `scripts/populate-nsn-upc-map.ts`.
- **nsn_review_overrides** — review-once state keyed by (nsn, vendor). Abe's fixes in the /orders Review tab AND the /solicitations Sourcing modal land here. generate-pos reads this first to skip the COST UNVERIFIED / waterfall path.
- **nsn_sourcing_notes** — append-only note history per NSN (nullable vendor). New entry each time Abe types into "Add a note" in the sourcing modal. Used to preserve context like "blocked with Medline" across re-listings of the same NSN.
- **purchase_orders** + **po_lines** — generated POs from awards. `purchase_orders.dmf_state` drives the AX write-back state machine (`drafted` → `awaiting_po_number` → `lines_ready` → `awaiting_lines_import` → `posted`). `ax_po_number` populated after AX auto-assigns.
- **fsc_heatmap** (332) — hot/warm/cold FSC categories
- **fsc_expansion** (464) — solicitation vs bid rates by FSC
- **usaspending_awards** (10K) — DLA awards from USASpending
- **sync_log** — tracks every scrape/enrich with details
- **profiles** — auth users with roles

## Key env vars (in .env, NOT committed)
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- MASTERDB_API_KEY, MASTERDB_URL
- AX_TENANT_ID, AX_CLIENT_ID, AX_CLIENT_SECRET, AX_D365_URL
- DIBBS_USERNAME, DIBBS_PASSWORD
- GITHUB_TOKEN (for bug reporter)

## GitHub Actions Secrets Needed
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
(Add at https://github.com/ShmuelSokol/bids/settings/secrets/actions)
