# LamLinks Bid Write-Back

How DIBS inserts bids into LamLinks so they transmit to DLA under our CAGE, without requiring Abe to retype anything. **This page exists because what we tried first didn't work, and the lessons aren't obvious from reading the schema.**

First successful end-to-end transmission: **2026-04-21**. Two bids went to DLA via this path in the first session — SPE2DP-26-T-2975 @ $46.45 (envelope 46852) and SPE2DS-26-T-9795 @ $24 (envelope 46853).

## The staging table is k33/k34/k35 itself

Our first theory was wrong. We searched all 217 tables in `llk_db1` looking for a draft/pending/staging table that holds bids between **Save** and **Post**. There isn't one. The staging lives inside `k33/k34/k35` with different values in four status columns on `k33_tab`.

| Column (`k33_tab`, all `char(16)`) | Staging (saved, not posted) | Posted (EDI sent) |
|---|---|---|
| `o_stat_k33` | `"adding quotes   "` | `"quotes added    "` |
| `t_stat_k33` | `"not sent        "` | `"sent            "` |
| `a_stat_k33` | `"not acknowledged"` | `"acknowledged    "` |
| `s_stat_k33` | `"adding quotes   "` | `"quotes added    "` |

The LamLinks Windows client rewrites those four strings and fires the EDI transmission when Abe clicks Post. There are **no triggers** on k33/k34/k35 — inserting directly with posted-state strings would mark the bid "sent" in LamLinks without DLA actually receiving anything. Always insert with staging values; let Abe post.

**Do not insert into `kd0`/`kd8`/`kda`/`kdb`.** Those have the same visual shape as `k33/k34/k35` but they're the vendor-RFQ staging (commercial quote requests *we send* to suppliers), not DLA bid submission.

## The piggyback pattern

Don't create a new `k33_tab` envelope from scratch. `k34_tab` has 74 columns including a `gennte_k34` XML blob whose `<ver_no>` tag changes with LamLinks releases, and a `qtek14_k34` pointer into `k14_tab` (buyer/config code) we don't know how to populate correctly. Hardcoding any of these is brittle and silently breaks on the next LamLinks release.

Instead, append a line under Abe's **existing** staged envelope (any `k33_tab` row with `o_stat = 'adding quotes'`):

