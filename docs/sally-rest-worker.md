# Sally REST Worker — DIBS → LamLinks REST writeback architecture

## Why this exists

`api.lamlinks.com` IP-whitelists. Confirmed 2026-04-27: same creds return 200 OK from any LL workstation in the office, but 401 from GLOVE/Railway. The fix: run a small Node worker on a whitelisted box that pulls work from a Supabase queue and forwards calls to Sally on DIBS's behalf.

This is the same pattern as `lamlinks_rescue_actions` (already in production for SQL-writeback recovery) — just pointed at the REST API instead of the LL SQL DB.

## Scope: what this unlocks

The worker handles **any `lis_function` call**, not just bid writeback. The same queue + worker can drive:

| `lis_function` | Purpose | Replaces |
|---|---|---|
| `put_client_quote` | Submit a bid to DLA | SQL writeback into k33/k34/k35 + Abe's manual Post click |
| `put_client_invoice` *(name TBC with Yosef)* | Submit an invoice | SQL writeback + manual Post in LL |
| `are_you_listening` | Heartbeat | n/a (new — used for liveness checks) |
| `get_sent_quotes_by_timeframe` | Read recently-transmitted bids | Polling LL's SQL DB |
| `sol_no_to_quote_info` | Pull a quote by sol number | Reads k34/k35 directly |
| `get_awards_by_contract_url` | Pull awards by contract | Reads k81 directly |
| `e_code_to_entity_info` | Lookup entity info | Reads k14 directly |

**Per-function ACL:** the server gates each function independently. ERG is confirmed authorized for `get_sent_quotes_by_timeframe` (200) and forbidden on `get_quotes_by_timeframe` (`API Access Forbidden - 84662`). Whether `put_client_quote` and `put_client_invoice` are in our grant — open question for Yosef / first real test.

## Flow

```
DIBS (Railway)                Supabase                 Whitelisted-box worker         api.lamlinks.com
─────────                     ────────                 ──────────────────────         ─────────────────
INSERT lamlinks_rest_queue ─► [pending row]
                                   │
                                   │ ◄─── poll(30s) ─── ll-rest-worker.ts
                                                              │
                                                              ▼
                                                       buildRequestXml(...)
                                                       Digest auth via curl
                                                       POST /api/llsm/create ──────► [LL response]
                                                              │ ◄────────────────────
                                                              ▼
                              UPDATE row ◄── completed_at, response_xml
                                   │
SELECT row WHERE id=X ◄────────────┘
```

DIBS API routes never call Sally directly. They INSERT into the queue, then poll (or subscribe via Supabase realtime) for completion.

## Queue table

```sql
CREATE TABLE lamlinks_rest_queue (
  id              BIGSERIAL PRIMARY KEY,
  lis_function    TEXT NOT NULL,            -- e.g. 'put_client_quote', 'are_you_listening'
  e_code          TEXT NOT NULL DEFAULT '0AG09',
  req_data_xml    TEXT NOT NULL,            -- already-escaped XML inner body
  wait_seconds    INTEGER NOT NULL DEFAULT 30,
  -- Lifecycle
  state           TEXT NOT NULL DEFAULT 'pending'
                  CHECK (state IN ('pending','running','done','error','timeout')),
  enqueued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  -- Result
  http_status     INTEGER,
  completion_code INTEGER,                  -- LL's <rspcod> / <completion_code>
  response_xml    TEXT,
  error_message   TEXT,
  -- Tracing
  enqueued_by     TEXT,                     -- which DIBS API route / user
  related_kind    TEXT,                     -- e.g. 'bid_writeback', 'heartbeat'
  related_id      TEXT                      -- link back to bid_decisions/etc.
);

CREATE INDEX idx_rest_queue_pending
  ON lamlinks_rest_queue(state, enqueued_at)
  WHERE state IN ('pending','running');
```

## Where the worker should run

Any LL-installed Windows box in the office is almost certainly whitelisted (the office likely NATs all egress through one external IP, and LL itself reaches Sally from these boxes). The trade-offs are about operational fit, not whitelist eligibility.

| Candidate | Pros | Cons |
|---|---|---|
| **NYEVRVTC001** (server-class Windows box that hosts LL files) | Already runs 24/7. Already has LL's curl bundled. Server-class — never sleeps, never logs out. No user impact if Node is added. | Production server — anything installed there has higher review bar. Less casual to RDP into for debugging. |
| **NYEVRVSQL001** (LL SQL Server) | Already runs 24/7, already has Node + tsx + this repo (it hosts the SQL writeback worker today). Easy to deploy alongside existing worker. | Whitelist status not yet verified — needs a one-time test. If not whitelisted, ask Yosef to add. |
| **Yosef's PC** | Yosef has admin and would maintain it. Easy debug access. | Sleeps when he's offline / on PTO. Worker dies when he reboots. |
| **Abe's COOKIE box** | Already running during bid hours. | Abe doesn't do dev work; Yosef would still have to set it up. Sleeps off-hours. |
| **Dedicated VM in the office** | Clean isolation. Yosef can manage independently. | Yosef has to spin one up. Most setup cost. |

