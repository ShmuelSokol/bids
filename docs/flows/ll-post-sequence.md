# LamLinks bid Post — confirmed SQL sequence

Captured live 2026-04-27 11:03–11:09 AM ET from XE traces (`dibs_ll_trace`,
`dibs_ll_trace_server`) of Abe's COOKIE workstation while he was actively
posting bids. This supersedes the partial picture from the 2026-04-24 single-bid
trace.

## Per-bid sequence (in order)

```
1. SELECT kah_tab WHERE anutyp='Sally Credentials' AND anutbl='k14' AND idnanu=<idnk14>
   ↳ pulls sally_login + sally_password XML for the user
   ↳ fired at the START of every Post — used to auth the upcoming Sally call

2. UPDATE kdy_tab SET idnval_kdy = idnval_kdy + 1 WHERE idnkdy=<seq for k33_tab>
   ↳ allocate next idnk33 (envelope ID)
   ↳ uses optimistic concurrency: WHERE clause includes prior uptime_kdy + idnval_kdy

3. INSERT k33_tab (envelope shell)
   ↳ o_stat='adding quotes', t_stat='not sent', a_stat='not acknowledged',
     s_stat='adding quotes', itmcnt=0
   ↳ qotref_k33='0AG09-<idnk33>'
   ↳ all 4 stme_* timestamps = NOW

4. UPDATE kdy_tab → allocate next idnk34
5. UPDATE kdy_tab → allocate next idnk35

6. INSERT k34_tab (bid line)
   ↳ ~73 columns. Sol-specific: idnk11_k34, idnk33_k34, pn_k34, mcage_k34, solqty_k34, qty_ui_k34
   ↳ Constant per ERG: scage_k34='0AG09', sname_k34='SZY Holdings, LLC', shipping address, sphone/semail
   ↳ XML blobs: gennte_k34 (generation note schema v1.902, contains procod/socode/fatwvr/etc),
     pkgnte_k34 (package note, often empty)
   ↳ ctlxml_k34 (control XML, often empty)

7. INSERT k35_tab (qty/price/lead-days)
   ↳ up_k35 = price (numeric 12,4)
   ↳ qty_k35 = our bid qty
   ↳ daro_k35 = lead-days (delivery ARO)
   ↳ clin_k35 = blank usually

8. UPDATE k33_tab SET itmcnt_k33 = itmcnt_k33 + 1 WHERE idnk33=<env> AND itmcnt_k33=<prior>
   ↳ optimistic concurrency

9. UPDATE k07_tab SET uptime_k07=NOW, ss_val_k07=<encoded form state>
   WHERE idnk07=<row> AND uptime_k07=<prior> AND ss_val_k07=<prior>
   ↳ ss_key='SOL_FORM_PREFERENCES', ss_tid='U', upname=<user>
   ↳ This is the session-state heartbeat. Native LL fires 12+ k07 UPDATEs across
     a 6-min Post burst — once per UI interaction during the bid form.
   ↳ ALSO seen on NYEVRVTC001 — every active LL user (yschapiro, ajoseph) keeps
     bumping their own k07 row.
   ↳ This UPDATE is wrapped in implicit_transactions on/COMMIT/off blocks.

10. (Repeat 2–8 for each additional bid in the envelope)

11. (When Abe clicks Post in LL UI):
    - LL's VFP client makes the HTTP call to api.lamlinks.com/api/llsm/create
    - LL flips k33_tab states: o_stat='quotes added', s_stat='quotes added',
      t_stat='sent' (after Sally ack)
```

## Why our writeback worker's k07 bump matters (validated)

The 2026-04-24 cursor errors (9999806, 9999607) appeared when Abe's local VFP
cursor reloaded after our worker had inserted k33/k34/k35 rows without bumping
k07_tab. Native Post fires the k07 UPDATE 12+ times during a normal bid flow.
Our worker now does it once at envelope finalization, matching the LL-native
state-bump signature. Theory: LL's local VFP cursor uses k07 uptime as a
cache-invalidation trigger.

This is now confirmed via trace evidence to be the universal pattern (every
active LL user — Abe, Yosef — fires the same k07 UPDATE per interaction). If
DIBS writes don't bump it, the local cursor is stale and complains on next
fetch.

## What our worker does match (confirmed sound)

- `kdy_tab` allocation pattern: same UPDATE-with-optimistic-concurrency. Our
  pattern uses `ROWLOCK, HOLDLOCK` hints which LL's native version doesn't
  appear to use, but the locking outcome is equivalent.
- `k33_tab` initial state (`adding quotes`/`not sent`/etc.) matches.
- `k34_tab` field shape: ~73 columns — our worker writes the same set via a
  template-clone SELECT. Native LL writes literal VALUES. Both produce
  equivalent rows for ERG's case.
