# Audit Report — Pass 2 Findings

> **Generated:** 2026-03-27
> **Method:** Document-then-audit (spec-vs-code diff)
> **Scope:** All flows in `docs/flows/*.md` — bidding, scraping, enrichment, awards-to-pos, invoicing, shipping, auth, background-jobs, analytics
> **Total findings:** 32 (10 CRITICAL · 11 HIGH · 8 MEDIUM · 3 LOW)

Pass 1 wrote the spec. This pass reads actual code with spec in hand and flags where
reality diverges — plus bugs the spec missed.

---

## The top 5 things to fix this week

These have the highest expected impact or cost if exploited, ranked:

1. **[CRITICAL] `/api/whatsapp/send` is unauthenticated** — anyone on the internet can send paid Twilio messages to any phone number through our account. This is a billing attack vector. **Fix today.**
2. **[CRITICAL] `/api/bids/decide` has no row-level auth** — any authenticated user can overwrite any other user's quoted/skipped bids silently. No audit trail.
3. **[CRITICAL] Missing pagination on `dibbs_solicitations` in `/api/dibbs/enrich`** — only the first 1,000 unsourceable rows are ever enriched. If we have >1K unsourced rows, we silently leave items unmatched.
4. **[CRITICAL] Background jobs loop forever** — `max_attempts` is never set on job insert. Failed jobs retry indefinitely. This is why 203 `award_lookup` jobs are stuck.
5. **[CRITICAL] Shipping sync is broken** — `scripts/tmp-shipping-v2.sql` is referenced but not in the repo. Whole flow doesn't work.

---

## CRITICAL (10)

### Auth & security

**1. `/api/whatsapp/send` is unauthenticated + no rate limit**
- `src/app/api/whatsapp/send/route.ts:12-76`; public via `src/middleware.ts:3` (`/api/whatsapp` in `PUBLIC_PATHS`)
- Anyone can POST `{ to, message, mediaUrl }` and send a paid Twilio message. No auth, no origin check, no rate limit.
- **Fix:** Require auth OR add a shared-secret header. Move out of `PUBLIC_PATHS` or gate inside the route.

**2. `/api/bids/decide` has no row-level authorization**
- `src/app/api/bids/decide/route.ts:6-53`
- `getCurrentUser()` checks *that* a user is authenticated but not *which* user owns the row. Upsert on `(solicitation_number, nsn)` allows any user to overwrite any other user's decision silently.
- **Fix:** Add `decided_by` to the upsert conflict key OR enforce RLS on `bid_decisions` with `decided_by = auth.uid()`.

**3. `must_reset_password` check bypassable on API routes**
- `src/app/layout.tsx:49-56` (the only enforcement point)
- A user with `profile.must_reset_password=true` can directly call `/api/bids/decide` — the layout-level redirect doesn't run for API endpoints.
- **Fix:** Move the check into `getCurrentUser()` (src/lib/supabase-server.ts) or middleware so all routes inherit it.

### Data integrity

**4. `/api/bids/decide` doesn't validate `is_sourceable` server-side**
- `src/app/api/bids/decide/route.ts:26-53`
- UI hides the "Quote" button on non-sourceable rows, but the API accepts `status=quoted` regardless. A stale tab or DevTools call can quote an unsourceable item. Downstream PO generation will hit an item with no vendor.
- **Fix:** Fetch the solicitation before upsert; reject if `!is_sourceable && status === "quoted"`.

**5. `/api/orders/generate-pos` has a TOCTOU race on `awards.po_generated`**
- `src/app/api/orders/generate-pos/route.ts:84-90`
- No transaction. If two users click "Generate POs" with overlapping award selections, both loops read `po_generated=false`, both succeed, both update. Result: same award on two POs.
- **Fix:** Wrap in a Supabase transaction OR add `UNIQUE(award_id, po_id)` on `po_lines`.

**6. `/api/orders/switch-supplier` never updates `unit_cost`**
- `src/app/api/orders/switch-supplier/route.ts:64-68`
- Moves the line to the new supplier's PO but keeps the old cost. The displayed margin becomes a lie.
- **Fix:** Look up the new supplier's cost from `nsn_vendor_prices` and update `unit_cost` + `margin_pct` on the line before committing.

### Broken pipelines

**7. Missing pagination on `dibbs_solicitations` in `/api/dibbs/enrich`**
- `src/app/api/dibbs/enrich/route.ts:138-141`
- The main target table load is a single `.eq("is_sourceable", false)` with no `.range()`. Silently capped at 1,000 rows. Spec explicitly said "all paginated" — this one isn't.
- **Fix:** Wrap in a while-loop with `.range(page*1000, (page+1)*1000-1)` like the other loads.

