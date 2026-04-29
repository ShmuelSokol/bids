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

## LL BID + INVOICE SFTP TRANSMISSION (2026-04-29)
- **Bids and invoices both auto-transmit via SFTP** to `sftp.lamlinks.com:/incoming/` (Sally → DLA). Captured via procmon during Abe's UI clicks.
- **Invoices**: `ck5_tab.dbf` + `ck5_tab.FPT` zipped as `.laz`, TWO uploads per CIN (810 then 856). See `src/lib/ll-ck5-dbf.ts`.
- **Bids**: `qtb_tab.dbf` + `qtb_tab.FPT` zipped as `.laz`, ONE upload per envelope (multi-record, one record per CLIN). See `src/lib/ll-qtb-dbf.ts`.
- **GENNTE_QTB is NOT a user note** — it's a 566-byte control XML LL UI emits per record (`<ver_no>1.902</ver_no>...<qtclas>process_normally</qtclas><qtctyp>validate</qtctyp>`). User-facing gennte/pkgnte text lives nested inside as XML tags.
- **PKGNTE_QTB memo ref is always 4 binary zeros** (NOT 4 spaces). The package note is inline in the GENNTE XML wrapper.
- **LAM_ID maps to k11.lam_id_k11**, NOT k11.idnk11_k11. They're different fields. Easy to miss.
- **`LL_BID_DRY_RUN=1`** env flag — builds the .laz, logs filename + bytes, skips actual SFTP. Use for canary testing.
- **SFTP works from GLOVE** (no IP whitelist on `sftp.lamlinks.com`, unlike `api.lamlinks.com`). Same `lamlinks_inp` creds for both bids and invoices.
- **Order of operations**: SQL writeback (k33/k34/k35) → SFTP upload .laz → finalize k33 with **BOTH** `o_stat_k33='quotes added'` (Post-equivalent) AND `t_stat_k33='sent'` + `t_stme_k33=GETDATE()` (Process-File-equivalent). SFTP failure leaves envelope in `'adding quotes'` for retry — SQL rows intact.
- **Process File ≡ another SFTP upload + `t_stat='sent'` flip.** Captured via procmon 2026-04-29: LL UI's Process File click runs Z*.bat (7zip the DBF/FPT into `a1-0AG09.laz`), renames to `a<seq>_everready_<rand>.laz`, fires `winscp.com` to SFTP-upload, and UPDATEs k33 to flip `t_stat='sent'`. Since our worker already SFTP'd at Post-time, we only need the SQL flip — skipping LL UI's redundant second upload. Without `t_stat` flip, LL UI shows "Not Sent" even though DLA has the bid (DIBBS confirms transmission).

