# Gotchas & War Stories

Things that broke, how we noticed, and what we learned. If you're about to touch one of these areas, read the relevant section first or you'll repeat our mistakes.

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

## abe_bids_live window — today vs 30d

**Original rule (2026-03): filter to today.** Stale rows were mislabeling today's sourceables as already-bid because the page UI was counting yesterday's bids as "today's bids." Fix then: `.gte("bid_time", today)` on every read.

**Revised rule (2026-04-15): 30-day window.** Reverted the per-view filter for `/solicitations` specifically after Abe reported sols he'd bid on Monday STILL showing as Sourceable on Wednesday. Because Monday's bid_time was older than "today," the dedup Set never contained the sol#, and /solicitations showed the sol as open despite a valid bid in LamLinks.

**Resolution:** dedup keys on EXACT `solicitation_number` — having 30d of stale bids in the table is safe. A bid on sol X thirty days ago correctly dedups today's open sol X. Views that display "today's activity" (`/bids/today`, dashboard "Bids Today" panel) still apply their own per-view `bid_time >= today` filter; they're display filters, not dedup filters.

**Lesson:** the shape of the data matters more than the staleness. Dedup by identity field, display by time field.

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