**8. Background jobs have no `max_attempts` on insert → infinite retry loops**
- `src/app/api/jobs/seed/route.ts:49-58`, `src/app/api/jobs/seed-awards/route.ts:50-55`
- Seed endpoints insert jobs without setting `max_attempts`. The processor at `src/app/api/jobs/process/route.ts:297` compares `attempts >= job.max_attempts`, but `max_attempts` is null. Failed jobs retry forever. This is likely why 203 `award_lookup` jobs are stuck in a re-pending loop.
- **Fix:** Default `max_attempts: 3` at insert time or at column default in Supabase.

**9. Background jobs stuck in `processing` forever if worker dies**
- `src/app/api/jobs/process/route.ts:253-301`
- Job marked `status=processing` at start; no timeout recovery. If Railway crashes mid-job, the row stays `processing` and is never retried.
- **Fix:** Scheduled sweep: `UPDATE job_queue SET status='pending' WHERE status='processing' AND started_at < NOW() - interval '1 hour'`.

**10. `scripts/tmp-shipping-v2.sql` is referenced but not in the repo**
- `scripts/sync-shipping.ts:26` does `readFileSync(join(__dirname, "tmp-shipping-v2.sql"))`. File doesn't exist. Grep confirms zero `.sql` files in `scripts/`.
- **Fix:** Restore the SQL (reconstruct from `data-sources.md` + the `ka8/kaj/kad/k81` chain) or remove the script.

---

## HIGH (11)

**11. Client-side sourceable count re-implements logic — drifts from `isSourceableOpen()`**
- `src/app/solicitations/solicitations-list.tsx:175-197`
- The useMemo at line 194 checks `s.is_sourceable && !s.bid_status && open` but does not check `liveBidSols` or `decisionKeys`. Dashboard uses `isSourceableOpen()` which does. Three implementations diverge yet again — same failure mode as the March 27 bug we just fixed.
- **Fix:** Pass the context sets from the server and call `isSourceableOpen()` on the client.

**12. `/api/bids/decide` doesn't require `final_price` when `status="quoted"`**
- `src/app/api/bids/decide/route.ts:35-49`
- `final_price` is allowed null on quotes. Downstream consumers of "quoted" bids expect a price.
- **Fix:** Reject request if `(status==="quoted" || status==="submitted") && !final_price`.

**13. `handleSubmitAll` has no optimistic lock — overrides concurrent changes**
- `src/app/solicitations/solicitations-list.tsx:382-410`
- Loops sequentially. If another tab changes a bid's status mid-loop, this loop still POSTs "submitted" and overwrites.
- **Fix:** Refetch status per row before POST, or use a single batch endpoint with `WHERE status='quoted'` filter.

**14. `handleSync`/`handleEnrich` swallow errors**
- `src/app/solicitations/solicitations-list.tsx:253-318`
- `catch { setMessage("Sync failed") }` hides the actual 5xx payload. `handleEnrich` doesn't check `res.ok` — reloads the page even on failure.
- **Fix:** `if (!res.ok) setMessage(...); return;`. Also log to console.

**15. `/api/dibbs/check-open` false-positive match**
- `src/app/api/dibbs/check-open/route.ts:63-64`
- Returns `is_open` if the response contains `"SPE"` anywhere — any other solicitation in the DIBBS results counts. Will report the wrong solicitation as still open.
- **Fix:** Parse table rows and match the actual solicitation number.

**16. Margin computed two different ways (enrichment vs PO generation)**
- `src/app/orders/page.tsx:39` (page-load enrichment) vs `src/app/api/orders/generate-pos/route.ts:70-73` (PO creation)
- If `nsn_costs` changed between page load and PO generation, the margin stored in `po_lines` differs from what the user approved.
- **Fix:** Store the cost used with the line at PO creation time (`cost_snapshot_at`) or lock cost during the generate call.

**17. `awards.po_generated` isn't reset when a PO is deleted (empty after switch)**
- `src/app/api/orders/switch-supplier/route.ts:94-96`
- Deletes the empty PO but doesn't update the awards that were linked to it back to `po_generated=false`. Orphaned awards are hidden from "New only" filter.
- **Fix:** Update `awards.po_generated=false, po_id=null` for awards linked to the deleted PO.

**18. Missing pagination on `fsc_heatmap.in("bucket", ...)` in enrich**
- `src/app/api/dibbs/enrich/route.ts:97-101`
- Same 1K silent cap as #7.
- **Fix:** Paginate.