## LAMLINKS WRITEBACK RULES (2026-04-24 session)
- **DIBS→LL SQL writeback works but causes VFP cursor errors on LL client**. Errors 9999806/9999607 are cosmetic — the Sally HTTP transmit still succeeds.
- **DO NOT panic-nuke envelopes on cursor errors.** Wait for DLA ack email or check `k33_tab.t_stat_k33='sent'` before touching. If the envelope's k33/k34 are gone but DLA has the bid, use `scripts/ll-reinsert-orphan-bid.ts` to restore the shell with original `qotref_k33`.
- **`lamlinks_writeback_enabled=true`** in `system_settings` (re-enabled 2026-04-27 after k07 patch validated). **`lamlinks_fresh_envelope_enabled=false`** — fresh-envelope mode disabled until multi-bump k07 (shipped 2026-04-28) is validated against Abe's first manual fresh envelope tomorrow. Piggyback is cursor-clean.
- **Multi-bump k07** (2026-04-28): LL native fires `UPDATE k07 SOL_FORM_PREFERENCES` 12+ times per Post burst. Worker now bumps 6+ times across `createFreshEnvelope()` + `appendBidLine()` instead of once at finalization. Theory: each bump invalidates a different VFP cursor cache; envelope-list cursor needs separate invalidation than bid-form cursor. Mechanism tested via `scripts/_test-multi-bump-k07.ts`; live cursor-error silencing TBD.
- **LL Sally REST creds recovered from `\\NYEVRVTC001\c$\LamlinkP\data\log\*.txt`** — cleartext in every curl invocation. Stored in `.env` on GLOVE as `LL_SALLY_LOGIN`/`LL_API_KEY`/`LL_API_SECRET`/`LL_E_CODE`. NEVER commit `.env`.
- **IP whitelist on api.lamlinks.com is REAL (confirmed 2026-04-27).** Same creds 200 from NYEVRVTC001, 401 from GLOVE. REST writeback must run from a whitelisted box — see `docs/architecture/sally-rest-worker.md` for the queue+worker design.
- **Per-function ACL on Sally** — same creds returned 200 on `get_sent_quotes_by_timeframe` but "API Access Forbidden" on `get_quotes_by_timeframe`. Each `lis_function` is independently gated. Whether ERG is authorized for `put_client_quote` is still unconfirmed — SQL writeback remains the only working path until the worker tests it.
- **RDP paste mangles `--` to em-dash `–`** in PowerShell. When sharing curl one-liners, save them to a `.ps1` file via Notepad (Notepad doesn't autocorrect) and run with `powershell -File`.
- **Pipeline observability** at `/ops/dibs-pipeline` — watches write queue + latest LL-side snapshot (table `ll_pipeline_snapshots`, populated every 5min by `scripts/snapshot-ll-pipeline.ts` on NYEVRVSQL001).

## LAMLINKS INVOICE WRITEBACK (DD219 → kad/kae) RULES (2026-04-28 first live test)
- **First successful AX→LL invoice writeback: CIN0066186** ($43.77 against SPE2DS-26-V-4743, kaj=353349). End-to-end pattern lives in `scripts/lamlinks-writeback-worker.ts` `writeOneInvoice()`. **Read `docs/lamlinks-invoice-writeback.md` before changing anything in that function.**
- **8-table transaction**, NOT just kad+kae: kad → kae → kaj → ka9 → k80 → **k81** → kbr × 2 → k20 × 2, plus two atomic k07 counter bumps (`CIN_NO` and `TRN_ID_CK5`). Each missing piece I discovered cost a debugging round.
- **`k81.shpsta_k81` is the UI status LABEL — separate from `kaj.shpsta_kaj`.** Without flipping k81 'Shipping'→'Shipped', the LL shipment screen shows "Shipped" checkbox flipped but the status text still reads "Shipping". One k80 may have multiple k81 CLIN rows — flip them all + stamp `stadte_k81=GETDATE()`.
- **`ka9.idnkae_ka9` + `ka9.jlnsta_ka9='Shipped'`** drives the "Invoice #" column AND Shipped checkbox. Without it: blank invoice column.
- **NEVER use MAX+1 for `cin_no_kad` or `xtcscn_kbr`** — use the atomic `UPDATE k07 SET ss_val=ss_val+1 OUTPUT deleted/inserted` pattern. LL's client preallocates from k07 at form-open and collides with MAX+1 from external scripts.
- **`kbr` UNIQUE on `(itttbl, idnitt, idnkap)`** — at most ONE 810 (kap=24) + ONE 856 (kap=25) per kaj. Pre-check before INSERT.
- **`kae` requires `uptime_kae` + `upname_kae`** NOT NULL. **`k20` requires `llptyp_k20` + `idnllp_k20`** NOT NULL; `logmsg_k20` is char(80) — truncate. **`k80` has NO `uptime_k80`** — `rlsdte_k80` IS the touched-time signal.
- **`kaj.shpsta` may be 'Packing'** when warehouse-fresh. The worker UPDATE is idempotent — handles both 'Packing' and 'Shipped' states.
- **Lifecycle**: `lamlinks_invoice_queue` state machine `pending → approved → processing → posted` (or `error`). CHECK constraint must include `'approved'` — original schema didn't; see `scripts/sql/fix-invoice-queue-state-check.sql`.
- **UI**: `/invoicing/post-batch` — Import (AX→queue) + Post All (queue→LL), per-row Test/Skip buttons. Auto-refreshes while in-flight.

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
- **profiles** — auth users with roles. Constraint allows `superadmin` / `admin` / `manager` / `viewer`. `superadmin` can manage other users at `/settings/users` (change roles, cannot demote the last superadmin or change own role). Existing admin-gated code (bug manager, cross-user bid overrides, etc.) now uses `hasAdminAccess(role)` helper which returns true for BOTH `admin` and `superadmin` — so a superadmin retains every admin privilege plus role management.

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