1. Pick a **template k34 row** already in the envelope (Abe just saved it; all 74 columns are known-good and current).
2. `INSERT INTO k34_tab ... SELECT ...` that template row, overriding only 7 fields:
   - `idnk34_k34` (new locked MAX+1)
   - `uptime_k34` = `GETDATE()`
   - `idnk11_k34` (target solicitation line)
   - `idnk33_k34` (same envelope as template)
   - `pn_k34` (manufacturer part number, `char(32)`)
   - `mcage_k34` (manufacturer CAGE, `char(5)`)
   - `qty_ui_k34` (unit of issue, `char(2)`)
   - `solqty_k34` (sol's quantity)
3. `INSERT INTO k35_tab` with price row: new `idnk35_k35`, `idnk34_k35` = new k34 id, `qty_k35`, `up_k35`, `daro_k35`, `clin_k35 = '      '`.
4. **Bump the envelope counters** in the same transaction: `UPDATE k33_tab SET itmcnt_k33 = itmcnt_k33 + 1, uptime_k33 = GETDATE() WHERE idnk33_k33 = <envelope>`. If you skip this, LamLinks' UI may show the wrong item count and the Post may silently drop the uncounted line.

Canonical reference: `scripts/append-bid-test2.ts`. That script, run with `--execute`, inserts a line in under 100 ms inside a transaction with `TABLOCKX`+`HOLDLOCK` on k34/k35 and `UPDLOCK`+`HOLDLOCK` on k33.

**Fresh-envelope mode (no seed-bid needed):** `scripts/lamlinks-writeback-worker.ts` also supports minting a brand-new `k33_tab` envelope when none is staged. Uses `kdy_tab` to allocate the new idnk33, writes all 13 k33 fields with the staging-state strings, and picks the most recent k34 row under `upname='ajoseph'` as the template for subsequent line inserts. Abe does NOT need to save a dummy bid in LamLinks first — DIBS can initiate an envelope on its own and populate it, then Abe opens LamLinks, sees a ready-to-review envelope, and Posts.

## Incident 2026-04-23: "Update conflict in cursor" is UI-only

**Symptom**: Abe tried to Post envelope `0AG09-46879` (4 DIBS-written lines + 1 UI-staged) and got `Quote file 0AG09-46879: Commit update- commit_k33-NNNN Update conflict in cursor '_9999XXX'` repeatedly over ~1 hour, even after full LL restarts.

**What actually happened**: the EDI transmission succeeded anyway. DLA sent an ack email at 12:51 PM confirming all 5 bids received (as superseded/accepted pairs — LL's internal retry fired 6 seconds after each cursor error). Our `lamlinks_write_queue` audit showed only 4 `done` rows with no retries — the duplicate came from LL's own retry, not us.

**Diagnosis**: the cursor error is LL's desktop UI failing its local bookkeeping update (optimistic cursor on k33_tab row-version). It does NOT prevent the EDI transmit daemon from shipping the envelope. Don't confuse the two code paths.

**Recovery protocol** when this error shows up:

1. Wait ~1 minute. Don't panic, don't nuke.
2. Check DLA-side: ack email or the DIBBS award tab for that sol.
3. **If DLA has the quote** → run `scripts/ll-mark-envelope-sent.ts <idnk33> --yes` to flip `t_stat_k33='sent'` + `a_stat_k33='acknowledged'` so LL's UI stops showing the envelope as stuck.
4. **If DLA does NOT have it after 5+ minutes** → only then consider destructive options: `ll-retire-envelope.ts`, `ll-extract-to-temp.ts`, or `ll-nuke-envelope.ts` (last resort, loses bids).
5. Never delete k34/k35 rows pre-emptively — the transmission may still be in flight.

### Incident-response script suite

All gated with `--yes`; all refuse to touch envelopes where `t_stat_k33='sent'` (real post, don't modify):

- `scripts/inspect-ll-envelope.ts <idnk33|qotref>` — dump envelope + k34/k35 + lock view
- `scripts/ll-list-my-envelopes.ts [user] [--staging]` — find recent envelopes by upname
- `scripts/ll-k33-status-values.ts` — show all distinct k33 status values (only `adding quotes` / `quotes added` — no canceled)
- `scripts/ll-mark-envelope-sent.ts <idnk33>` — reconcile LL state after a confirmed DLA ack
- `scripts/ll-retire-envelope.ts <idnk33>` — flip to `quotes added` (stops UI piggyback)
- `scripts/ll-remove-k34-line.ts <k34_id>` — surgical single-line delete
- `scripts/ll-extract-to-temp.ts <k33_id>` — park k34s + delete stuck k33
- `scripts/ll-move-k34-lines.ts --from X --to Y --k34 a,b,c` — transplant lines between envelopes
- `scripts/ll-nuke-envelope.ts <idnk33>` — full delete, LAST RESORT

## The id-allocation protocol: `kdy_tab`

LamLinks uses a classic **server-side sequence table** called `kdy_tab`. One row per id-type (one for every k-series and some kc/ka-series tables). The row has:

| column | meaning |
|---|---|
| `tabnam_kdy` | target table name (`'k34_tab'`, `'k35_tab'`, `'k33_tab'`, `'k11_tab'`, etc.) |
| `idnval_kdy` | the LAST id assigned — tracks `MAX(<pk>)` for the target table |
| `uptime_kdy` | last modified |

**LamLinks client insert protocol** (inferred from `kdy.idnval` exactly equalling `MAX(id)` across every sequenced table):

1. Atomically `UPDATE kdy_tab SET idnval_kdy = idnval_kdy + 1` on the row matching the target table; capture the post-increment value.
2. `INSERT INTO <table> VALUES (<new id>, ...)`.
3. Commit. Row-level locks on `kdy_tab` serialise concurrent clients.

### DIBS write-back: always allocate through `kdy_tab`

```sql
DECLARE @newId INT;
UPDATE kdy_tab WITH (ROWLOCK, HOLDLOCK)
SET idnval_kdy = idnval_kdy + 1, @newId = idnval_kdy + 1
WHERE tabnam_kdy = 'k34_tab';
-- @newId is the id to use for our INSERT
INSERT INTO k34_tab (idnk34_k34, ...) VALUES (@newId, ...);
```

The UPDATE takes a row lock on the `kdy` row for the transaction's lifetime. If Abe's LamLinks client is mid-save and tries to read the same sequence, it waits until we commit and gets the next value. **No collisions possible** — we become a well-behaved participant in the same protocol his client already uses.

### Why `MAX+1` / `MAX+N` appeared to work and then broke

Before we found `kdy_tab` (morning of 2026-04-21), we theorised LamLinks' client had a per-session, client-side sequential counter because Abe's saves looked like `his-last + 1`. That was a statistical artifact — when only Abe is saving, the `kdy` sequence advancing 1-per-save looks exactly like a per-user counter.

The actual failure mode of `MAX+N` inserts: they don't update `kdy.idnval`, so the sequence falls behind `MAX`. Eventually Abe's client reads a `kdy.idnval + 1` that's already taken by our row → **PK collision, reported as a generic "Connectivity error" in the LamLinks UI.** That's what blocked Abe on 2026-04-21 afternoon.

The old `scripts/move-our-ids-up.ts` "emergency fix" was cargo-culted from the wrong model. Don't use it. If you see it referenced anywhere, replace with the `kdy_tab` protocol above. Full retrospective of the wrong turn in [lamlinks-collision-2026-04-21.md](./lamlinks-collision-2026-04-21.md).

### Recovery if orphans exist from old MAX+N inserts

Bring `kdy` up to current MAX for the affected table:

```sql
UPDATE kdy_tab
SET idnval_kdy = (SELECT MAX(idnk34_k34) FROM k34_tab)
WHERE tabnam_kdy = 'k34_tab';

UPDATE kdy_tab
SET idnval_kdy = (SELECT MAX(idnk35_k35) FROM k35_tab)
WHERE tabnam_kdy = 'k35_tab';
```

Abe's next saves will allocate safely past any orphan. No surgery on posted rows required.

## The live write-back pipeline (as of 2026-04-21)

```
 /solicitations UI (Quoted tab, Submit button)
        │
        ▼
 POST /api/bids/submit-batch
        │
        ├─ UPDATE bid_decisions SET status='submitted'   (always — local-only truth)
        └─ IF system_settings.lamlinks_writeback_enabled='true':
              INSERT INTO lamlinks_write_queue (one row per submitted bid)
                            │
                            ▼
              Windows Task Scheduler (NYEVRVSQL001, every 1 min, 6am-8pm weekdays)
                            │
                            ▼
              scripts/lamlinks-writeback-worker.ts
                            │
                            ├─ Loads env + Supabase
                            ├─ Checks toggle (early exit if OFF)
                            ├─ SELECT pending queue rows, LIMIT 10
                            ├─ Finds staged envelope on LamLinks (o_stat='adding quotes')
                            │   └─ If no envelope: mark as waiting, retry next poll
                            ├─ For each queue row:
                            │     ├─ Claim (UPDATE status='processing' WHERE status='pending')
                            │     ├─ Resolve sol/NIIN → idnk11 + k08 part/cage
                            │     ├─ TRANSACTION:
                            │     │     UPDLOCK k33 envelope (verify still staged)
                            │     │     UPDATE kdy_tab for 'k34_tab' → new idnk34
                            │     │     UPDATE kdy_tab for 'k35_tab' → new idnk35
                            │     │     INSERT k34 (clone from template) + INSERT k35 + UPDATE itmcnt
                            │     ├─ Mark queue row as done with k33/k34/k35 ids
                            │     └─ On any exception: mark as failed + error_message
                            └─ Close pool
                            │
                            ▼
              Abe sees the new line in LamLinks envelope. Reviews. Clicks Post.
                            │
                            ▼
              scripts/sync-dibs-status.ts (Windows Task, every 15 min)
                            └─ For each bid_decisions in 'submitted' state, checks
                               LamLinks k33.t_stat_k33 — once it's 'sent', writes
                               a "Transmitted via LamLinks k34=<id>" comment.
                               (Status stays 'submitted' either way.)
```

**Feature flag:** `system_settings.lamlinks_writeback_enabled` (`true` / `false`). Default `false`. Toggle via `/settings/lamlinks-writeback`. When off, the API route skips the enqueue step and DIBS is back to local-only bookkeeping — no rows enter `lamlinks_write_queue`, the worker finds nothing to do.

**Why a queue and not a direct write?** The API route runs on Railway (Linux) which can't compile `msnodesqlv8`. The only host with LamLinks SQL access is `NYEVRVSQL001`. The queue decouples the two — Railway writes intent, Windows worker executes.

**How we pick the new idnk34/idnk35?** Atomically via `UPDATE kdy_tab SET idnval_kdy += 1 WHERE tabnam_kdy = 'k34_tab'`. Row-lock on `kdy_tab` serialises us against Abe's own client. See the "id-allocation protocol" section above for why `MAX+N` was the wrong approach.

## Post-transmission reconciliation

When Abe clicks Post, LamLinks flips the four status strings on `k33_tab` from staging values to posted values and fires the EDI. DIBS doesn't know this happened unless we check. The reconciler:

- `scripts/sync-dibs-status.ts` finds all `bid_decisions` rows in `status='quoted'` and checks `k34_tab` (joined through `k11 → k10`) for a matching `sol_no_k10` on an envelope with `t_stat_k33 LIKE 'sent%'` within the last 24h. If matched, flip DIBS to `status='submitted'` with a `Transmitted via LamLinks k34=<id>` comment.
- Runs on-demand today. Should become a cron (every ~15 min) once we move beyond one-off test writes — it handles the case where Abe typed directly in LamLinks, not just our write-backs.

## NIIN format quirk

`k08_tab.niin_k08` stores NIINs **with dashes**: `"01-578-7887"`, not `"015787887"`. DIBS stores NSN as `"6509-01-578-7887"` (FSC-NIIN with dashes in NIIN). Every lookup must use the dashed form. We burned 10 minutes on this the first test.

## Why we don't just mint a new envelope from scratch

We could. It's what "pure" DIBS write-back would look like — Abe doesn't need to save a dummy line first. But until we've transmitted ~5-10 bids via the piggyback path and know every field in `k34_tab` is safe to own, fresh-envelope mode carries these risks:

1. `gennte_k34` XML blob: `<ver_no>1.902</ver_no>` bumps with LamLinks releases. Stale value → malformed EDI or rejected bid.
2. `qtek14_k34` (= 3 in every observed row): pointer to `k14_tab` buyer/config code. Unknown semantics. Wrong value → EDI routes wrong.
3. Demographics (company name, tax ID, address, size status): can drift if Abe updates them in LamLinks. Piggyback uses whatever the last-saved row used. Fresh-envelope requires hardcoded values that can rot.
4. Error recovery: piggyback failure = one bad line Abe deletes in the UI. Fresh-envelope failure = a phantom envelope header Abe now has to clean up, plus a possibly-malformed bid already sent to DLA.

Graduation to fresh-envelope mode requires: 5+ successful piggyback transmissions, then a test where we build a new `k33_tab` row by cloning all fields from the most recent posted envelope (with new id, timestamps, status strings).

## Audit checklist for any write-back script

Before running `--execute` on a new write-back:

- [ ] Envelope is in `'adding quotes'` state (not already posted)
- [ ] Template k34 row still exists and is under the target envelope
- [ ] Target sol/NIIN resolves to a real `k11` row (check `k10.sol_no_k10` and `k08.niin_k08` with dashes)
- [ ] Chosen `idnk34` is `MAX + 30` or more
- [ ] `TABLOCKX+HOLDLOCK` on k34 and k35 inside the transaction
- [ ] `UPDLOCK+HOLDLOCK` on k33 with envelope-state re-verification inside the transaction
- [ ] `itmcnt_k33 + 1` and `uptime_k33 = GETDATE()` in the same transaction
- [ ] `rowsAffected === 1` check on every INSERT/UPDATE
- [ ] Dry-run mode is the default; only `--execute` performs writes
- [ ] Post-commit verification: new row visible with expected field values, envelope itmcnt matches actual line count
- [ ] After Abe posts, run `sync-dibs-status.ts --execute` to flip DIBS `bid_decisions.status` → `submitted`
