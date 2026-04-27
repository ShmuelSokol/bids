# DIBS ↔ LamLinks REST API: where we landed + what we need from you

**To:** Yosef Schapiro (LamLinks admin)
**From:** Shmuel Sokol
**Date:** 2026-04-27
**TL;DR:** We confirmed the LamLinks REST API works with the credentials we already have — but only from boxes inside the office. We need your help on three things: (1) confirm the office IP whitelist scope, (2) confirm ERG is licensed for `put_client_quote` and the invoice equivalent, (3) decide which Windows box should host a small worker process that drives REST calls on DIBS's behalf.

---

## What we proved today

Working from NYEVRVTC001 via RDP (the box where LamLinks runs), using LL's bundled curl with the credentials we recovered from your daily curl logs:

- **The credentials work.** `api_key` + `api_secret` recovered byte-for-byte from `\\NYEVRVTC001\c$\LamlinkP\data\log\*.txt` authenticate cleanly against `api.lamlinks.com/api/llsm/create`.
- **The IP whitelist is real.** Same credentials return HTTP 200 from NYEVRVTC001, but HTTP 401 from our cloud servers (Railway/GLOVE). So any DIBS code that wants to call Sally has to do so from a whitelisted office IP.
- **Per-function authorization is independent of authentication.** Same credentials return:
  - 200 OK on `get_sent_quotes_by_timeframe`
  - 200 OK on `/api/llsm/create` with no function (envelope returned, "Function Not Specified")
  - "API Access Forbidden - 84662" on `get_quotes_by_timeframe`

  So whether ERG can call a given function depends on what's in our license — not just on auth.

## Where the bid pipeline stands today (no REST API)

Today DIBS already submits bids to DLA, but via a workaround:

1. DIBS computes the bid (price, lead time, etc.).
2. DIBS' background worker connects to LL's SQL Server (NYEVRVSQL001) and inserts rows into `k33_tab` / `k34_tab` / `k35_tab` under Abe's existing staged envelope.
3. Abe sees the new line in LL when he reopens the form, then clicks **Post** to fire the EDI transmission.

This works — first end-to-end transmission was 2026-04-21 — but it has two pain points:

- **VFP cursor errors** show up in LL when Abe reopens the form (`9999806`, `9999607`). They look alarming but they're cosmetic: the bid still transmits to DLA. Confirmed via DLA ack emails on 2026-04-24.
- **Abe still has to click Post.** Each batch requires him to first save a dummy line in LL so we have an envelope to append to, then click Post when DIBS adds its lines. Roughly the same touchpoint cost as bidding manually for the click portion.

We just put a hypothetical fix for the cursor errors into the worker (we add an UPDATE to `k07_tab.SOL_FORM_PREFERENCES` after our INSERT — same row LL itself updates 12+ times per Post burst, per our 2026-04-27 SQL Server XE trace). Whether it actually silences the errors needs a real test bid tomorrow morning.

## What REST API access would change

If the REST path works end-to-end, we replace steps 2 + 3 above with a single `put_client_quote` HTTP call:

- **No SQL writes into k33/k34/k35** → no VFP cursor errors at all
- **No "save a dummy line first"** → DIBS builds the whole envelope itself, same as LL does internally
- **No Abe Post click** → the REST call IS the Post

It also opens up a bunch of other reads we currently do via direct SQL:

| LL function | What it does | What we use today |
|---|---|---|
| `put_client_quote` | Submit bid to DLA | Direct SQL writeback (current) |
| `put_client_invoice` *(name TBC)* | Submit invoice to DLA | Manual Post in LL |
| `get_sent_quotes_by_timeframe` | Recently transmitted bids | Direct SQL read |
| `sol_no_to_quote_info` | One quote by sol number | Direct SQL read |
| `get_awards_by_contract_url` | Awards by contract | Direct SQL read |
| `e_code_to_entity_info` | Entity lookup | Direct SQL read |

All of these would route through one shared worker process, just with different `lis_function` values.

## Architecture we're building

Already coded and committed (just not deployed yet):

