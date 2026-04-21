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

## The sequential-counter gotcha

**This is the subtle one that bit us. Read this before writing anything.**

The LamLinks Windows client does **NOT** re-read `MAX(idnk34_k34)+1` at save time. It maintains its own client-side counter, seeded from `MAX+1` once (probably on session start or form open) and incrementing by 1 for every save — regardless of what's in the DB.

Evidence from 2026-04-21:
- Abe's first line on envelope 46853: `idnk34 = 495731`. DB `MAX` at that moment was 495751 (our orphaned row from an earlier test). His client used 495731, not `MAX+1`.
- Abe's second line on envelope 46853: `idnk34 = 495732`. DB `MAX` at that moment was 495752 (our second write-back). His client used 495731+1, not `MAX+1`.

**Implications:**

- If we insert at `MAX+1` while Abe is mid-session, his counter will eventually hit our id. Collision = `Violation of PRIMARY KEY constraint` on his next Save. The LamLinks UI reports this as a generic "Connectivity error" — you'll waste 20 minutes chasing networking before you find the real cause.
- If we insert at `MAX+N` (e.g. +20), Abe can save ~N lines in that envelope before catching us. Envelopes are usually 5-15 lines, so 20-30 is workable but not bulletproof.
- If Abe **posts and starts a new envelope**, the counter likely re-seeds (unverified but consistent with observed behavior — first line of 46853 came from a fresh MAX read after 46852 posted).
- `delete + reinsert` is a trap: delete frees the id, Abe's counter is still pointing at it, your re-insert grabs it back, Abe's next save collides. We hit this exact sequence once.

**Recommended protocol for DIBS write-back while Abe is active:**

1. Check that the target envelope is in `'adding quotes'` staging state.
2. Pick `idnk34` = **`MAX + 30`** (or larger). Not `MAX + 1`.
3. Warn Abe: *"Don't open another Add-line form until I'm done."* Parallel reservations overlap.
4. Insert inside a transaction with `TABLOCKX+HOLDLOCK` on k34/k35 and `UPDLOCK+HOLDLOCK` on k33. Re-verify envelope state inside the transaction.
5. Bump `itmcnt_k33` and `uptime_k33` on the envelope in the same transaction.
6. Verify `rowsAffected === 1` on every statement.

**Recovery if a collision happens:** use `scripts/move-our-ids-up.ts` pattern — copy our row to a much higher id (INSERT new, DELETE old) to free the id Abe's counter wants. Abe retries Save. Envelope itmcnt stays consistent if the move preserves the line count.

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
                            │     │     TABLOCKX k34 + k35 (pick MAX+30 id)
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

**Why MAX+30 ids?** LamLinks' Windows client maintains a sequential counter and doesn't re-read `MAX` at save time. Using `MAX+1` while Abe is actively saving leads to PK collisions after his counter catches up. A 30-id cushion keeps us safely ahead of any reasonable envelope line count.

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
