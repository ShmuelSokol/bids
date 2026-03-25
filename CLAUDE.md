@AGENTS.md

# DIBS — Government Bidding System

Intelligence layer on top of LamLinks for ERG Supply (CAGE 0AG09). ~$8-9M/year government business, ~500 orders/week.

## Deployment
- **GitHub:** ShmuelSokol/bids (master branch)
- **Railway:** auto-deploys from GitHub pushes — do NOT use `railway up`
- **Supabase:** project `jzgvdfzboknpcrhymjob` (dibs-gov)
- **Live URL:** https://dibs-gov-production.up.railway.app

## Spelling
- Correct: **LamLinks** (one word, no B, capital L twice). Never "Lamb Links" or "Lam Links".

## npm
- Always run npm/node/npx from `C:\tmp\dibs-init\dibs`, never from UNC network paths.

## Team
- **Abe Joseph** (ajoseph@everreadygroup.com) — does all military bidding, ~50 bids/day in LamLinks + DIBBS
- **Yosef Schapiro** (yschapiro@everreadygroup.com) — EDI/LamLinks admin, D365/AX admin
- **M Perl** (mperl@everreadygroup.com)
- **Shmuel Sokol** (ssokol@everreadygroup.com) — project lead

## Connected Data Sources

### LamLinks SQL Server
- Server: NYEVRVSQL001 / Database: llk_db1 / Windows Auth
- Driver: msnodesqlv8 (`Driver={SQL Server};Server=NYEVRVSQL001;Database=llk_db1;Trusted_Connection=yes;`)
- Reusable helper: `scripts/llk-query.ts` (inline SQL or --file, optional --save)
- 217 tables, ~32M rows, 268 FKs, 261 views
- Key tables: k34_tab (492K bids), k35_tab (pricing), k81_tab (257K awards), k08_tab (365K items), k10_tab (solicitations), k11_tab (sol lines)
- Key views: clin_basic_1_view (awards), quote_metrics_1_view (bid+award+cost), our_quote_line_1_view (492K bids)
- Column naming: `{abbreviation}_{table_code}` (e.g. fsc_k08, up_k35)

### D365 / AX
- Environment: `https://szy-prod.operations.dynamics.com`
- Auth: OAuth2 client credentials (AX_TENANT_ID, AX_CLIENT_ID, AX_CLIENT_SECRET)
- Government customer account: **DD219** — filter all sales/invoice queries to this account
- Key entities: ProductBarcodesV3 (55K barcodes: 25K NSN + 31K UPC), AllProducts (118K), VendorProductDescriptionsV2 (152K vendor part associations), PurchaseOrderLinesV2 (61K), PurchasePriceAgreements (134K)
- App registration from Yosef's customer-portal-react project

### Master DB API
- URL: `https://masterdb.everreadygroup.com`
- Auth: X-Api-Key header
- Endpoints: GET /api/dibs/items (search by sku/upc/nsn), POST /api/dibs/nsn (write NSN + mfr_part_number), GET /api/dibs/items/export (bulk NDJSON stream, supports ?has_mfr=1, ?has_nsn=1, ?has_ndc=1)
- ~405K items, 192K with mfr_part_number, ~1,900 now have NSNs

### DIBBS (Defense Internet Bid Board System)
- URL: dibbs.bsm.dla.mil — no login needed for browsing (just consent banner)
- Login credentials in .env for quote submission only
- Scrape approach: accept consent (#butAgree), search by FSC via `/Rfq/RfqRecs.aspx?category=FSC&value={fsc}&scope={today|open}`
- Pagination: ASP.NET __doPostBack (`Page$2`, `Page$3`, etc.)
- Daily cron: GitHub Actions at 6am + 12pm ET (Mon-Fri)

### USASpending.gov
- Free API, no auth. POST to `/api/v2/search/spending_by_award/`
- Bulk download available but slow
- 10K DLA awards loaded in Supabase

## Supabase Tables (dibs-gov)
- fsc_heatmap (332 rows) — hot/warm/cold FSC bid activity
- fsc_expansion (464 rows) — solicitations received vs bids placed by FSC
- awards (5,000 rows) — recent LamLinks awards
- usaspending_awards (10,000 rows) — DLA awards from USASpending
- dibbs_solicitations — scraped DIBBS solicitations
- bid_decisions — Abe's bid approve/skip with price override + comments
- profiles — auth users with roles (admin/manager/viewer)

## Data Already Extracted (in data/)
- `data/llk-discovery/` — bid-history.json (492K, 210MB), item-master.json (273K), awards-recent.json (5K), fsc-heatmap.json, fsc-expansion.json, quote-metrics.json
- `data/d365/` — barcodes.json (55K), products.json (118K), po-lines.json (61K), vendor-parts.json (152K), purchase-price-agreements.json (134K)
- `data/usaspending/` — dla-awards-6mo.json, dla-psc-summary.json, dla-awards-by-psc.json
- `data/dibbs/` — open-solicitations.json (553)
- `data/masterdb-mfr-192k.ndjson` — full Master DB export (192K items with mfr_part_number)
- `data/nsn-matching/` — confirmed/rejected NSN matches

## Key Findings
- Abe bids on 23.4% of solicitations received (59K sols / 6mo, 14K bids)
- 114 hot FSCs, 76 warm, 142 cold. Core business = medical (65xx)
- 115 FSCs have solicitations flowing in that Abe doesn't bid on
- D365 has 25K NSN barcodes — the NSN↔item mapping was in AX all along
- Only 73 D365 items have BOTH UPC and NSN — commercial and military are separate populations
- Vendor cost data in PurchaseOrderLinesV2 and PurchasePriceAgreements
- Median bid price: $52.48, range $0.02–$205,799

## Auth
- Supabase Auth with session cookies (sb-access-token, sb-refresh-token)
- Middleware redirects unauthenticated users to /login
- First login forces password reset (must_reset_password flag)
- Bug reporter creates GitHub Issues on ShmuelSokol/bids with screenshots

## Key env vars (in .env, NOT committed)
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- MASTERDB_API_KEY, MASTERDB_URL
- AX_TENANT_ID, AX_CLIENT_ID, AX_CLIENT_SECRET, AX_D365_URL
- DIBBS_USERNAME, DIBBS_PASSWORD
- GITHUB_TOKEN (for bug reporter)
