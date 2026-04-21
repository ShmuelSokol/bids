# Bidding Workflow

This is Abe's daily flow — Solicitation → Sourceable → Quoted → Submitted. Understanding this sequence is understanding DIBS.

## The five states

Every row in `dibbs_solicitations` is in exactly one of these states at any moment:

```
                   ┌──────────────┐
                   │  UNSOURCED   │  (NSN has no match in AX or Master DB)
                   └──────┬───────┘
                          │ (enrich)
                          ▼
 ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
 │   ALREADY    │◀───│  SOURCEABLE  │───▶│   QUOTED     │───▶│  SUBMITTED   │
 │     BID      │    │              │    │              │    │              │
 └──────────────┘    └──────┬───────┘    └──────────────┘    └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   SKIPPED    │  (Abe said no)
                     └──────────────┘
```

### 1. Unsourced

A new solicitation lands. NSN matching against AX ran and didn't hit. NSN matching against Master DB didn't hit either. P/N matching against PUB LOG *might* give us a partial match (shown as "Medium Match" in the UI).

**Column:** `is_sourceable = false`.
**Abe's view:** "No Source" filter. He typically ignores these unless a P/N match suggests he can find the item under a different number.

### 2. Sourceable

The NSN matched (AX first, Master DB second). Pricing ran. A suggested bid is attached.

**Columns:** `is_sourceable = true`, `suggested_price != null`, `return_by_date >= today`, `already_bid = false`, no row in `bid_decisions`.

**Abe's view:** Solicitations page, "Sourceable" tab. The default view. This is where he spends his time.

Each row shows:

- **NSN** and nomenclature
- **Qty** required
- **Our cost** (with `cost_source` provenance)
- **Suggested bid** (green if the margin is healthy)
- **Margin %** (color-coded: green ≥20%, yellow 10–19%, red < 10%)
- **AI score** (0–100 with BID/CONSIDER/SKIP tag)
- **FOB** (Origin/Destination)
- **Due date**
- **Channel badge** (LL = LamLinks, DIBBS = expansion scrape)
- **Set-aside tag** if applicable (SDVOSB, WOSB, etc.)

Clicking a row opens the detail panel with:

- **Bid form** (price, quantity override, comment)
- **Cost waterfall** — what sources we checked and which one won
- **P/N match info** if the NSN matched via part number cross-reference
- **Award history** for this NSN (last 10 awards + winners)
- **Bid history** for this NSN (last 10 bids + our wins/losses)
- **"Check DIBBS"** button — live check whether this solicitation is still open on DIBBS.

### 3. Quoted

Abe set a price (usually the suggested bid, sometimes an override). The row is staged for submission.

**Column:** Row exists in `bid_decisions` with `status = 'quoted'` and `final_price` set. Possibly a `comment` explaining the override.

**Abe's view:** "Quoted" tab. Here the UI switches mode — instead of individual actions, he gets a **batch submit** button. Select all, hit Submit, done.

### 4. Submitted

The bid has transmitted to DLA via LamLinks' EDI. DIBS `bid_decisions.status = 'submitted'` with a `comment` pointing at the `k34_tab` row (`Transmitted via LamLinks k34=<id>`).

**First real transmission: 2026-04-21.** Two DIBS-generated bids went to DLA in the same session:
- SPE2DP-26-T-2975 @ $46.45 × 2, 45d (envelope 46852, k34=495751)
- SPE2DS-26-T-9795 @ $24 × 1 EA, 35d (envelope 46853, k34=495752)

The write-back pattern (piggyback-under-staged-envelope) is documented in [lamlinks-writeback.md](./lamlinks-writeback.md). The status reconciler is `scripts/sync-dibs-status.ts` — runs on-demand today, should move to a 15-min cron.

**What's still manual in the submission path (as of 2026-04-21):**
- DIBS write-back is run by hand (`scripts/append-bid-test.ts --execute`, one sol at a time). Needs to become a UI button on the "Quoted" tab that takes the selected rows and inserts them as lines under Abe's currently-staged envelope.
- The status reconciliation sweep (`sync-dibs-status.ts`) is run by hand. Needs a cron.
- Abe still clicks Post in LamLinks. This stays manual by design — he reviews the batch visually first.

Once submitted, the row sticks around for post-game analysis. The `award_lookup` background job eventually pulls the award result (win/loss/partial) and attaches it.

### 5. Already Bid / Skipped

**Already Bid:** We've already placed a bid for this `solicitation_number` in LamLinks (via the `abe_bids` and `abe_bids_live` tables). No point showing it to Abe again.

