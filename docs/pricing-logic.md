# Pricing Logic

> *"A bid that's too high loses. A bid that's too low wins unprofitably. The whole game is finding the edge."*

Pricing was Abe's most expensive problem. We built the engine from **2,591 historical bid-to-cost matches** — every bid we submitted where we later knew the cost and the outcome. This isn't a theoretical model. It's empirically fit to our own wins and losses.

## The core insight

When we plotted winning-bid-price ÷ cost across thousands of bids, we got a very clear picture:

- **Median winning bid was 1.29x cost** — so our baseline markup is ~29%.
- **Median winning margin was 23%.**
- **Median winning lead time was 55 days.**
- The distribution of winning multipliers is **strongly bracketed by price level**. Cheap items need higher multiples to cover fixed handling costs. Expensive items compress.

That bracketing is the heart of the pricing engine.

## The empirical markup brackets

```
Cost bracket         │ Multiplier
─────────────────────┼─────────────
Under $25            │ 1.64x
$25 – $100           │ 1.36x
$100 – $500          │ 1.21x
$500 and up          │ 1.16x
```

You can see the logic: a $5 bandage with a 64% markup still only yields $3.20 of gross — barely enough to cover picking, packing, and shipping. A $1,000 laryngoscope at 16% still yields $160 per unit. The brackets *normalize* for fixed cost absorption.

These numbers aren't hand-waved. They were fit against the win/loss distribution across the dataset. If we priced a $40 item at 1.64x (which would be aggressive for that bracket) we'd lose ~70% of the time. At 1.36x we win roughly where the winning-bid distribution peaks.

## Cost waterfall: what "cost" means

Before we can apply a markup, we need a cost. Costs come from a **waterfall** — we try each source in order and stop at the first hit:

1. **Recent PO (last 2 months)** — from AX `PurchaseOrderLinesV2`. Freshest, most reliable.
2. **Recent PO (last 3 months)** — slightly older, still high confidence.
3. **Master DB** — internal master's cost estimate. Medium confidence.
4. **Price agreement (cheapest vendor)** — from AX `PurchasePriceAgreements`. This is *asking* price from the vendor, not transacted, so slightly optimistic.
5. **Older PO (> 3 months)** — last resort. Prices drift.

Every sourceable solicitation gets a `cost_source` column recording which step hit. On the UI you'll see tags like "AX price agreement (cheapest vendor)" or "Recent PO (2 months)".

### When cost is unknown

Sometimes we have an NSN match but no cost data — usually for items we've never purchased. In that case:

1. Look up the **last award price** for this NSN from our 74K-row `awards` table.
2. Add a **bracket-adjusted increment** of 1–3% (cheap items = more volatile, bigger increment).
3. That's our suggested bid.

The rationale: if the last winning bid for this NSN was $45, and FSC inflation + our margin preferences push us to $46, we've priced into the winning zone without needing to know our cost.

## Winning history takes priority

This is the subtle part that took us a while to get right. Consider:

- NSN `6510-01-676-3176` (a gauze bandage) — AX price agreement says cost is $3.01.
- Naive bracket math: `$3.01 × 1.64 = $4.94` suggested bid.
- But we **won** the most recent 4 bids on this NSN at **$3.27**. So $4.94 is clearly too high — we'd lose.

**Rule:** if we have recent winning-bid history for this exact NSN, that price wins over generic bracket markup.

The re-pricing logic lives in `src/app/api/dibbs/reprice/route.ts`. The logic is:

```typescript
if (recentWinningBids.length >= 2) {
  // Use winning history — averaged with slight variance
  suggestedPrice = median(recentWinningBids) * 1.005;
} else {
  // Fall back to bracket math
  suggestedPrice = cost * bracketMultiplier(cost);
}
```

The re-pricer runs as part of enrichment and can also be triggered manually via the "Reprice" button.

## Shipping adjustment for FOB Destination

Government solicitations come in two FOB flavors:

- **FOB Origin** — buyer pays shipping. Our bid is our bid.
- **FOB Destination** — we pay shipping. We have to build that cost in.

For FOB Destination we subtract an **estimated shipping cost** from the gross to compute *effective* margin. The estimate is a crude linear function of weight-by-NSN (from PUB LOG where available, 5% of item value as a fallback). The UI shows both the nominal margin and the effective-after-shipping margin.

## The winning formula

From the 2,591 match dataset, the profile of a **winning bid** for Ever Ready First Aid is:

| Metric | Median |
|--------|--------|
| Multiplier over cost | 1.29x |
| Gross margin | 23% |
| Lead time | 55 days |
| Item price bracket | $25 – $100 (the sweet spot) |

Bids in the sweet-spot bracket ($25–100) at 1.29x with 55-day lead had roughly **40% win rate**. Bids outside those parameters win less often.

## The AI bid score

The suggested price is only half the question. *Should we bid at all?* That's what `calculateBidScore()` in `src/lib/bid-score.ts` answers — a 0–100 score with a recommendation.

Five factors, weighted:

- **Cost confidence** (0–25) — how fresh/reliable is our cost data? Recent PO = 25, AX agreement = 18, guess = 5.
- **Margin quality** (0–25) — does the suggested price give us ≥20% margin? Full points only if yes.
- **Win probability** (0–20) — FSC heatmap lookup + historical hit rate at this bracket.
- **Value score** (0–15) — total potential value of this line item. Bigger bids = more points (all else equal).
- **Timing score** (0–15) — due-date vs. our lead-time capacity. Too-tight = penalty.

Cutoffs:

- **BID** (65+) — green, Abe should bid.
- **CONSIDER** (40–64) — yellow, Abe should review.
- **SKIP** (< 40) — grey, probably not worth it.

Abe has the final word — the UI always lets him override.

## What the pricing engine is NOT

- **Not a market simulator.** We don't model competitor behavior. The empirical brackets implicitly encode competition but don't predict it.
- **Not a margin optimizer.** We price for the observed win point, not the theoretical profit-maximizing point. A 25% win rate at 40% margin may be worse than 50% win rate at 23% margin depending on volume. We haven't optimized that tradeoff yet.
- **Not forward-looking.** It doesn't account for rising vendor costs or changing demand. We recompute when data changes, not on a schedule.

## When pricing is wrong, here's why

If you see a suggested bid that looks way off, the diagnostic order is:

1. **Is there a `cost_source`?** If it says "AX price agreement (cheapest vendor)" but should say "Recent PO", the waterfall missed a fresh record — check if the PO lines import ran recently.
2. **Is there winning-bid history?** If yes but the suggested price doesn't match, the re-pricer hasn't run for this row — trigger `/api/dibbs/reprice`.
3. **Is the bracket right?** If a $500 item got priced at 1.64x, the cost field might be wrong (or quantities are being confused with per-unit prices).
4. **FOB Destination sneaking in?** If the margin shown is much lower than you expect, shipping is being subtracted.