**19. Master DB timeout in enrichment is silently swallowed**
- `src/app/api/dibbs/enrich/route.ts:63-80`
- 15s timeout caught and ignored. If MDB is slow or down, `mdbNsnSet` is empty and we silently miss all MDB matches with no trace in `sync_log`.
- **Fix:** Log to `sync_log.details.errors[]` and emit a warning in the response.

**20. Analytics page breaks silently past 5,000 awards**
- `src/app/analytics/page.tsx:15-22`
- Hardcoded 5 parallel `.range()` calls: `[0-999, 1000-1999, ..., 4000-4999]`. Any rows at index ≥5000 are dropped. We have 74K awards — this flow probably already misses data.
- **Fix:** Loop until a page comes back empty, or use a materialized view.

**21. `handleSubmitAll` N+1 — sequential POSTs for N bids**
- `src/app/solicitations/solicitations-list.tsx:389-398`
- 50 bids × ~50ms each = 2.5s latency, compounding if the endpoint is slow.
- **Fix:** Add a batch endpoint that takes an array.

---

## MEDIUM (8)

**22. `/api/quotes/export` is dead code** (`src/app/api/quotes/export/route.ts`) — helper exists, no UI button calls it. Either wire it up or delete.

**23. `/api/dibbs/scrape` + `src/lib/dibbs-scraper.ts` are dead (legacy Playwright)** — grep confirms no caller. Keeping Playwright-touching code in the tree is a Railway-build risk if anything ever imports it transitively.

**24. `/purchase-orders` page is entirely mock data** (`src/app/purchase-orders/page.tsx:71`) — "Soon" buttons disabled. Either wire to `purchase_orders` table or remove from sidebar.

**25. Reprice has no UI trigger and doesn't auto-run after awards import** — prices stay stale until someone runs the script. Should auto-chain from `scripts/import-lamlinks-awards.ts` (or schedule weekly).

**26. Client-side `isOpen` function is duplicated from `src/lib/solicitation-filters.ts`** — `src/app/solicitations/solicitations-list.tsx:420-431` re-implements what the shared lib already does. Not a bug but drift risk. Import and reuse.

**27. Pricing bracket boundaries cause 17% price jumps on 1¢ cost changes** — cost $24.99 → 1.64×, cost $25.01 → 1.36×. Add hysteresis or lerp smoothing.

**28. USASpending job sends `psc_codes` with 4-digit FSC assumption not validated** (`src/app/api/jobs/process/route.ts:167`) — if `fsc` has >4 digits or leading zeros stripped, API silently returns 0.

**29. Invoice number generation has no uniqueness check** (`src/app/invoicing/invoicing-dashboard.tsx:58-67`) — two sessions generating for the same contract+line get the same 7-char number. Downstream EDI conflict.

---

## LOW (3)

**30. `/api/dibbs/reprice` has no auth or rate limit** — DOS vector (low impact since reprice is read-heavy only).

**31. `/api/solicitations/find-suppliers` scrapes Google without caching** — repeat calls hit Google hard; could get throttled. Add response cache (same NSN within 5min → return cached).

**32. `remittance/parse` uses hardcoded mock lookup** (`src/app/api/remittance/parse/route.ts:19-28`) — 8 sample invoice numbers. The "invoices" table that's supposed to back this doesn't exist. Whole flow is theater until that table is created.

---

## Observations not in specific findings

- **Logic duplication is the most common failure class**: counts are re-derived in the client (sourceable-list useMemo), the client filter function (isOpen), and the server (solicitation-filters.ts). Same bug class caused the March 27 mismatch. The shared-helper strategy works but has to be applied consistently.
- **Silent Supabase pagination limits are the second most common**: multiple routes load data with no `.range()` and rely on "there won't be >1K rows." Every table is heading toward >1K eventually.
- **No service-level audit trail**: `bid_decisions` is upserted on change, overwriting previous state. If Abe changes a price, the original is gone — only `updated_at` remains. Consider an append-only `bid_decision_history` table.
- **Public API paths are over-broad**: `/api/dibbs/*`, `/api/jobs/*`, `/api/awards/*`, `/api/whatsapp/*`, and `/api/bugs/respond` are all publicly callable. Most are called by GitHub Actions cron, so they need a different auth model (shared secret header) rather than being fully open.

---

## Audit methodology

- **Pass 1 (spec writing):** I read each flow's code and wrote `docs/flows/*.md` capturing routes, states, tables, invariants.
- **Pass 2 (this audit):** Subagents re-read the code with the spec in hand and identified divergences. Their reports were merged into this document.

Running a second audit pass in 3-6 months will catch new drift. The specs should be updated whenever a flow is meaningfully changed — otherwise the spec becomes stale and the audit surfaces phantom bugs.