`abe_bids_live` holds the **last 30 days** of bids for dedup purposes (was "today only" — flipped 2026-04-16 after Abe reported sols he'd bid on Monday still appearing as Sourceable on Wednesday). The view tables (`/bids/today`, dashboard "Bids Today" panel) still filter to today for display — they're display filters, not dedup filters. See `docs/gotchas.md` → "abe_bids_live window — today vs 30d".

**Skipped:** Abe actively decided "don't bid." Stored in `bid_decisions` with `status = 'skipped'` plus a comment.

Both states keep the row out of the active Sourceable list. Abe can still find them under the "Bid in LL" and "Skipped" filter tabs respectively.

## Abe's daily flow, step by step

### Morning (8:00 AM)

1. **Open the Dashboard.** See "Total Open Bid Potential" in the green card at the top.
2. **Click Sync Data.** This triggers:
   - `/api/dibbs/scrape-now` (if the 6am cron didn't run or missed)
   - `/api/dibbs/enrich` (NSN matching + pricing on anything new)
   - Abe's LamLinks live bids sync (local script)
3. **Check Abe's Bids Today** — if he already placed bids via LamLinks this morning, they're shown with time, NSN, price, qty.

### Review (8:30 AM – 11:00 AM)

4. **Click "Sourceable"** to open the working list.
5. **Skim the sorted table.** Default sort is by AI score descending. Top 20 are usually the bids worth making today.
6. **Open each row.** Look at:
   - Did we win this NSN before? At what price?
   - What's our cost margin look like?
   - Does the suggested price seem right given the history?
7. **Click "Quote".** Confirm the price or override. Add a comment if there's context ("matching last week's win").
8. Or **click "Skip"** if the margin is bad, the item is strange, or we can't fulfill in time.

### Batch submit (11:00 AM)

9. **Switch to "Quoted" tab.**
10. Select all (there's a "Select all" toggle).
11. **Submit.** Today this means "copy these to LamLinks." Future: it'll write straight to the k33/k34/k35 chain.
12. **Refresh.** The submitted items move to the "Submitted" tab.

### Afternoon (2:00 PM)

13. Second DIBBS scrape runs at 12:00 PM. Refresh the dashboard. Usually a few new items have appeared — sometimes interesting morning-posted solicitations.
14. Repeat 4–11 for the afternoon batch.

### End of day

15. **Check analytics.** Win/loss stats are updated as `award_lookup` background jobs complete.
16. **Receive the daily briefing on WhatsApp** (goes out next morning at 6:30 AM) with the overnight summary.

## The awards side (weekly/monthly)

Awards show up in the `awards` table via nightly sync from LamLinks k81 and via DIBBS `award_lookup` jobs. The **Awards** page lets Abe:

1. Filter by date range.
2. Select all awards.
3. Click **"Generate POs"** — which groups the awards by supplier CAGE code and creates draft POs in the `purchase_orders` table.
4. Each PO shows line items with our cost, sell price, and margin.
5. **Supplier switch** — for any line, click "Switch" to see all vendors with prices for that NSN + last PO date. One-click migration if a cheaper supplier shows up.

This part is further from complete than the bidding side — the PO workflow works but isn't hooked into AX for actual PO creation yet.

## The feedback loop

The crucial thing the workflow enables: **every bid teaches the system.**

- A submitted bid → becomes a row in `awards` (win or loss) within days.
- A win at price X → future bids on that NSN use X as the anchor.
- A loss at price Y → we see the actual winner's CAGE and price, which reshapes our bracket averages for that FSC.

Over time this compounds. The more Abe bids, the sharper the pricing gets. The pricing brackets will drift slightly each quarter as we refit against a larger dataset.

## Abe's actual daily pattern (from 2026-04-16 conversation)

The documented morning/review/afternoon sequence above is the idealized DIBS flow. Abe's current-world LamLinks flow is slightly different and worth capturing so DIBS evolves toward it rather than away from it:

1. **Morning (~8 AM)**: emails first — customer service + any quote-related inbound.
2. **Quotes of the day** — runs through LamLinks' pending solicitations. Abe's stated ideal: "anything under $500, select all quote suggested, done" — the kind of bulk-decision DIBS is being built toward.
3. **Download yesterday's awards** — LamLinks publishes the day's awards between 8–10 PM local, so "yesterday's" awards are the first batch Abe touches each morning. Current tool: `.xlsx` download → VBA macro strips today's partial day → upload to Dynamics MPI. DIBS' `/so` page replaces this loop.
4. **Per-award PO decisions** — Abe groups the ~300 daily award lines by part number in Excel, visually scans for items he knows are in stock (sends those straight to warehouse picker), and builds POs for the rest. He intentionally does NOT trust the "X in stock" count from the system — too many cases where stock is committed to a different order. Rule: "send it downstairs to pick; if they find stock, great; if not, they tell me and I order."
5. **Invoicing window (~5:30–6:30 PM)** — processes each shipped order as an invoice, one by one. Roughly 75 invoices per normal day.
6. **End-of-day**: two things get skipped because there's no time — following up on outstanding POs (vendor side), and following up on unpaid invoices (government side). Both are daily-leaking money.

DIBS' highest-leverage automations, ranked by Abe's own words:

- **Bulk-quote under $X** (already built; pending write-back to LamLinks + tests)
- **PO follow-up rules per supplier** (built; awaits real POs to exercise)
- **Payment / invoice follow-up surfacing** (not built; adjacent to `/invoicing/monitor`)
- **Auto-generate POs from awards grouped by supplier** (built; margin math fixed, UoM match in; pending AX write-back)

### Supplier pricing nuance (Seaberg example)

Some items have multiple vendors where the DIBS/AX cost waterfall would pick the "wrong" one. Abe's 2026-04-16 example:

- NSN maps to an item historically purchased from Tri Tech at $239
- Abe got a quote from Seaberg (the actual manufacturer; Tri Tech is a reseller) at $157.50
- Abe won the bid at $204
- To fulfill: Abe opened the item in AX, added Seaberg as a vendor with a trade agreement at $157.50, THEN generated the PO

This is a manual-intelligence move the system can't replicate — it's Abe knowing that "copying the reseller" is a viable negotiation lever. **Rule for DIBS' PO generator**: always let Abe override the supplier-match on any line before the PO is sent. Never auto-send without his sign-off on per-line vendor choice when the margin is already thin.

### DIBBS vs non-DIBBS solicitations

LamLinks carries solicitations from multiple government procurement systems, not just DIBBS. Abe flagged this during the walkthrough — anything starting with `SPE...` is DIBBS and can be quoted through DIBS' LamLinks write-back path. Anything starting with `W...` (Army-origin, etc.) is DoD but NOT on DIBBS, and LamLinks doesn't support quoting those items back — Abe bids those through separate channels. DIBS should filter to `SPE*` sol numbers on the Sourceable tab as a default, with a toggle to see the rest.

## What's still manual (and shouldn't be)

- **Bid submission to LamLinks.** Working via `scripts/append-bid-test.ts --execute` (one sol at a time, inserts under Abe's currently-staged envelope). Needs to become a UI button on the "Quoted" tab — select rows, hit Submit, they become k34+k35 lines under the active envelope. See [lamlinks-writeback.md](./lamlinks-writeback.md) for the technical pattern.
- **DIBS ↔ LamLinks status sync.** `scripts/sync-dibs-status.ts` flips `bid_decisions.status` from `quoted` to `submitted` after LamLinks transmission. Run manually today; needs a 15-min cron.
- **Morning sync & daily briefing** — both now scheduled via Windows Task Scheduler on `NYEVRVSQL001` (7 tasks, interactive mode so they bind to Shmuel's RDP session).

## What's next to test after bid submission

Write-back transmitted successfully 2026-04-21 (two bids into DLA). Remaining things to validate end-to-end:

1. **Award detection loop** — When DLA returns an award (win or loss) for one of our transmitted bids, does it land in `k81_tab` within a reasonable SLA, and does our nightly import pick it up and attach it to the original `bid_decisions` row? Test by tracking SPE2DP-26-T-2975 and SPE2DS-26-T-9795 through their respective return-by dates.
2. **Re-bid handling** — Abe modifies a bid after submission (e.g., 45d → 40d). Does inserting a second k34 row for the same `idnk11_k34` under a new envelope work, and does DLA accept the amendment? The empirical test is: make a second DIBS write-back for a sol already submitted earlier and watch what transmits.
3. **Fresh-envelope mode** — Currently we piggyback under Abe's envelope. Once we've transmitted 5+ bids this way, try minting a fresh `k33_tab` header ourselves (so Abe doesn't have to save a seed line first). Needs the `gennte_k34` XML blob pinned to a known-working value and a test of what `qtek14_k34` actually means.
4. **PO generation from Awards** — Select a won award in DIBS → "Generate POs" → verify it groups by cheapest vendor (not by awardee CAGE) and the cost/margin math matches expectations.
5. **LamLinks internal invoice posting (Yosef's test)** — The `ka8 → ka9 → kaj → kad → kae` chain. This is **not** the existing `/invoicing` EDI-810-to-DLA flow (that's live). It's a separate write surface letting DIBS post invoices into LamLinks itself so Yosef skips the desktop-UI click-through. Schema is mapped via `scripts/reverse-engineer-invoice-schema.ts` but the write-back generator is not built yet — phased path with 7 open questions for Yosef. See `docs/flows/invoicing.md#lamlinks-internal-invoicing-yosef-test`.
6. **Double-submission safety** — What happens if DIBS regenerates SQL for a bid Abe already submitted? We rely on the `already_bid` check against `abe_bids_live`, but the write-back script doesn't re-check at insert time. Risk: duplicate k34 rows.