- `k35_tab` shape (8 fields): exact match.

## Tables NOT to clobber

These are LL-internal config tables we should never write to:

- `kah_tab` — config + Sally Credentials. Reads only.
- `k07_tab` — session state. Bump uptime only, never INSERT new rows.
- `kdy_tab` — sequence allocator. Use the UPDATE pattern; never INSERT.
- `kc4_tab`, `kc5_tab` — incoming-from-DIBBS award/file logs. NYEVRVTC001
  populates these via the daily DLA download daemon.

## Newly-seen tables (catalogued for future reference)

| Table | Hits/min | Likely role (best guess from name + frequency) |
|-------|---------:|-----------------------------------------------|
| `kc5_tab` | 2604 | DIBBS file-import log (sol-status feeds, ZIP imports). Populated by NYEVRVTC001's overnight import daemon. |
| `k24_tab` | 644 | (TBD — heavy COOKIE side, possibly session/preferences) |
| `k31_tab` | 561 | (TBD — possibly contracts) |
| `k25_tab` | 537 | (TBD) |
| `kap_tab` | 514 | ka-prefix = config-ish table family |
| `k74_tab` | 483 | (TBD) |
| `kan_tab` | 474 | ka-prefix = config-ish |
| `kbd_tab` | 435 | kb-prefix = bid-detail probably |
| `ka7_tab` | 518 (server) | (TBD) |
| `kc0_tab` | 270 (server) | kc-prefix = comms / customer-facing |

If future debugging touches one of these, add a one-line schema probe
(`SELECT TOP 1 * FROM <name>_tab`) and update this list.

## kc5_tab finding — LL's overnight DIBBS importer (NYEVRVTC001)

Schema sample:
```
idnkc5_kc5     43756
addtme_kc5     2026-04-27T04:20:31  -- 12:20 AM ET Monday
addnme_kc5     yschapiro
i_stat_kc5     'Importing File'      -- still "in progress" 11h later (suspicious; possibly stuck)
dnltyp_kc5     'sol-status-file'
ref_no_kc5     '12083-383-845'
filnam_kc5     A0139193.ZIP
itmcnt_kc5     135
```

NYEVRVTC001 runs an LL daemon under Yosef's user that:
- Downloads DLA periodic files (sol-status, etc.)
- Logs each download as a kc5 row
- Imports content into `kc4_tab` (incoming awards) and other tables

This is why DIBS sees fresh awards through the LL→DIBS sync without ever
scraping DIBBS ourselves. We piggyback on LL's import daemon.

The `Importing File` rows that linger > 12 hours look like stuck imports
worth surfacing in `/ops/dibs-pipeline` as an LL-side health signal.

## kah_tab Sally Credentials lookup (per-Post)

Native LL fires this query at the START of every Post:

```sql
SELECT idnkah_kah, uptime_kah, upname_kah, anutbl_kah, idnanu_kah,
       anutyp_kah, a_note_kah
FROM dbo.kah_tab
WHERE anutyp_kah LIKE 'Sally Credentials'
  AND anutbl_kah LIKE 'k14'
  AND idnanu_kah = <idnk14>   -- Abe's user id = 3
```

`a_note_kah` returns `<sally_credentials><sally_password>...</sally_password><sally_login>...</sally_login></sally_credentials>` — login + password only.

**`api_key` and `api_secret` are NOT returned by this query.** They live
exclusively in LLPro.ini-equivalent files on disk (filesystem read at LL
startup, not visible in SQL XE). Confirms our 2026-04-24 finding.

If we want DIBS REST writeback to dynamically pull sally_login/password
(instead of hardcoding them), we can replicate this exact query. We'd still
need api_key/api_secret from a different source (.env via IP-whitelist test
or filesystem scrape).

## Implications for our writeback design

1. **Keep the k07 bump in the worker.** Validated by trace.
2. **Optionally pull sally_login/password from `kah_tab` per call** instead of
   .env — auto-rotates, no secrets-on-disk for those two fields. (Implementation
   in `src/lib/lamlinks-rest.ts` could accept a `credentialsFromKahTab(idnk14)`
   alternative to `credentialsFromEnv()`.)
3. **api_key/api_secret remain blocked on filesystem capture** until we run
   ProcMon on Abe's box during LL startup, OR confirm IP-whitelist for one of
   our hosts.
4. **k34_INSERT shape is correct.** No changes needed.

## How to read more trace events

```bash
npx tsx scripts/_trace-deep-look.ts        # last 1000 events with pattern hits
npx tsx scripts/_trace-mine-novel.ts       # find NEW tables / SPs / patterns
npx tsx scripts/_trace-k34-insert.ts       # extract full INSERT statements
npx tsx scripts/_trace-transmit.ts         # all writes by table + slow queries
```

