# Gotchas & War Stories

Things that broke, how we noticed, and what we learned. If you're about to touch one of these areas, read the relevant section first or you'll repeat our mistakes.

## Invoice status LABEL is driven by k81.shpsta_k81, not kaj.shpsta_kaj

> Symptom (2026-04-28): First live AX→LL invoice writeback test (CIN0066186, $43.77 against SPE2DS-26-V-4743). After the worker ran, the LL shipment screen showed "Shipped" CHECKBOX flipped on — but the STATUS LABEL still read "Shipping". We had updated kaj.shpsta_kaj, ka9.jlnsta_ka9, k80.rlssta_k80, kad.cinsta_kad, kbr (810+856), k20 logs — every status field we knew about. Status label still wrong.

**The cause:** `k81_tab.shpsta_k81` (the AWARD/CLIN-level shipping status) is the source of the displayed status label. It transitions 'Shipping' → 'Shipped' separately from kaj. One k80 may have multiple k81 rows (one per CLIN); flip them all.

**The fix in worker `writeOneInvoice()`:**
```sql
UPDATE k81_tab
   SET shpsta_k81 = 'Shipped', stadte_k81 = GETDATE()
 WHERE idnk80_k81 = <k80>
   AND LTRIM(RTRIM(shpsta_k81)) = 'Shipping'
```

Discovery method: scanned all `INFORMATION_SCHEMA.COLUMNS` where DATA_TYPE was char/varchar and name matched `%sta_%`/`%status%` for values 'Shipping'/'Shipped'. Two tables had both: `kaj_tab.shpsta_kaj` (already handled) and `k81_tab.shpsta_k81` (the missing one). Diff'd k81 row of our kaj vs Abe's manual posts confirmed only this field differed.

See `project_lamlinks_invoice_writeback.md` in user memory for the full 8-table transaction shape.

## LL VFP cursor errors 9999806 / 9999607 are cosmetic — don't panic-nuke

> Symptom (2026-04-24): DIBS writeback inserted k33/k34/k35 rows for envelope 46896 (sol `SPE2DS-26-T-009G` @ $239). Abe saw `9999806` on LL reopen and `9999607` on his manual Post. I nuked the DIBS-inserted rows assuming the transmit had failed. DLA's ack email came back confirming BOTH the DIBS-created envelope AND Abe's re-post had actually reached Sally (standard dedup kept the later one). I'd deleted valid sent data.

**The rule: cursor errors do NOT imply transmission failure.** LL's VFP client throws
9999xxx cursor conflicts when its local cursor snapshot disagrees with a row we
inserted out-of-band. The conflict is purely a local-UI state issue — the Sally
HTTP POST that LL kicks off when Abe clicks Post still goes through (or already
went through), and DLA ack's it.

**Verification protocol before touching a DIBS-created envelope on cursor error:**
1. Wait for LL's ack email — typically arrives 1-2 hours after the quote cycle
2. OR check `k33_tab.t_stat_k33` for that envelope — `'sent'` means Sally got it
3. OR check LL's local log files at `\\NYEVRVTC001\c$\LamlinkP\data\log\*.txt` — successful API calls end with `lam_api function ... succeeded`

**If transmit DID succeed and local DB is still broken**, use `scripts/ll-reinsert-orphan-bid.ts` to re-create the k33/k34/k35 shell with `qotref_k33` matching the original, preserving the DLA link.

**The k07 cursor-fix patch — VALIDATED 2026-04-28 via live test:**
Worker bumps `k07_tab SOL_FORM_PREFERENCES` for ajoseph after envelope
finalization, matching what LL's own Post flow does (12+ times per bid burst
per the XE trace). End-to-end test:

- Abe saved 2 bids in LL (creating staging envelope), kept the form open
- DIBS submitted 1 bid → worker piggybacked into the envelope
- Abe Posted the combined 3-line envelope
- **No cursor error 9999806 OR 9999607.** Patch silenced both. All 3 lines transmitted to DLA per ack email.

