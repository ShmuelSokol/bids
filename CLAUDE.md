@AGENTS.md

# DIBS — Government Bidding System

Intelligence layer on top of LamLinks for Ever Ready First Aid (CAGE 0AG09). ~$8-9M/year government business, ~500 orders/week.

## CRITICAL DEPLOYMENT RULES
- **NEVER add msnodesqlv8, mssql, playwright, or dotenv to package.json** (deps OR devDeps). They crash Railway builds (native compilation fails on Linux). Install locally with `npm install --no-save` only.
- **Railway auto-deploys from GitHub** — do NOT use `railway up`. Just `git push`.
- **Check deploy after every push**: `railway logs 2>&1 | tail -5` — look for "Ready in" (success) or errors.
- **Always run `npm run build` locally before pushing** to catch errors.
- **After pushing, verify with Playwright** that the page actually loads data (build passing ≠ working).

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
- **purchase_orders** + **po_lines** — generated POs from awards
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
