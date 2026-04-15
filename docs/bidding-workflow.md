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

The bid is staged. Today "submitted" means the row is marked `status='submitted'` in `bid_decisions` and copy-pasted into LamLinks by Abe. The direct write-back path is built but gated: `scripts/generate-bid-insert-sql.ts` produces a dry-run SQL file against `k33_tab / k34_tab / k35_tab` for Yosef to review. Once Yosef signs off, `--execute` commits the INSERTs directly, leaving Abe to click Submit in the LamLinks UI (which owns EDI transmission — we never touch the transmit fields).

**Column:** `bid_decisions.status = 'submitted'` with a `submitted_at` timestamp.

Once submitted, the row sticks around for post-game analysis. The `award_lookup` background job eventually pulls the award result (win/loss/partial) and attaches it.

### 5. Already Bid / Skipped

**Already Bid:** We've already placed a bid for this `solicitation_number` in LamLinks (via the `abe_bids` and `abe_bids_live` tables). No point showing it to Abe again.

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

## What's still manual (and shouldn't be)

- **Bid submission to LamLinks.** Abe copy-pastes from DIBS into LamLinks. Tooling is built (`scripts/generate-bid-insert-sql.ts` — dry-run generator for the `k33 → k34 → k35` chain, hardcoded ERG constants pulled from 50 of Abe's recent successful bids). Awaiting Yosef's review of the generated SQL before flipping to `--execute`. See *"what's next to test"* below.
- **Morning sync & daily briefing** — both now scheduled via Windows Task Scheduler on `NYEVRVSQL001` (7 tasks, interactive mode so they bind to Shmuel's RDP session).

## What's next to test after bid submission

Once the LamLinks write-back is live, the downstream lifecycle becomes testable end-to-end:

1. **k33 pending-state display** — Does the inserted batch show up in Abe's LamLinks UI as a pending draft he can review? (Our theory: `a_stat='acknowledged'` with null `o_stat/t_stat/s_stat` = pending. Unverified.)
2. **EDI transmission round-trip** — After Abe clicks Submit in LamLinks, does the state machine flip and DIBBS confirm receipt? Monitor `k33.t_stat_k33` transition to `sent`.
3. **Award detection loop** — When DIBBS returns an award (win or loss), does it land in `k81_tab` within a reasonable SLA, and does our nightly import pick it up and attach it to the original `bid_decisions` row? Test by tracing a known win end-to-end.
4. **PO generation from Awards** — Select a won award in DIBS → "Generate POs" → verify it groups by cheapest vendor (not by awardee CAGE) and the cost/margin math matches expectations.
5. **Invoice posting / quote posting (Yosef's test)** — The `ka8 → ka9 → kaj → kad → kae` invoicing chain is the next write surface. Yosef needs to verify DIBS can post quotes and invoices into LamLinks without corrupting the AX sync. Scoped separately — not blocking bid write-back.
6. **Double-submission safety** — What happens if DIBS regenerates SQL for a bid Abe already submitted? We rely on the `already_bid` check against `abe_bids_live`, but the write-back script doesn't re-check at insert time. Risk: duplicate k34 rows.
