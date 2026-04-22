# LamLinks Counter Collision — Incident Retrospective 2026-04-21

> **POSTSCRIPT (added same day):** Yosef correctly hypothesised that LamLinks uses a shared SQL sequence table. After deeper scanning we found it — **`kdy_tab`**, one row per id-type, `idnval_kdy` column holding the last-assigned id. LamLinks' client does atomic `UPDATE kdy_tab SET idnval_kdy += 1` for every insert. **Neither a client-side counter nor Procmon is needed.** The durable fix is simply: DIBS allocates new idnk34/idnk35 through the same `kdy_tab` UPDATE protocol. See the "How we actually fixed it" section at the bottom and `docs/lamlinks-writeback.md` for the current pattern. The "plan forward" sections below describing Procmon installation are obsolete — kept for historical context only.

**Outcome:** Two DIBS-generated bids successfully transmitted to DLA for the first time. A follow-on collision between DIBS-inserted rows and Abe's LamLinks client counter blocked his saves mid-day. We initially misidentified the cause (we thought it was a client-side counter on Abe's PC) and "fixed" it by relocating posted rows to historical PK gaps. Later the same day we found the actual mechanism — a shared SQL sequence table `kdy_tab` — and converted the write-back to use it, eliminating the collision class entirely.

## What we were trying to do

First live test of DIBS → LamLinks → DLA bid write-back. Flow:
1. DIBS runs `scripts/append-bid-test.ts` on an approved Quoted bid
2. Script piggybacks a new k34+k35 line under Abe's existing staged envelope (his "adding quotes" k33 row)
3. Abe sees the line appear in his LamLinks UI, reviews it, clicks Post
4. LamLinks fires the EDI; DLA ACKs; DIBS reconciler flips `bid_decisions.status` to `submitted`

**We wanted to prove**: our inserted row is byte-identical to what Abe's own saves look like, and that Abe can continue working normally after DIBS injects a line.

## What we got right

- ✅ **Discovered the staging mechanism.** Earlier exploration concluded (wrongly) that "saved but not posted" lived in a separate table. It doesn't — the same `k33/k34/k35` rows carry staging vs posted state via four `char(16)` status strings on `k33_tab`. See `docs/lamlinks-writeback.md` for the values.
- ✅ **Two bids transmitted to DLA.** SPE2DP-26-T-2975 @ $46.45 (envelope 46852, Abe Posted at 16:13:55) and SPE2DS-26-T-9795 @ $24 (envelope 46853, Posted 16:28:31). Both flipped from `"adding quotes"/"not sent"` → `"quotes added"/"sent"` when Abe clicked Post. End-to-end proved.
- ✅ **The reconciler works.** `scripts/sync-dibs-status.ts` matched the posted k34 rows back to DIBS `bid_decisions` via `solicitation_number` + `k33.t_stat_k33='sent'` and flipped both rows to `submitted`.

## What went wrong

**The collision.** Abe's LamLinks client maintains its own **sequential, persistent, client-side counter** for `idnk34_k34` (and correspondingly `idnk35_k35`). On each save, the client increments its counter and writes the row. It does NOT re-read `MAX(idnk34_k34)` at save time. Evidence:

- At 16:17, Abe started envelope 46853 and saved his first line at `idnk34=495731`. DB MAX at that moment was 495751 (a DIBS orphan from envelope 46852). Client used **495731, not MAX+1**.
- At 16:28, he saved his second line at `idnk34=495732`. DB MAX was now 495752. Client used **his-last-save + 1**, still not MAX+1.

So we had TWO DIBS orphans (495751, 495752) sitting ABOVE Abe's counter. Hours later, he had saved ~18 more lines in new envelopes (46854, 46855). His counter climbed 495733 → 495749. His next save was going to try 495750 (free), then 495751 → **duplicate-key violation with our orphan**.