```
DIBS API (Railway/cloud)            Supabase                 Worker (one office box)        api.lamlinks.com
─────────────────────────           ────────                 ────────────────────────       ──────────────────
INSERT lamlinks_rest_queue ───►    [pending row]
                                       │
                                       │ ◄─── poll every 30s ─── ll-rest-worker.ts
                                                                       │
                                                                       ▼
                                                              spawns LL's curl
                                                              with digest auth
                                                              POST /api/llsm/create ──────► [Sally response]
                                                                       │ ◄────────────────────
                                                                       ▼
                                  UPDATE row ◄── completed_at, response_xml, completion_code
                                       │
SELECT row WHERE id=X ◄────────────────┘
```

The DIBS code that runs in the cloud never calls Sally directly. It enqueues a row in Supabase, and a worker process running on a whitelisted Windows box drains the queue.

The worker uses LL's own curl binary (already on every LL workstation at `G:\PROGRAMS\LAMLINKS\Control\Lamlinkp\LLPservr\code\curl.exe`) — so the request shape is byte-identical to what LL itself sends.

## What we need from you

### 1. Whitelist scope confirmation

Two questions:
- Is `api.lamlinks.com`'s IP whitelist scoped to **the office's external NAT IP** (so any office workstation works), or **per-host** (only specific machines get in)?
- If we asked LamLinks to add Railway's egress IP, would that be a reasonable request, or is the whitelist deliberately tight to office-only? *(If yes, we'd skip the worker entirely. If no, we proceed with the worker.)*

### 2. License confirmation: which `lis_function` calls is ERG paid for?

Today same creds get 200 on `get_sent_quotes_by_timeframe` and 403 on `get_quotes_by_timeframe`. We need to know:
- **`put_client_quote`** — can ERG submit bids via REST? (This is the headline question.)
- **The invoice equivalent** — what's the function name? Is ERG licensed for it?
- Any other functions you know we'd need / can't have

If `put_client_quote` is forbidden, we stay on SQL writeback indefinitely. No problem — we just want to know.

### 3. Which Windows box should host the worker?

Any office LL workstation should work (assuming the whitelist is per-office). Options:

| Box | Pros | Cons |
|---|---|---|
| **NYEVRVTC001** (LL file server) | 24/7, has LL's curl, server-class | Production server — installing Node has higher review bar |
| **NYEVRVSQL001** (LL SQL Server) | 24/7, already runs DIBS workers, has Node + this repo cloned | Whitelist eligibility unverified — needs a one-time test |
| **Your PC** | You own it, easy to debug | Sleeps when you're offline |
| **Abe's COOKIE box** | Active during bid hours | You'd still set it up; sleeps off-hours |
| **Dedicated VM** | Clean isolation | More setup |

Our preferred option is **NYEVRVSQL001** (single deployment alongside the existing SQL writeback worker), but only if it's whitelisted. NYEVRVTC001 is the fallback. Happy to defer to your call.

The verification one-liner is in `docs/sally-rest-worker.md` if you want to run it on NYEVRVSQL001 and tell us yes/no.

## What we'll test tomorrow without you

These don't block on you — we'll do them ourselves and report back:

1. **Did the k07 cursor patch silence the VFP errors?** Re-enabled SQL writeback today (`lamlinks_writeback_enabled=true`). One real bid through DIBS will tell us. If errors persist, we still don't lose the bid (cosmetic), but we'll dig deeper.
2. **Is NYEVRVSQL001 whitelisted?** Run the verification curl from there, see if we get 200. Saves you a step.
3. **Does the worker process actually process queue rows?** Hand-test the queue with a heartbeat row, watch it flip to `done`.

## Background reading (if you have 10 min)

In the DIBS repo (or rendered at `dibs-gov-production.up.railway.app/wiki`):
- `docs/sally-rest-worker.md` — full architecture + queue schema
- `docs/lamlinks-writeback.md` — how SQL writeback works today
- `docs/sessions/2026-04-27-sally-rest-confirmed.md` — full chronicle of today's testing
- `docs/gotchas.md` (the LamLinks Sally REST section) — short version of all the gotchas

## Bottom line

We don't need anything from you to keep current bids flowing — SQL writeback works. What we'd like from you is a 15-minute conversation (or async answers) about the three numbered questions above, so we know whether to invest in deploying the REST worker or keep SQL writeback as the long-term path.

— Shmuel
