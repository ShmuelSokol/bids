# 2026-04-24 — First live DIBS→LL writeback test + Sally API creds recovery

## Outcome

- **One $239 bid shipped end-to-end via DIBS writeback** (sol `SPE2DS-26-T-009G`, NSN `6515-01-600-1916`). DLA ack email confirmed receipt.
- **LL API credentials recovered** from NYEVRVTC001's curl verbose log files — no longer need Yosef.
- **IP whitelist on `api.lamlinks.com` is suspected** but not yet confirmed; test script queued for next session.
- **Writeback is PAUSED** (`lamlinks_writeback_enabled=false`) until the cursor-fix patch is validated.

## Three things shipped to production

1. **`/ops/dibs-pipeline`** — live health dashboard for the write queue + LL-side snapshots (stuck staged envelopes, unshipped envelopes, recent activity). New table `ll_pipeline_snapshots`, populated by a new snapshot task in the daemon.

2. **Solicitations modal improvements** — CLIN count badge with ⚠ warning when single-CLIN but LL estimated value looks off; "↗ View on DIBBS" button; "⟳ Refresh from LL" button that queues a rescue action to backfill missing awards + bids for an NSN; "📦 Recent AX Receipts" card showing last purchase costs from AX.

3. **Rescue tooling** — `scripts/ll-reinsert-orphan-bid.ts` to restore k33/k34/k35 shell for bids DLA has but LL's local DB lost. Used today on envelope 46896 → reinserted as 46898 with preserved `qotref_k33='0AG09-46896'`.

## Things learned

- **VFP cursor errors 9999806/9999607 are cosmetic** — they don't mean the Sally transmit failed. Verify via ack email or `k33_tab.t_stat_k33` before touching.
- **Going fresh vs piggybacking into an existing staged envelope** exposes different cursor failure modes. Fresh fails at LL reopen; piggyback fails during Abe's save. No pure-SQL path fully avoids it.
- **Sally transmit happens independently of the cursor UI error.** Abe's Post click fires the HTTP call regardless of what VFP shows.
- **LL logs leak creds** — LL invokes curl with `-u "user:pass"` in cleartext and writes the full command to daily log files. Not great for security, great for us.

## Hypothesis-based patches (untested)

- **Worker k07 bump** — after envelope finalization, UPDATE the `k07_tab SOL_FORM_PREFERENCES` row to bump uptime. Based on 11:24 native-Post XE trace where LL's own client does exactly this. Theory: signals VFP to invalidate its local cursor cache. Needs a test bid to validate.

## Next session entry points

1. Confirm/refute IP whitelist — run `ll-api-test.ps1` from an LL-installed box (Abe's COOKIE, NYEVRVTC001 via RDP, or NYEVRVSQL001 if we want to use it for REST writeback).
2. If whitelisted — migrate writeback from SQL to REST using `src/lib/lamlinks-rest.ts` + `put_client_quote`.
3. If not — decide on call-routing (Yosef adds an IP? route through NYEVRVTC001?).
4. Re-enable writeback, test one DIBS bid, verify no cursor error (validates the k07 patch).
5. Watch DLA award pipeline for SPE2DS-26-T-009G — if it arrives orphaned, re-run `ll-reinsert-orphan-bid.ts`.

## Commits

- `76e05a0` — observability dashboard + cursor-fix patch + orphan-rescue
- `b2f4d08` — multi-CLIN visibility + on-demand NSN history refresh