**The error LamLinks surfaced** wasn't "duplicate key" — it was the generic `"Commit add- commit_k34-1526 Connectivity error: [Microsoft][ODBC SQL Server Driver][SQL Server]Violation of PRIMARY KEY constraint 'k34_tab_idnk34_k34'. Cannot insert duplicate key in object 'dbo.k34_tab'. The duplicate key value is (495751)."` The "Connectivity error" prefix is misleading — it's a PK constraint violation, not a network issue.

**Close + reopen LamLinks did NOT reset the counter.** It's persisted somewhere on Abe's workstation (a Foxpro/VFP `.dbf` or `.ini` or registry key — we haven't located it yet).

## The false-lesson we nearly learned

After the first collision earlier in the day, we "fixed" it by running `scripts/move-our-ids-up.ts` which bumped our orphan from 495731 to 495751 with a +20 id gap. Then for our second DIBS insert into envelope 46853, we used MAX+1 again — which landed at 495752 — and Abe's subsequent save worked cleanly.

This looked like proof that "MAX+1 is safe." It wasn't. The move we'd done earlier left a 21-id cushion between Abe's counter and our row, and the second test envelope posted after only 2 of Abe's saves — well before his counter could catch up. If he'd kept saving without posting, he'd have collided sooner.

**The real lesson**: with a sequential client counter, ANY orphan we leave above it is a delayed collision. MAX+1, MAX+20, MAX+500 all just change the time-to-collision.

## The fix we ran

Moved both posted DIBS orphans **down** into historical k34 PK gaps that predate Abe's tenure:

| Row | Old PK | New PK |
|---|---|---|
| k34 (env 46852, SPE2DP-26-T-2975) | 495751 | **123621** |
| k34 (env 46853, SPE2DS-26-T-9795) | 495752 | **123622** |
| k35 (price for 46852) | 503388 | **503380** |
| k35 (price for 46853) | 503389 | **503144** |

`scripts/move-posted-orphans.ts` did all 4 moves in a single transaction with TABLOCKX+HOLDLOCK. Preflight verified:

- Source rows existed
- Target ids were free (the 123621..123720 range has been empty for 15+ years)
- `k35.idnk34_k35` FK was updated to point at the new k34 ids

Post-move audit (`scripts/audit-idnk34-refs.ts`) confirmed safety:
- Only 3 base tables ever reference `idnk34_*`: `k34_tab` (source), `k35_tab` (child — we updated), `k63_tab` (0 matching rows, old or new).
- Zero stored procedures reference `idnk34`.
- 25 views reference it — but views are computed at read time, no cached refs.
- `k81_tab` (awards) has no `idnk34_*` column at all. Awards link via `idnk80_k81` → `piidno_k80` (contract number). So the move is award-flow-safe — when DLA returns an award for these sols, the match happens by `qotref_k33` + `idnk11_k34` (both unchanged), not by the renumbered PK.

Stale-reference housekeeping: `bid_decisions.comment` strings that said "Transmitted via LamLinks k34=495751" were updated to reference the new 123621/123622 ids.

## What we still don't know

1. **Where LamLinks stores its client counter.** Persists across app restart, so it's on disk. Likely a VFP `.dbf` in `C:\LAMLINKP\LLPclint\data\` on Abe's workstation, or an entry in `HKCU\Software\LAMLINKS\`. Not in the shared llk_db1 SQL DB (exhaustively searched).
2. **Whether LamLinks' client auto-walks past collisions.** If it does, inserting a dummy at Abe's next id would bump him past our orphans. If it doesn't (looks more likely from today's behavior), he stays wedged until manual intervention.
3. **Whether envelope posting ever resets the counter.** Evidence today is mixed — his counter did NOT reset after each envelope posted (it kept going: 495732 → 495737 → 495742 → ...). But there were small jumps we can't fully explain without seeing the client code.
4. **Whether there's a server-side counter file or SQL trigger we missed.** Unlikely given the audit, but LamLinks has 217 tables and we only inspected heavily-referenced ones.

**Yosef is ERG's admin, not LamLinks' admin.** He has no privileged visibility into the LamLinks Foxpro client source. The vendor (LamLinks Inc.) would have answers, but engaging them for a question like this is expensive and slow — weeks of turnaround, possibly fees. We're effectively on our own for LamLinks client internals.

## Plan forward

### Immediate (done today)
- ✅ Moved orphans into historical gaps; Abe's path is clear
- ✅ Updated DIBS comments to reference new PKs
- ✅ Toggle in DIBS `/settings/lamlinks-writeback` remains OFF by default — no new DIBS writes will happen until we flip it

### Phase 1 — Observability (highest priority)
**Install Process Monitor (Sysinternals Procmon) on Abe's workstation.** Justification:

- **Immediate value**: when Abe saves a bid in LamLinks, Procmon captures every file read, file write, and registry operation. The counter storage reveals itself within one save cycle — it's whatever file/key gets a `WriteFile` with an integer increment pattern.
- **Medium-term value**: future LamLinks-touching investigations (invoice-post flow, k33 transmission state machine, EDI file-drop location, shipping-sync internals) all benefit from "watch what the client actually does." Today we're reverse-engineering from the SQL side only — half the picture.
- **Low overhead**: Procmon runs as a background filter, captures just LamLinks.exe events, writes to a small ring buffer. Zero impact on Abe's daily work.
- **Free and supported**: Microsoft Sysinternals, official tool.

Setup steps (estimated 20 min):
1. Download Procmon from sysinternals.com (or copy from ssokol's dev box)
2. On Abe's PC: launch, filter by `Process Name is LamLinksPro.exe` (or whatever the exe is called)
3. Have Abe save one bid; capture the trace
4. Review — identify: counter file location, what gets read/written during a save, where preferences live, temp file patterns

Once we have the counter file location, we can write a small TSX helper that reads/writes that file to **reset Abe's counter to MAX+1 whenever it drifts into a DIBS orphan's path**. Run from the reconciler. Permanent fix without any more PK surgery.

### Phase 2 — Durable write-back pattern
With the counter under our control, the long-term DIBS write-back flow becomes:

1. Abe reviews + approves bids in DIBS; clicks batch Submit
2. DIBS queues writes into `lamlinks_write_queue`
3. Windows worker (daemon) pops queue rows, finds a staged envelope, inserts k34+k35 at **MAX+1** (no artificial gap needed)
4. If Abe had LamLinks open, the worker **also resets his counter file** past our row before releasing the save lock
5. Abe posts normally; reconciler flips DIBS status

No orphans. No collisions. No PK surgery.

### Phase 3 — Optional improvements
- **Yosef conversation**: even though he doesn't admin LamLinks vendor-side, he understands ERG's workflows deeply. Walk him through the write-back toggle + counter-reset pattern, get his sign-off before flipping LIVE for everyday use.
- **Ask LamLinks vendor** (if cheap): confirm whether they'll add a server-side "allocate next id" API endpoint that DIBS could call before inserting. That'd make the counter-reset hack unnecessary. Worth a one-email ask; unlikely but low-cost.
- **Auto-delete-after-post mode**: alternative to counter-reset — once a DIBS-inserted bid posts successfully, DELETE the k34/k35 rows. LamLinks' local "Posted Quotes" view loses the line but the bid already made it out via EDI. Cleaner than gap-packing. Could coexist with counter-reset as a fallback when counter-reset fails.

## Files committed today

- `docs/lamlinks-writeback.md` — technical reference (staging state machine, piggyback pattern, sequential-counter gotcha)
- `docs/lamlinks-collision-2026-04-21.md` — this retrospective
- `scripts/append-bid-test.ts`, `append-bid-test2.ts` — canonical reference for the piggyback insert
- `scripts/move-posted-orphans.ts` — emergency PK-move helper (use only when absolutely needed)
- `scripts/sync-dibs-status.ts` — reconciler
- `scripts/lamlinks-writeback-worker.ts` — Windows daemon that drains `lamlinks_write_queue`
- `scripts/audit-idnk34-refs.ts` — proves the move was reference-safe
- `/settings/lamlinks-writeback` UI — toggle + queue stats
- `system_settings` + `lamlinks_write_queue` Supabase tables
- 2 new Windows scheduled tasks in `scripts/windows/install-tasks.bat`: the worker daemon (at logon, `--loop`) and the status reconciler (every 15 min)

## How we actually fixed it (added same day)

After Yosef pushed back with "99% sure there's a SQL table managing line numbers," we did a wider scan and found **`kdy_tab`**:

```
idnkdy | idnnam    | tabnam  | idnval  | uptime
-------|-----------|---------|---------|---------------------
34     | idnk34    | k34_tab | 495782  | 2026-04-21T17:54:42
35     | idnk35    | k35_tab | 503420  | 2026-04-21T17:54:42
33     | idnk33    | k33_tab | 46858   | 2026-04-21T17:48:00
11     | idnk11    | k11_tab | 2236646 | 2026-04-21T10:40:23
...(one row for every sequenced table in the DB, ~60 rows total)
```

Verified `idnval_kdy = MAX(<pk>)` exactly across every sequenced table — confirming `idnval` is "last id assigned" (not "next to assign"). LamLinks' insert protocol is:

```sql
DECLARE @newId INT;
UPDATE kdy_tab SET idnval_kdy = idnval_kdy + 1, @newId = idnval_kdy + 1
WHERE tabnam_kdy = 'k34_tab';
INSERT INTO k34_tab (idnk34_k34, ...) VALUES (@newId, ...);
```

Row-level locks on `kdy_tab` serialise concurrent clients. We rewrote `scripts/lamlinks-writeback-worker.ts` and `scripts/append-bid-test*.ts` to use this exact protocol. From this point forward, DIBS inserts are indistinguishable from LamLinks' own client inserts from the perspective of the id allocator — no orphans, no collisions, ever.

## What was true retrospectively

- Our `MAX+N` inserts on 2026-04-21 morning left `kdy.idnval` behind actual `MAX` in `k34_tab` / `k35_tab`. Abe's subsequent saves advanced `kdy` through the stale range until his client's next-allocated id landed on our orphan → PK collision → "Connectivity error" in LamLinks UI.
- The apparent "sequential-from-last-save" pattern we observed earlier was a statistical illusion. When only one user is saving, `kdy` advances by exactly 1 per save, so it *looks* like a per-user client counter. Multi-user save patterns (which we didn't observe in our narrow window) would've exposed the shared nature of `kdy` immediately.
- Moving the 2 orphans down into PK gaps was **not necessary** in hindsight. The right fix at the moment of the collision was: `UPDATE kdy_tab SET idnval_kdy = (SELECT MAX(idnk34_k34) FROM k34_tab) WHERE tabnam_kdy = 'k34_tab'` — bring the sequence back to reality. Abe's client would then allocate safely past our orphan on its next save. The move worked, but was more invasive than needed.

## Takeaway

First live DIBS → LamLinks → DLA bids transmitted, plus we mapped the actual id-allocation mechanism. The production-safe pattern is in `docs/lamlinks-writeback.md`. Neither Procmon nor Yosef-dependent client-patching is needed.

**Credit where due:** Yosef's hunch that a SQL sequence table existed was correct. An earlier narrower search missed `kdy_tab` because the `idnval_kdy` column name doesn't contain "next" or "seq" — it's named "id value." Including ranges like `495753..496000` (just above current MAX) in a value-based scan was what surfaced it. Lesson: when hunting for a sequence table by introspection, probe values near the current MAX in addition to searching column names.