**Recommendation:** NYEVRVSQL001 if it's whitelisted (single deployment alongside existing worker, single host to maintain). NYEVRVTC001 as fallback. Avoid user PCs unless we're confident they don't sleep.

**Whitelist verification one-liner** (run from candidate box):

```powershell
& "G:\PROGRAMS\LAMLINKS\Control\Lamlinkp\LLPservr\code\curl.exe" --digest `
  --data "wait=15&function=are_you_listening&data=%3CRequest%3E%3Clis_function%3Eare_you_listening%3C%2Flis_function%3E%3Ce_code%3E0AG09%3C%2Fe_code%3E%3Creq_data%3E%3C%2Freq_data%3E%3C%2FRequest%3E" `
  -u"<login>#<key>:<secret>" -c $env:TEMP\jar.txt `
  "http://api.lamlinks.com/api/llsm/create" -o $env:TEMP\heartbeat.xml; gc $env:TEMP\heartbeat.xml
```

A response containing `<completion_code>1</completion_code>` (or any well-formed `<api_req>` envelope, even an "invalid" one) confirms the box is whitelisted. A 401 confirms it isn't.

## Worker (`scripts/ll-rest-worker.ts`)

Single process, single concurrency (LL's API isn't built for parallelism — Abe sees ~1 call per 30 min from native LL). Wrap as a Windows service via NSSM, run under PM2, or just leave a minimized PowerShell window open during business hours.

```
loop:
  row = SELECT * FROM lamlinks_rest_queue
        WHERE state='pending'
        ORDER BY enqueued_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED

  if !row: sleep 30s; continue

  UPDATE row SET state='running', started_at=now()

  try:
    res = await callLisFunction(creds, row.lis_function, row.req_data_xml, row.wait_seconds)
    UPDATE row SET state='done', completed_at=now(),
                   http_status=res.httpStatus,
                   completion_code=res.compCode,
                   response_xml=res.rawResponse
  catch e:
    UPDATE row SET state='error', completed_at=now(), error_message=e.message
```

Idempotency: caller is responsible. If a `put_client_quote` row is enqueued twice, two bids get sent. DIBS API routes should dedupe before INSERT.

## Why curl-shell-out, not Node fetch

Our existing `src/lib/lamlinks-rest.ts` uses Node's `fetch` + a hand-rolled Digest implementation. It works in theory, but:
- Digest implementations are subtly fragile — the failed `--data ""` case showed even curl can produce a request that the server rejects.
- LL's own logs prove the curl recipe works. Replaying that recipe by spawning curl is the lowest-risk path.
- The whitelisted box already has LL's curl at `G:\PROGRAMS\LAMLINKS\Control\Lamlinkp\LLPservr\code\curl.exe`. No new dependency.

So the worker spawns curl per call, parses the response file, and updates the queue row. The Node Digest path stays as a fallback.

## Credentials

`.env` on NYEVRVTC001 (NEVER committed):

```
LL_SALLY_LOGIN=ajoseph@everreadygroup.com
LL_API_KEY=7Lx6La4QIpESAgNhfJmSPhWn0Yk
LL_API_SECRET=6i^,j5F29jQxCF
LL_E_CODE=0AG09
LL_API_HOSTNAME=api.lamlinks.com
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Worker prefers env vars, falls back to `kah_tab` lookup via `credentialsFromKahTab()` for sally_login auto-rotation.

## DIBS-side integration points

- `POST /api/lamlinks/heartbeat` — INSERT row with `lis_function='are_you_listening'`. Used by `/ops/dibs-pipeline` health card.
- Bid Post handler — once SQL writeback succeeds, optionally INSERT a `put_client_quote` row as a parallel REST-mode test. Behind a feature flag (`system_settings.lamlinks_rest_writeback_enabled`).
- Future: replace SQL writeback entirely once REST writeback proves stable for ~50 bids without incident.

## Dashboard

Add a panel to `/ops/dibs-pipeline`:
- Latest queue row state distribution (pending/running/done/error counts, last 24h)
- Most recent failure (response_xml + error_message)
- Heartbeat freshness — green if a successful `are_you_listening` row exists in last 5 min, red otherwise (the worker also runs a self-heartbeat every 5 min so the dashboard works even when bids are quiet)

## Failure modes

- **Worker stops** — heartbeat goes stale on dashboard within 5 min. Manual restart on NYEVRVTC001.
- **Sally returns "API Access Forbidden" for `put_client_quote`** — ERG isn't licensed for REST writeback. Stay on SQL. Document in this file as confirmed-blocked.
- **Sally rotates creds** — `.env` becomes stale. Worker logs the auth failure; re-extract creds from `\\NYEVRVTC001\c$\LamlinkP\data\log\` and update `.env`.
- **Network egress changes** — if LL changes whitelist, curl gets 401 from the worker. Same diagnosis path as above.

## Out of scope (explicit non-goals)

- HTTPS — Sally is HTTP-only at `api.lamlinks.com:80`. Don't try to upgrade.
- Multi-tenant — only ERG (`e_code=0AG09`). If we ever onboard another CAGE, revisit.
- Retries — the worker does not auto-retry. A failed call goes to `state='error'` and stays there. Manual review via dashboard.
- High concurrency — single worker, sequential. LL's API is not built for parallel callers.
