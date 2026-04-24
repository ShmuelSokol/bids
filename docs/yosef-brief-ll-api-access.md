# DIBS ↔ LamLinks: Why we need Sally API access

**To:** Yosef Schapiro (LamLinks admin)
**From:** Shmuel Sokol
**Date:** 2026-04-24
**TL;DR:** Abe's bids are flowing through DIBS → LL → DLA, but each one still requires him to click "Post" in LL. If we get Sally API credentials (`api_key` + `api_secret`), DIBS can transmit directly and save ~45 min/day on invoice posting alone.

---

## What DIBS is today

DIBS is the internal intelligence layer on top of LamLinks — suggested bid prices, sourcing matches from AX, competitor history, near-real-time dashboard for Abe's bids pipeline. Live at `dibs-gov-production.up.railway.app`.

## What we tested today (2026-04-24)

1. **Turned on DIBS → LL SQL writeback** so DIBS could push bids into `k33_tab` / `k34_tab` / `k35_tab` directly.
2. Abe submitted 2 bids through DIBS:
   - `SPE2DH-26-T-3287` @ $216 (submitted natively in LL as the baseline — **transmitted cleanly**)
   - `SPE2DS-26-T-009G` @ $239 (submitted via DIBS → DIBS wrote rows → Abe clicked Post → **DLA ack'd the $239**)

**Bottom line: end-to-end works.** DIBS can prepare bids, write them into LL's staging tables, and when Abe clicks Post in LL once, LamLinks transmits to DLA via Sally.

## What went wrong

On the DIBS-submitted bid, Abe saw VFP cursor error **9999806** and `9999607` when opening LL. These are the same "Update conflict in cursor" errors you get when LL's local cursor cache sees rows it didn't create itself.

Key learning (from prior session + today's trace): **the cursor error is cosmetic — the Sally HTTP transmission happens anyway**. DLA's ack email confirmed receipt at 11:47 and 11:50 ET. First attempt was superseded by second (standard Sally dedup).

So the bid shipped. But cursor errors are jarring for Abe and he can't tell if it actually worked without checking the ack email.

## What we want from you

**Sally API credentials for Abe (or a DIBS service user):**

- `api_key` — 27-char string, probably prefixed `7Lx...`
- `api_secret` — companion secret

We scanned thoroughly on Abe's box and didn't find them:

- `C:\LamlinkP\LLPro.ini` → only workstation paths, no creds
- Windows registry (`HKCU\Software\LamLinks`, `HKLM\...`) → no keys
- Abe's local LL binaries (`.exe` / `.dll` / `.fxp` / `.dbf`) → no `7Lx...` string
- `G:\PROGRAMS\LAMLINKS\` server configs → nothing matching
- `llk_db1.kah_tab` → only `sally_login` + `sally_password`; no `api_key` / `api_secret` entries

Our best guess: the API creds are installed only on **admin** workstations (yours?) or obtained from the LamLinks vendor on request.

## What unlocks once we have them

Using the Sally API (`api.lamlinks.com/api/llsm/create`, Digest auth, `put_client_quote`):

1. **Zero-click bid transmission** — DIBS Approve → bid at DLA. No Abe-in-LL step.
2. **Bulk invoice posting** — Abe spends ~45 min/day clicking through 6-7 screens per invoice in LL. Sally's equivalent function lets us one-click-all.
3. **Fully autonomous** — DIBS can batch 50 bids overnight, transmit at 6 AM, and Abe walks in to a dashboard of acks, not a queue.

Without the creds, DIBS still provides lots of value (pricing intelligence, CLIN validation, AX matching, auto-research, etc.) — but Abe keeps his LL "Post" click habit forever.

## What I need

Either:

- Copy/paste of your `api_key` + `api_secret` from wherever they live on your box (DM only — treat like a password), OR
- Who at LamLinks vendor to ask for a fresh `api_key` / `api_secret` for ERG

If helpful I can walk through your LL install with you to find where the creds are stored. Should take 10 min.

Thanks,
Shmuel
