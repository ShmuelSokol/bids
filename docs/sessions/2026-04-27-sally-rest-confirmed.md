# 2026-04-27 — Sally REST confirmed working (and where from)

## Outcome

- **Sally REST API auth works** with our recovered creds — confirmed via 200 OK response from `/api/llsm/create` on a whitelisted box.
- **IP whitelist is real and confirmed.** NYEVRVTC001 = whitelisted; GLOVE = not. This was the actual blocker, not bad creds.
- **Creds verified byte-for-byte** against today's LL logs — no rotation, no special-char mangling. `.env` values are correct.
- **Architecture decision:** REST writeback must run from a whitelisted box. New worker on NYEVRVTC001 (or NYEVRVSQL001) reading a Supabase queue.
- **SQL writeback remains the path today.** REST is a future migration once the worker is built.

## What was tested

Three curl invocations from NYEVRVTC001 against `api.lamlinks.com:80` using LL's bundled curl (`G:\PROGRAMS\LAMLINKS\Control\Lamlinkp\LLPservr\code\curl.exe`):

| Test | Endpoint | Result |
|---|---|---|
| 1 | `/api/rfq/get_sent_quotes_by_timeframe` (empty body) | 401 — server rejected our digest hash |
| 2 | Same, but with real `quote_min_datetime/max_datetime` body | **200 OK**, `<completion_code>1</completion_code>`, `records="0"` |
| 3 | `/api/llsm/create` with no `function` param (em-dash mangled `--data`) | **200 OK**, envelope `<status>invalid</status> <response_message>Function Not Specified</response_message>` |

Test 3 is the key — it's the actual writeback endpoint, and even with a malformed body it returned a 200 with a real response envelope. That's authentication + authorization passing.

The 401 in test 1 was an artifact of `--data ""`. With any non-empty body, auth completes. Likely curl handles digest differently when there's no body to send, or the server's auth path requires `Content-Length > 0`.

## What we now know about the auth + ACL model

- Realm: `API_TEST` (despite the name, this is production)
- Username: `<sally_login>#<api_key>` literal
- Password: `<api_secret>` (14 chars including `^,`)
- qop: `auth` (no body hashing required)
- Cookie: `lamlinksApiSession` — server sets it on first 401, optional to send back
- ACL is per-function — same creds got 200 on `get_sent_quotes_by_timeframe` but `API Access Forbidden - 84662` on `get_quotes_by_timeframe`. Each `lis_function` has its own permission grant.
- Whether `put_client_quote` is in our grant — unknown until we send a real one. Not worth more curl gymnastics; we'll find out from the worker.

## Key file locations on NYEVRVTC001

- `\\NYEVRVTC001\c$\LamlinkP\data\log\<date>.txt` — daily LL log. Contains every curl invocation cleartext (key, secret, body). Format: timestamp + `Module 'api/...' curl: <args> ==> <result>`.
- `G:\PROGRAMS\LAMLINKS\Control\Lamlinkp\LLPservr\code\curl.exe` — LL's bundled curl 7.70.0.

The latest log file on a live LL box is held with an exclusive write lock. Use `[IO.File]::Open(path, 'Open', 'Read', 'ReadWrite')` to read past the lock, or read the second-most-recent file (rotation happens daily at ~03:05).

## Working curl recipe (for reference / regression testing)

```powershell
& "G:\PROGRAMS\LAMLINKS\Control\Lamlinkp\LLPservr\code\curl.exe" `
  --digest `
  --data "quote_min_datetime=4%2F27%2F2026+12%3A00%3A00+AM+UTC&quote_max_datetime=4%2F27%2F2026+11%3A59%3A59+PM+UTC" `
  -u"ajoseph@everreadygroup.com#7Lx6La4QIpESAgNhfJmSPhWn0Yk:6i^,j5F29jQxCF" `
  -c C:\Windows\Temp\ll-jar.txt `
  "http://api.lamlinks.com/api/rfq/get_sent_quotes_by_timeframe" `
  -o C:\Windows\Temp\response.xml
```

If pasting through RDP, save to a `.ps1` file via Notepad first — em-dash autocorrect mangles `--data`/`--digest` and curl falls through to a GET with no body.

## Why this took so long

A handful of compounding red herrings:

1. We tested from GLOVE first (not whitelisted) — got 401, assumed creds were wrong.
2. Em-dash autocorrect on RDP paste (`--` → `–`) broke the second test on NYEVRVTC001.
3. Empty `--data ""` causes a 401 even on the whitelisted box, suggesting bad creds.
4. The cleartext creds in LL logs looked too easy, breeding skepticism.

The unblock was reading what LL's curl was actually sending in the log (`-cookies`, real form data) and replaying that pattern verbatim.

## Next session entry points

1. **Build the NYEVRVTC001 worker** per `docs/architecture/sally-rest-worker.md`. Local Node process polling `lamlinks_rest_queue` Supabase table.
2. **First real call: `are_you_listening` heartbeat** — proves the wire-format end-to-end before risking a bid.
3. **Then `put_client_quote` with one test bid** — if it 403s, we know REST writeback is gated on a permission ERG doesn't have, and SQL stays the path.
4. **Re-enable `lamlinks_writeback_enabled=true`** with the k07 cursor patch — independent of REST work, unblocks today.

## Commits this session

(Pending — session doc + architecture doc + memory updates.)