## Bonus discoveries from 2026-04-27 deep mine

### LL views worth using from DIBS

- **`our_quote_line_5_view`** — joins k10 (sol) + k08 (NSN) + k34/k35 (our bid + qty/price/lead) + k33 (`t_stat_k33`) + kc4 (award if any). Single-row "everything about a quote we made" pull. Could simplify several existing DIBS queries.
- **`our_quote_line_1..7_view`** — sibling views, likely earlier shapes / different join scopes. Worth probing if 5 doesn't have the field you need.
- **`clin_basic_2_view`** — joins k79 (contract header) + k80 (release) + k81 (CLIN award detail) + k71 (line) + k08 (NSN) + k06 + k12 + k31 + k13. Full **award-side** CLIN view. Useful for award reconciliation. Slow (>2s per query) — cache or paginate.
- **`sally_credential_1_view`** — k14 + kah_tab joined for Sally Credentials. Reveals Sally creds for every user as cleartext XML. Useful only if you want sally_login dynamically.
- **`credential_control_1_view`** — kdf + kdg auth metadata (system, type, refresh cycle, athxml). For ERG ajoseph: `athsys='Sally'`, `athtyp='quote_web_rfqs'`, lifecycle 'refresh' every 24h. **`athxml_kdg` is empty** for ERG — confirmed api_key/api_secret are NOT in this view either.

### sally_password is NOT api_secret

`sally_password` from kah_tab is a **4-digit PIN** (e.g. `8137` for ajoseph) used for LL's desktop UI auth. The Sally REST API uses **api_secret** (14-char string with symbols, e.g. `6i^,j5F29jQxCF`) which is **different** and lives only in LLPro.ini-style files on disk. Don't conflate.

So `credentialsFromKahTab()` (added today) only gives us fresh `sally_login` — for the password-half (`api_secret`) we still need the .env or filesystem capture.

### Server-side write picture (NYEVRVTC001 daemon)

Heavy hitters from the daemon:
- `UPDATE kc4_tab` (133 hits) — incoming awards being updated
- `INSERT k20_tab` (78) — log/audit of operations
- `UPDATE k81_tab` (7), `INSERT k81_tab` (2) — actual award rows being added/updated
- `INSERT k83_tab/k84_tab/k85_tab/k86_tab` — the award chain extends past k81 (see below)
- `DELETE k15_tab` (5) — daemon tidies up temp data

### k83–k86: the contract-fulfillment chain (probed 2026-04-27)

The award chain after k81 covers DLA's delivery/receiving tracking:

```
k79_tab (contract header)
  ├── k83_tab — contract status events (smedes_k83="EDI contract received", etc.)
  │             links: idnk79_k83, idnk82_k83
  │
  └── k84_tab — per-contract-line shipping subtotals
                links: idnk79_k84, idnk71_k84
                fields: sop_um_k84, qfactr_k84, plus quantity counters
                  (cnq, mkq, rnq, roq, snq, slq, srq, soq)_01_k84
        │
        └── k85_tab — CLIN delivery commitment per line
                      links: idnk81_k85 (the awarded CLIN), idnk84_k85
                      fields: dlydte_k85 (delivery date), rsvqty_k85, rsoqty_k85,
                              + same quantity counter family
              │
              └── k86_tab — actual receipt events
                            links: idnk85_k86, idnk87_k86, idnk83_k86
                            fields: cnq_01_k86 (received qty), dlydte_k86
```

**DIBS does NOT currently sync these.** We get receiving signals through other paths
(`ll_edi_transmissions`, AX `CustTransactions`). Marginal value to add a full sync.

**When this chain matters**: if a DLA award arrives but we can't tell from existing
DIBS data whether DLA has actually received the shipment, the answer is in k86.
Probe via `clin_basic_2_view` (which joins this chain) or write targeted JOIN
queries against k81 → k85 → k86 by award ID.

### COOKIE-side write picture (Abe's interactive use)

- `INSERT k20_tab` (64) — logged audit on every UI action
- `INSERT kch_tab` (44) — TBD (per-action history?)
- `UPDATE kc4_tab` (44) — Abe is processing/marking awards via LL UI
- `UPDATE d04_tab` (42) — d-prefix possibly drawing/document table

### t_stat_k33='sent' transitions (the actual transmit marker)

**Zero seen in 5000-event sample.** Means Abe drafted bids today but hasn't clicked Post yet — he's accumulating them. The transmit pattern only fires when LL's HTTP call to Sally completes. Trace will catch it when he Posts.

### Slow queries to avoid hot-pathing

- `clin_basic_2_view` — 2+ seconds per call. Cache or precompute.
- `our_quote_line_5_view` — 600–900ms. OK for ad-hoc, paginate for bulk.