So **piggyback mode** (DIBS appends to Abe's staged envelope) is now production-clean. Use it as the default operational pattern.

**Fresh-envelope mode (DIBS mints from scratch) — partial:** Same 2026-04-28 test, second envelope: DIBS minted a fresh k33, Abe added a line on top in LL (which LL routed to its OWN new envelope, not ours — meaning each envelope ends up standalone). On Post, DIBS's fresh envelope produced cursor error **9977720** (different from 9999806/9999607). Bid still transmitted to DLA per ack email — error is cosmetic, same as the others. The `lamlinks_fresh_envelope_enabled` flag (default true) gates this mode; flip false to require Abe-seeded envelopes only. UI on `/solicitations` shows an amber warning when fresh-envelope mode is enabled.

See `docs/flows/ll-post-sequence.md` for the full bid-Post SQL sequence
captured live.

**The 2026-04-24 dead-end trace**: XE sessions `dibs_ll_trace` + `dibs_ll_trace_server` captured the native LL Post pattern. Key SQL that DIBS wasn't mimicking:
```
set implicit_transactions on
UPDATE k07_tab SET uptime_k07=GETDATE() WHERE upname='ajoseph' AND ss_key='SOL_FORM_PREFERENCES' AND ss_tid='U'
COMMIT TRAN
set implicit_transactions off
```

## LamLinks Sally REST: IP whitelist is real (CONFIRMED 2026-04-27)

> Discovery (2026-04-24): `api_key` + `api_secret` weren't in LLPro.ini, registry, binaries, or `kah_tab`. They were sitting in cleartext in every line of LL's own curl verbose output on NYEVRVTC001 at `\\NYEVRVTC001\c$\LamlinkP\data\log\*.txt` — every line with `-u "<sally_login>#<api_key>:<api_secret>"`.

**Confirmed 2026-04-27:** the creds work, the IP whitelist is real.
- From NYEVRVTC001 (whitelisted): curl `--digest` against `/api/llsm/create` returns 200 OK with a real envelope. ERG IS authorized for `lis_function` calls.
- From GLOVE/Railway (not whitelisted): same creds, same digest, returns 401 every time.
- The earlier 401-from-NYEVRVTC001 result was a red herring caused by an empty `--data ""` body. Any non-empty body authenticates correctly. Likely the server's auth path requires `Content-Length > 0`.

**Creds are byte-perfect** — verified against today's LL logs. `^,` special chars survive PowerShell + curl arg-passing fine. No mangling, no rotation since 2026-04-24.

**Architecture decision:** REST writeback runs from a whitelisted box, NOT from GLOVE/Railway. See `docs/architecture/sally-rest-worker.md` for the queue + worker design. Whitelist coverage of NYEVRVSQL001 is unconfirmed — assume only NYEVRVTC001 until tested.

**Per-function ACL:** same creds returned 200 on `get_sent_quotes_by_timeframe` but `API Access Forbidden - 84662` on `get_quotes_by_timeframe`. Each `lis_function` is independently gated. Whether `put_client_quote` (the one we need for bid writeback) is in our grant — unknown until we send a real one. SQL writeback remains the only confirmed-working path until the worker proves REST end-to-end.

**RDP em-dash autocorrect** (`--` → `–`) silently breaks curl when pasting via Remote Desktop. Symptom: `failed to convert -data to ACE; no mapping for unicode char`, or curl falls through to a GET with no body. Fix: save the command to a `.ps1` file via Notepad first (Notepad doesn't autocorrect), then `powershell -File <path>`.

Test script at `https://jzgvdfzboknpcrhymjob.supabase.co/storage/v1/object/public/briefings/ll-api-test.ps1` — downloads + runs from any Windows box, writes HTTP result back to Supabase Storage. On older Windows, must force TLS 1.2 first: `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12`.

**Creds live in `.env` on GLOVE** (`LL_SALLY_LOGIN`, `LL_API_KEY`, `LL_API_SECRET`, `LL_E_CODE`). Never commit `.env`. Will be duplicated to NYEVRVTC001 once the worker is built.

## UoM B-prefix codes are AX pack sizes — convert to per-each when sol is EA

> Symptom (2026-04-28): `SPE2DS-26-T-021J` had AX UoM `B25` (pack of 25). DIBS suggested $110.99 vs DLA estimated $20.40 (5.4× over market). Initial misdiagnosis was that DIBS was multiplying by 25; actual cause was that AX cost ($100.90/B25) was being treated as if it were per-EA when DLA's solicitation UoM was EA.

**Real cause:** AX stores cost per its internal pack UoM (`B25` = pack of 25). DLA solicitations use the buyer's UoM (typically `EA`). When AX UoM is `B<NN>` and sol UoM is `EA`, the per-EA cost is `cost / NN` ($100.90 / 25 = $4.04/EA), not $100.90/EA.

**Fix shipped 2026-04-28:**
- `src/lib/uom.ts` — `parseUomMultiplier()` recognises `B<NN>` codes (returns NN) vs single-unit UoMs (EA/PR/PG/etc., returns 1) vs unknown packs (BX/CN/PK, returns 1 with low confidence).
- `nsn_costs` + `nsn_vendor_prices` — added `cost_per_each` + `pack_multiplier` columns. Migration in `scripts/sql/nsn-costs-per-each.sql`. 3,807 NSN rows with B-prefix UoMs were backfilled.
- `dibbs_solicitations.sol_uom` — new column carrying DLA's UoM (from LL `k11.sol_um_k11`). Backfilled via `scripts/backfill-sol-uom-from-ll.ts`.
- `enrich/route.ts` + `reprice/route.ts` — when AX UoM matches `/^B\d+$/` AND `sol_uom = 'EA'`, use `cost_per_each` for pricing. Otherwise raw AX cost passes through (PG/BX/PK are typically equivalent to our pack).
- `generate-pos/route.ts` — `costTrustworthy()` now allows the `EA ↔ B<NN>` case (per-each split is reliable). New `effectiveUnitCost()` helper picks per-each cost when warranted, eliminating spurious "COST UNVERIFIED" flags on legit lines.
- `populate-nsn-costs-from-ax.ts` — computes `cost_per_each` and `pack_multiplier` going forward.

**Validation:** SPE2DS-26-T-021J flipped from $110.99 → $4.44/EA (cost $4.04/EA × 1.10), 80% margin headroom against the $20.40/EA market price.

**Why we DON'T divide for `BX`/`PG`/`PK`:** distribution check showed 0% of B-prefix AX UoMs map to B-prefix LL UoMs. 23% map to EA (the dividing case), 77% map to PG/BX/PK/CT — which are typically the same physical bundle as our B<NN> (vendor pack = DLA pack). Converting those would over-divide. Empirical: SPE2DS-26-T-9496 has AX=B25 ($100.90) and LL=BX ($129.99) — clearly equivalent units, no division needed.

## LL imports only 1 CLIN of multi-CLIN DIBBS sols

> Symptom (2026-04-24): `SPE2DH-26-T-3287` showed 4 CLINs on DIBBS web UI but only 1 in LL's k11_tab. DIBS (which mirrors LL) showed qty 1 when the real sol was qty 4 across 4 destinations. Abe's bid would have covered only one CLIN.

**Cause:** LL's internal DIBBS scraper misses CLINs on certain multi-CLIN sol formats — the "Package View" detail page isn't traversed. LL's k11/k32 only captures the row shown in the search results table.

**Partial fix shipped:** solicitations modal header now shows CLIN count + a red warning badge when single-CLIN but `lamlinks_estimated_value` >> `suggested_price × quantity` (3× threshold). Plus a "↗ View on DIBBS" button that opens the sol's RfqRecs page in a new tab so Abe can visually cross-check.

**Real fix shipped 2026-04-28:** `scripts/scrape-dibbs-clins.ts` uses Playwright to load the DIBBS Package View directly (`https://www.dibbs.bsm.dla.mil/rfq/rfqrec.aspx?sn=<sol-no-dashes>`) and extract the CLIN table (the third `<table>` on the page; columns `# / NSN/Part No. / Nomenclature / Technical Documents / Purchase Request QTY`; the qty cell looks like `<10-digit PR number> Qty: <integer>`). Per-CLIN rows go into `dibbs_sol_clins` (unique on `(sol_no, clin_no)`).

UI: solicitations modal has a "⟳ Scrape DIBBS CLINs" button (purple) that enqueues `refresh_dibbs_clins` rescue action; daemon worker spawns the scraper. When dibbs_sol_clins data exists for a sol, the modal shows a panel comparing LL (k32) qty vs DIBBS scraped qty with a per-CLIN breakdown — flags discrepancy >5% with a red "DIBBS DISAGREES" header.

**Validated against SPE2DS-26-T-021R**: LL showed qty 18 (CLIN 0003 only); DIBBS Package View has 6 CLINs totaling 318 (qty 2 + 9 + 77 + 12 + 18 + 200). Scraper correctly captured all 6.

**Future:** auto-scrape CLINs nightly for any new multi-CLIN-suspect sol so Abe sees fresh data on first open. Pricing override (use scraped qty for the suggested-price calc when LL disagrees) is a separate refinement — for now Abe sees the discrepancy and can override manually.

## NSN history gap: DIBS `awards`/`abe_bids` miss international FSCs

> Symptom (2026-04-24): NSN `6665-12-193-2113` (FSC 6665 NATO country 12 = Germany) showed 0 awards in DIBS but 209 in LL + 6 Abe bids. Abe couldn't price the bid from DIBS because history looked empty.

**Cause:** DIBS's nightly `awards` sync has gaps on certain NSN prefixes — international-origin FSCs and some niche FSCs aren't in the scrape's scope. The data does exist in LL's k81_tab.

**Fix shipped:** on-demand `scripts/refresh-ll-history-for-nsn.ts` + "⟳ Refresh from LL" button in the solicitations modal. Queues a `refresh_nsn_history` rescue action → worker spawns the script → writes missing rows to `awards` + `abe_bids`. Usually completes in <10s; UI polls and re-fetches history panel when done.

**Follow-up ideas:** nightly bulk sync covering ALL NSNs seen in today's batch, not just those matched via the current filter; or pull LL history every time DIBS imports a new sol.

## PowerShell on older Windows: TLS + ::new() don't work

> Symptom (2026-04-24): `iwr https://...` → "could not create SSL/TLS secure channel" on an older Windows box. `[System.Net.Http.StringContent]::new(...)` → "system doesn't contain method named 'new'".

**Cause:** older Windows (Server 2008 R2, possibly some 2012) ships PowerShell 2/3 + .NET 4.0, which doesn't support TLS 1.2 by default and doesn't have the `::new()` constructor shorthand.

**Fix pattern when writing cross-box PS one-liners:**
1. Always prepend `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12` before any HTTPS call
2. Use `New-Object X` instead of `[X]::new()`
3. Use `[System.Net.HttpWebRequest]::Create(...)` (.NET 2.0) instead of `System.Net.Http.HttpClient` (requires 4.5+)

Test script `https://jzgvdfzboknpcrhymjob.supabase.co/storage/v1/object/public/briefings/ll-api-test.ps1` follows this pattern.

## AX OData silent 1000-row cap on filtered queries

> Symptom: `PurchaseOrderLinesV2` with `$filter=toupper(CustomerRequisitionNumber) eq 'DD219'` returned exactly 1000 rows with no `@odata.nextLink`. We thought that was the complete set. It wasn't — the real count via `@odata.count` was 8,533. We were silently losing 88% of DD219 PO history, which broke the DD219 PO ↔ award linker.

AX OData V2 enforces a hidden ceiling of exactly **1000 rows per filtered query** and does **not** emit `@odata.nextLink` once you hit it. There is no error, no warning, no header — the response just stops. Unfiltered pulls (e.g. full `ProductBarcodesV3`) paginate normally via nextLink and go to completion; the cap only bites on `$filter`'d queries.

**Detection heuristic:** a response of exactly 1000 rows on a filtered query with no nextLink is almost certainly truncated.

**Fix in place:** two shared helpers handle this for us:
- `scripts/ax-fetch.ts` (node scripts) and `src/lib/ax-fetch.ts` (API routes)
- `fetchAxPaginated(token, url, { label })` — follows nextLink normally, warns + returns `truncated=true` when the cap heuristic fires
- `fetchAxByMonth(token, { entity, dateField, monthsBack, baseFilter, select })` — auto-chunks a filtered query by a date field so each slice stays under the cap; use this whenever the expected result set may exceed 1000

**Rule:** any new AX OData caller that uses `$filter` MUST go through one of these helpers. Never write a raw `fetch()` against an AX entity with a filter — you won't see the truncation until someone notices data is missing months later.

Callers already migrated: `src/app/api/invoicing/followups/route.ts` (DD219 Backorder pull), `scripts/sync-po-award-links.ts` (PO headers by month), `scripts/populate-nsn-costs-from-ax.ts` (NSN barcodes). Unfiltered bulk pullers (`pull-d365-products.ts`, `pull-d365-costs.ts`, `pull-ax-vendor-parts.ts`) are fine as-is.

## `npm install X` wipes native --no-save deps and kills scheduled tasks

> Symptom: scheduled task `DIBS - Abe Bids Sync` returned `total:0` every 5 min for half a day. Abe had placed 105+ real bids in LamLinks that never reached the DIBS dashboard. Root cause only visible in the dispatcher log (`C:\tmp\dibs-logs\sync-abe-bids-live.log`) as `Cannot find module 'mssql/msnodesqlv8'`.

`mssql` + `msnodesqlv8` are native packages that can't go in `package.json` — Railway's Linux build fails on compilation. They live in `node_modules` only via `npm install --no-save`. Any subsequent `npm install X` that touches `package.json` (adding exceljs, jszip, etc.) wipes them.

**Fix in place:** `scripts/windows/run-dibs-task.bat` now self-heals at the top of every task run — checks `node_modules/mssql` and reinstalls with `--no-save` if missing. Adds ~3-5s on the first run post-reinstall, zero overhead after.

**Rule:** after ANY `npm install` that touches package.json, verify `node_modules/mssql` still exists before expecting scheduled tasks to work.

## Reset password flow went 404 for 3+ weeks

> Symptom: `/api/auth/forgot-password` sent Supabase reset emails with `redirectTo: /login/reset-password`, but `/login/reset-password/page.tsx` didn't exist. Users clicked the reset link and saw a Next.js 404. Broken since the feature was added.

**Lesson:** when wiring an email-link redirect, test the whole round-trip before shipping — sending the email, clicking the link, completing the form. API route + page component are two independent surfaces and it's easy to ship one.

**Fixed 2026-04-15** — new `src/app/login/reset-password/page.tsx` parses the access token from the URL hash, posts to the existing `/api/auth/reset-password` API, redirects on success.

## DMF "auto-generate PO number" checkbox

> Problem before fix: our AX PO write-back spec originally assumed DIBS would supply PO numbers. After the 4-15 meeting we learned AX DMF has an "auto-generate" checkbox that makes AX assign numbers from its UI sequence — which is what Yosef actually uses for the PO header import.

**Rule:** DIBS POSTs the header file WITHOUT a PURCHASEORDERNUMBER column. Yosef's preconfigured DMF project has the auto-generate checkbox set. If someone resets the project or unchecks it, the whole pipeline breaks. See `docs/flows/ax-po-writeback.md`.

## Don't rebuild Yosef's Sales Order MPI logic

> Problem before fix: original AX SO generator spec had DIBS generating a full sales-order DMF workbook with contract grouping + DODAAC routing + CLIN/TCN numbering. That's years of Yosef's business logic. Rebuilding it would (a) take weeks and (b) drift out of sync with his version.

**Rule:** DIBS' job for sales orders is pre-validation only. We check DODAAC mapping + NSN match in AX, surface errors early in DIBS, then hand the awards file back unchanged to Abe to upload into Yosef's existing MPI Sales Order page. See `docs/flows/ax-so-writeback.md`.

## "Two parallel range queries" lies — pagination must actually loop

> Symptom: dashboard showed 253 sourceable, /solicitations showed 46. Same shared filter logic, same data — but two different counts.

The dashboard loader paginated `is_sourceable=true` rows in a `while` loop until empty (catches everything). The solicitations page used a "fast" pattern: two parallel `.range(0, 999)` + `.range(1000, 1999)` calls, capped at 2K rows. With 5,510 sourceable rows in the DB, the solicitations page was silently missing 3,510 of them — and the open ones happened to cluster in pages 2-5.

**Rule:** if a Supabase table can ever exceed 2K rows for a query, the loader must loop until the page comes back empty. Hardcoding "2 parallel ranges" as a perf optimization is a future bug. The cost of one extra round-trip when the table grows is much smaller than the cost of silently mis-counting.

Fixed via a shared `loadAllByFlag()` helper inside `solicitations/page.tsx`. Every Supabase load that could exceed 1K rows should look like:

```ts
const items: any[] = [];
for (let page = 0; page < SAFETY_MAX_PAGES; page++) {
  const { data, error } = await supabase.from(t).select(c).eq(...).range(page*1000, (page+1)*1000-1);
  if (error || !data || data.length === 0) break;
  items.push(...data);
  if (data.length < 1000) break;
}
```

## LamLinks "Connectivity error" on bid save = PK collision with a DIBS write-back, not a network issue

> Symptom: Abe clicks Save on a new bid line in LamLinks. UI shows `Commit add- commit_k34-1526 Connectivity error: [Microsoft][ODBC SQL Server Driver][SQL Server]Violation of PRIMARY KEY constraint 'k34_tab_idnk34_k34'. Cannot insert duplicate key in object 'dbo.k34_tab'. The duplicate key value is (<id>).`

The error text says "Connectivity error" but it isn't — the SQL Server payload underneath is a duplicate-key violation. Cause: DIBS wrote to the `idnk34` value Abe's LamLinks client had pre-reserved.

**Why this happens:** the LamLinks Windows client maintains its own sequential counter for `idnk34_k34` and `idnk35_k35`. It reads `MAX+1` once (probably on form open or session start) and then increments by 1 on every save — it does **not** re-read `MAX` at save time. So if a DIBS write-back grabs `MAX+1` while Abe is mid-session, his counter will eventually hit the same id.

**Rules for any write to `k33/k34/k35` while Abe might be active:**

1. Never use `MAX(idnk34)+1` as-is. Add a cushion: `MAX + 30` is the working minimum, bigger is safer. Abe's envelopes are typically 5-15 lines, so 30+ keeps us well ahead of his counter.
2. Never delete+reinsert. Deleting frees an id, Abe's counter is still pointing at it, your reinsert grabs it back — collision on his next save. We hit this exact pattern on the first write-back attempt.
3. Tell Abe to **not** open additional "Add-line" forms while a DIBS insert is running. Parallel reservations overlap.
4. Recovery when it happens: move our row to a much higher id (INSERT copy at `MAX+30`, DELETE old) — frees Abe's id, his retry succeeds. Pattern: `scripts/move-our-ids-up.ts`.

Full write-back reference: [lamlinks-writeback.md](./lamlinks-writeback.md).

## Imports without enrich = silent zero

> Symptom: 13K rows imported from LamLinks, dashboard "sourceable" count barely moved. Every NSN Abe was actually bidding on existed in `nsn_catalog` but DIBS marked all 624 of his bids as "unsourced."

The LamLinks import script wrote rows with the default `is_sourceable=false`. The NSN matching that flips the flag lives in `/api/dibbs/enrich`. The DIBBS Railway scraper auto-chains to enrich when it finishes; the LamLinks import did NOT. So new rows landed in the database invisible until someone manually triggered enrichment.

We figured this out by cross-referencing Abe's `abe_bids_live` rows against `dibbs_solicitations` and finding 100% of his real bids matched a row but 0% had `is_sourceable=true`.

**Rule:** every script that adds rows to `dibbs_solicitations` must call `/api/dibbs/enrich` afterwards. Otherwise its work is invisible to users. Same pattern as `import-lamlinks-awards.ts` calling `/api/dibbs/reprice` at the end — chain mutations to their downstream side effects, don't rely on a separate cron to clean up.

## LamLinks import was pulling expired solicitations

> Symptom: After the import landed, the dashboard had 4,159 sourceable but only 11 open. 99% expired.

The script's WHERE clause was `closes_k10 >= DATEADD(day, -30, GETDATE())` — i.e., anything that closed in the last 30 days OR the future. Most LamLinks rows have short bid windows (3-7 days), so by the time we imported them most were already past due.

**Fix:** changed to `closes_k10 >= CAST(GETDATE() AS DATE)` — only future-closing solicitations. Reduced import volume by ~10x and made sourceable counts meaningful.

## The Windows scheduler / RDP session trap

> Symptom: `schtasks /create` showed SUCCESS for 6 tasks. Manual runs worked. Cron fired. Logs showed exit code 1 with no log file written.

Three problems compounded:

1. `schtasks /create` without `/ru` registers the task to run as the current logged-on user. The current user was an elevated `Administrator` shell, but the actual interactive desktop session belonged to `ssokol` (RDP'd in). Tasks were configured to run as Administrator who had no live session, so they queued forever.
2. `schtasks` invokes `.bat` files DIRECTLY (not through `cmd.exe`). The dispatcher's `setlocal`/`set` lines fail in that context. Wrap with `cmd /c "..."` to force cmd parsing.
3. The `dotenv` and `mssql/msnodesqlv8` packages that scripts import can never live in `package.json` (they crash Railway). They have to be installed locally with `npm install --no-save`. A fresh node_modules on the office Windows box doesn't have them.

**Final pattern** (all enforced by `scripts/windows/install-tasks.bat`):
- `cmd /c "...dispatcher.bat" arg` — proper cmd wrapping
- `/ru ERG\ssokol /it` — interactive-only tasks bound to the RDP user
- Auto-runs `npm install --no-save mssql msnodesqlv8` before registering tasks
- Custom `scripts/env.ts` replaces `dotenv/config` so the npm install isn't strictly required for env loading

## The DIBBS consent saga

> Symptom: Every DIBBS scrape returned 0 items for days. The `count` field in `sync_log.details` was 0 across dozens of runs.

DIBBS shows a "DoD Warning and Consent" banner to every visitor before anything else. The old consent code did this:

```typescript
await fetch(`${DIBBS_BASE}/dodwarning.aspx?goto=/`, {
  method: "POST",
  body: "butAgree=OK",
});
```

This used to work. Then it didn't. The issue took a day to track down because the scrape *looked* like it was succeeding — 200 responses, no errors — but every subsequent search page came back as the consent banner again.

**What's actually required:**

1. **GET** the consent page first to capture a `SessionId` cookie and 28 ASP.NET hidden form fields (`__VIEWSTATE`, `__EVENTVALIDATION`, etc.).
2. **POST** with *all* the hidden fields plus `butAgree=OK`, using the session cookie.
3. Use **`redirect: "manual"`** on the POST so you can capture the **`dw`** cookie that DIBBS sets only in the POST response. With `redirect: "follow"`, Node's fetch discards `dw` during the redirect.
4. Merge the `dw` cookie with the session cookies and send the combined string on every subsequent request.

The fix is in `src/app/api/dibbs/scrape-now/route.ts`. The key is that `dw` is the proof-of-consent cookie. Without it, DIBBS redirects every search back to the consent banner — silently.

> **Lesson:** When a scraper "succeeds" but finds nothing, compare the HTML you're parsing to a fresh curl from a browser. Check for consent pages masquerading as empty search results.

## The Supabase 1K limit that erases your data

> Symptom: Dashboard shows ~1,000 sourceable. You know there are 3,300. You've set `.limit(5000)`. It still shows 1,000.

Supabase has a **default query limit of 1,000 rows** that `.limit()` does not override for PostgREST. The only workarounds:

1. **Range queries in parallel:**
   ```typescript
   const [a, b] = await Promise.all([
     supabase.from("dibbs_solicitations").select("*").eq("is_sourceable", true).range(0, 999),
     supabase.from("dibbs_solicitations").select("*").eq("is_sourceable", true).range(1000, 1999),
   ]);
   const all = [...(a.data || []), ...(b.data || [])];
   ```
2. **Paginate in a loop** (works locally, dangerous on Railway because of the 30s timeout).

We hit this on the dashboard (missing items), solicitations page (missing items), awards pages, and the enrich route. Every time we "fixed" it we'd forget it applied elsewhere. The current rule: **any time you're reading a Supabase table that could have >1K rows, use parallel range queries.**

## unstable_cache breaks silently on Railway

> Symptom: Page rendered blank in production. Ran fine locally. Railway logs showed nothing wrong.

Next.js's `unstable_cache` wrapper genuinely fails on Railway serverless. It returns `undefined` — no error, no warning, nothing in logs. The inner function never runs.

**Rule: never use `unstable_cache` in this project.** If you need caching, use React's `cache()` (per-request memoization) or a Supabase materialized view.

## Computed columns cause silent query failures

> Symptom: `.select("id, nsn, est_value")` on `dibbs_solicitations` returned zero rows. No error in client. Only visible in `railway logs`.

Supabase returns a 400-level error if you `SELECT` a column that doesn't exist. When our code assumed `est_value` was a real column (it was computed client-side from `suggested_price * quantity`), the entire query failed silently from the browser's perspective.

**Rule: `SELECT` only real columns.** If you need `est_value`, compute it after the query. Check the actual table schema in Supabase Studio, not the TypeScript interface.

## Railway's 30-second timeout

> Symptom: API route worked for 1,000 rows. Timed out at 14,000 rows with no error message.

Railway serverless kills any request running longer than ~30 seconds. Long `while` loops that paginate over thousands of rows will hit this.

**Rule:** use parallel `.range()` queries with `Promise.all` instead of a while loop. You can burst-fetch 10K rows in one round-trip as 10 parallel 1K-row queries in well under 30s.

## The timezone bug that wasted a day

> Symptom: Dashboard showed 33 sourceable items. Solicitations page showed 20. They should have been the same. (See the previous chapter of this story: "a different bug one week earlier" where items due tomorrow were getting filtered as expired after 7pm ET.)

Three different pages had three different ways of computing "is this solicitation still open":

```typescript
// Dashboard (fine):
const todayStr = new Date().toISOString().split("T")[0];  // UTC
return isoDate >= todayStr;

// Solicitations server (missing the check entirely):
sourceable: enriched.filter(s => s.is_sourceable && !s.bid_status).length

// Solicitations client (broken):
return new Date(rowDate) >= new Date(new Date().toDateString());
// ^ toDateString() creates LOCAL midnight, which is 4am UTC.
// Items due 3/27 at midnight UTC were filtered as expired at 8pm ET on 3/26.
```

**Fix:** shared logic in `src/lib/solicitation-filters.ts`. One function, used in all three places. String comparison `YYYY-MM-DD >= today's YYYY-MM-DD`. No `new Date()`, no timezone math.

**Lesson:** date comparisons across server/client/browser timezones are a bug magnet. Normalize to YYYY-MM-DD strings and compare lexicographically. Never call `new Date()` in business logic.

## "Quote failed: Not Authenticated" after N hours idle

> Symptom: Abe loads `/solicitations`, the page works fine, he clicks "Quote as Suggested" — HTTP 401 `Not authenticated`. Reload the page and all the other data still shows (it used the cached/SSR'd content). He's still logged in per the UI, but any write endpoint 401s.

Root cause: Supabase access tokens expire after 1 hour by default. DIBS' cookie stores both an `sb-access-token` (1h) and an `sb-refresh-token` (30d). `getCurrentUser` in `src/lib/supabase-server.ts` was building the Supabase client with `Authorization: Bearer <access_token>` pinned in global headers BEFORE calling `setSession` to refresh — so every request used the expired token even after setSession rotated it, and `auth.getUser()` returned null.

Two-part fix (2026-04-16):

1. Stop pinning the Authorization header. Let `setSession` drive the client's auth state so it picks up the refreshed token.
2. When `setSession` rotates to a new access_token, persist the new tokens back to the cookies so subsequent requests don't re-refresh every time (and so the cookie's 1h window keeps sliding).

The cookie-write is in a try/catch because `cookies().set()` throws in page/render contexts where only route handlers can mutate cookies — harmless, the in-memory session is still correct for the current request.

## abe_bids_live window — today vs 30d

**Original rule (2026-03): filter to today.** Stale rows were mislabeling today's sourceables as already-bid because the page UI was counting yesterday's bids as "today's bids." Fix then: `.gte("bid_time", today)` on every read.

**Revised rule (2026-04-15): 30-day window.** Reverted the per-view filter for `/solicitations` specifically after Abe reported sols he'd bid on Monday STILL showing as Sourceable on Wednesday. Because Monday's bid_time was older than "today," the dedup Set never contained the sol#, and /solicitations showed the sol as open despite a valid bid in LamLinks.

**Resolution:** dedup keys on EXACT `solicitation_number` — having 30d of stale bids in the table is safe. A bid on sol X thirty days ago correctly dedups today's open sol X. Views that display "today's activity" (`/bids/today`, dashboard "Bids Today" panel) still apply their own per-view `bid_time >= today` filter; they're display filters, not dedup filters.

**Burned again (2026-04-16):** the 2026-04-15 fix updated `/solicitations` but missed the dashboard (`src/app/page.tsx`). Dashboard was still using `.gte("bid_time", today)` for dedup, so 290 items Abe bid on in the past 30 days (but not today) still showed as sourceable on the dashboard. Result: dashboard said 345, /solicitations said 55. Fix: dashboard now uses the same 30-day window.

**Also found (2026-04-16):** `abe_bids` (historical) had exactly 10,000 rows from a one-time import — never refreshed. Enrichment used only `abe_bids` for setting `already_bid`, missing recent bids in `abe_bids_live`. Fix: sync script now writes to both tables, and enrichment checks both.

**Lesson:** the shape of the data matters more than the staleness. Dedup by identity field, display by time field. When you fix a shared-logic bug on one page, grep for every other page that does the same query. And when you see an exact round number (10,000, 1,000, 500), assume it's a cap until proven otherwise.

## npm install wipes native deps — 5-day silent outage (April 2026)

> Symptom: all LamLinks syncs (bids, awards, solicitations, shipping, invoices) silently failed for 5 days. Dashboard showed stale data. Scheduled tasks were running (exit code 1) but nothing reached sync_log. Discovered April 21 when user asked "when was last import?"

`npm install --no-save libsodium-wrappers` (for GitHub secrets setup) wiped `@tediousjs/connection-string` — a sub-dependency of `mssql`. The `mssql` folder itself still existed, so the self-heal check in `run-dibs-task.bat` passed. But every script crashed at runtime with `MODULE_NOT_FOUND`.

**Why the old self-heal failed:** it only checked `if not exist "node_modules\mssql"`. The folder existed but was broken inside.

**Fix:** self-heal now does `node -e "require('mssql/msnodesqlv8')"` — tests the actual module load, not just folder existence. If require fails, reinstalls. If still fails, aborts with CRITICAL.

**Monitoring added:** hourly health check (`scripts/check-sync-health.ts`) via Windows Task Scheduler. If no sync_log entries in 2 hours during business hours: attempts self-heal AND sends WhatsApp alert. This would have caught the outage within 2 hours instead of 5 days.

**Rule:** NEVER run `npm install` in this repo without immediately running `node -e "require('mssql/msnodesqlv8')"` to verify native deps survived. The `run-dibs-task.bat` self-heal handles automated runs, but manual npm installs during development need the same check.

## Why we don't add native packages to package.json

> Symptom: Railway deploy failed. Build logs showed `gyp` errors about `msnodesqlv8`.

Packages with native C++ addons (`msnodesqlv8`, `mssql`, `playwright`, `dotenv` with certain plugins) need a C compiler and sometimes platform-specific native libraries (like MSSQL's ODBC driver). Railway's Linux build environment doesn't have these. If the package shows up in `package.json`, the entire deploy crashes.

**Rule:** install these with `npm install --no-save` so they exist in `node_modules` locally but never land in `package.json`. Local scripts that need them (e.g., `scripts/llk-query.ts`) run locally only.

**Related rule:** never `import` a native-dependent module from anything inside `src/app/` or `src/lib/`. The build compiler will try to resolve it and explode.

## Google and DuckDuckGo block cloud IPs

> Symptom: Supplier-discovery jobs completed "successfully" with 0 results. Same query worked fine from a local browser.

Google, DuckDuckGo, Bing, and most public search engines aggressively block Railway/AWS/GCP IP ranges. Our supplier-discovery background job that searches for "alternate vendors for NSN X" gets empty responses.

**Current status:** blocked. Options:

1. Pay for a search API (SerpApi, Bright Data) — ~$50/month.
2. Route supplier discovery through a residential proxy.
3. Skip web search, query supplier sites directly (Grainger, MSC, etc.) where we have API access.

We haven't picked a path yet.

## USASpending psc_codes format

> Symptom: Every `usaspending_awards` background job returned 422 Unprocessable Entity.

USASpending changed their API schema. They expect `psc_codes` as a flat array `["6515"]`, but the old code sent `{ require: ["6515"] }`. Fixed in the API caller — but this is a reminder: external APIs change their schemas and you find out when the job queue clogs up.

## The CAGE code that was the manufacturer, not the awardee

> Symptom: Our award analytics said we "lost" bids we'd actually won.

The `awards` table has a `winning_cage` column. For hundreds of rows this was populated with the **manufacturer's CAGE**, not the awardee's. When we filtered to `winning_cage = '0AG09'` (us), we missed our actual wins.

**Fix:** bulk UPDATE to populate `winning_cage` from the correct source field in the k81_tab import. Now analytics are correct.

**Lesson:** for any column named with a role ("winner", "assignee", "buyer"), double-check the ETL source field name. `mfg_cage` vs `awd_cage` is one character in the name and a completely different business meaning.

## Git on a network drive

> Symptom: `git commit` succeeded. `git status` showed inconsistent results. Eventually the repo reported "corrupt object" errors.

We initially had the working directory on a Z: network drive. Git doesn't play well with SMB — file locking semantics differ and occasional packfile corruption ensues.

**Rule:** the DIBS working dir is `C:\tmp\dibs-init\dibs`. Local NTFS disk only. If you clone it fresh, clone it somewhere local.

## The "no" set-aside badge

Minor but worth noting: solicitations can have a `set_aside` value of `"no"`, `"none"`, `"N/A"`, or blank. The UI used to render a "no" badge next to the channel tag, which looked like `noLL` (a combo of "no" set-aside and "LL" channel). We now filter those values out.

## Patterns that help

A few habits that have repeatedly saved time:

1. **Screenshot after every change.** Playwright or manual. Build-passing means nothing.
2. **`railway logs 2>&1 | tail -20`** after every push. Look for "Ready in" (success) or errors.
3. **Keep `sync_log` rich.** Every scrape, enrich, import writes a row with a `details` JSON blob. When something's wrong a week later, the log tells you what happened.
4. **When dashboard and a detail page disagree, find the shared filter logic** (or add it). Never let two pages compute "sourceable" independently.
5. **Always check the raw HTML/JSON** when a scraper returns nothing. Compare to a known-working request.
6. **Test with Playwright** for anything that SSRs. Server errors are invisible from the browser.
