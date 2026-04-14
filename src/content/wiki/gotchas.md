# Gotchas & War Stories

Things that broke, how we noticed, and what we learned. If you're about to touch one of these areas, read the relevant section first or you'll repeat our mistakes.

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

## The two stale-data traps (abe_bids_live)

**Trap 1:** The sync script writes today's bids into `abe_bids_live`. We were SELECTing *all* rows without a date filter, so yesterday's 277 bids were still there, labeled as "today's bids" in the UI.

**Trap 2:** The solicitations page marks any row in `abe_bids_live` as `already_bid`. With yesterday's stale data present, 13 items that were sourceable-today got marked as already-bid (from yesterday's session) and excluded from the sourceable count. Dashboard showed 33, solicitations showed 20.

**Fix:** every query of `abe_bids_live` must include `.gte("bid_time", today)`. Treat "live" bids as ephemeral, not cumulative.

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
