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
Cost bracket         │ Multiplier (recalibrated 2026-04)
─────────────────────┼─────────────
Under $25            │ 2.00x  (was 1.64x)
$25 – $100           │ 1.36x
$100 – $500          │ 1.21x
$500 and up          │ 1.16x
```

You can see the logic: a $5 bandage with a 100% markup still only yields $5 of gross — barely enough to cover picking, packing, and shipping. A $1,000 laryngoscope at 16% still yields $160 per unit. The brackets *normalize* for fixed cost absorption.

These numbers aren't hand-waved. They were fit against the win/loss distribution across the dataset, then **recalibrated in April 2026** after comparing our `suggested_price` against Abe's actual bids over a 14-day window (466 bids with known cost). Abe's empirical median multipliers:

| Bracket | Abe median | DIBS was suggesting | Action |
|---------|-----------|---------------------|--------|
| <$25    | **2.29×** | 1.64× | Raised to 2.00× (conservative anchor) |
| $25-100 | 1.40×     | 1.36× | Kept (within 3%) |
| $100-500| 1.19×     | 1.21× | Kept (within 2%) |
| $500+   | 1.18×     | 1.16× | Kept (within 2%) |

The `<$25` bracket was badly miscalibrated — for a $10-cost item we'd suggest $16.40 but Abe actually bid $22.90. Cheap items need more margin to clear fixed overhead (handling, packaging, shipping eat ~$5 regardless of item price). Going to 2.00× closes most of the gap while staying conservative against outliers at the p75 (4.94×) — Abe will still manually bump when needed, and we won't overshoot.

## Cost waterfall: what "cost" means

Before we can apply a markup, we need a cost. Costs come from a **waterfall** — we try each source in order and stop at the first hit:

1. **Recent PO (last 2 months)** — from AX `PurchaseOrderLinesV2` + headers for vendor. Freshest, most reliable. **This is the vendor we actually buy from.** (Added 2026-04-16; previously only price agreements were implemented.)
2. **Recent PO (last 3 months)** — slightly older, still high confidence.
3. **Price agreement (cheapest vendor)** — from AX `PurchasePriceAgreements`. This is *asking* price from the vendor, not transacted, so slightly optimistic.
4. **Older PO (> 3 months)** — last resort. Prices drift.

As of 2026-04-16, the waterfall actually works end-to-end: 976 NSNs use real PO history (759 from last 2 months + 198 from 3 months + 19 older). The remaining 23,231 still use price agreements because they have no PO history.

Every sourceable solicitation gets a `cost_source` column recording which step hit. On the UI you'll see tags like "AX price agreement (cheapest vendor)" or "AX PO (last 2 months)".

**PO generation uses the same waterfall.** When generating a PO from an award, the supplier is whatever vendor the waterfall picked in `nsn_costs`. If the waterfall picked "AX PO (last 2 months)" with vendor ACME, the PO goes to ACME — not the cheapest price agreement vendor. This ensures we order from the vendor we actually buy from, not just the cheapest quote.

### When cost is unknown

Sometimes we have an NSN match but no cost data — usually for items we've never purchased. In that case:

1. Look up the **last award price** for this NSN from our 74K-row `awards` table.
2. Add a **bracket-adjusted increment** of 1–3% (cheap items = more volatile, bigger increment).
3. That's our suggested bid.

The rationale: if the last winning bid for this NSN was $45, and FSC inflation + our margin preferences push us to $46, we've priced into the winning zone without needing to know our cost.

## Three-tier pricing: our wins → competitor wins → bracket markup

Pricing uses a three-tier waterfall, added 2026-04-16 after bug #16 revealed that blind bracket markup ignores market reality. The enrichment route (`src/app/api/dibbs/enrich/route.ts`) builds three maps during startup:

- **ourWinMap** — most recent price WE won at (cage=0AG09)
- **competitorWinMap** — most recent price a COMPETITOR won at (cage≠0AG09, from 106K kc4_tab awards)
- **pricingMap** — most recent award from ANY winner

### Tier 1: Our winning history

If we won this NSN before, anchor to that price. It cleared the market once, it'll likely clear again.

- Margin > 5%? → use our winning price as-is
- Margin thin? → max(cost × 1.15, last win + 1%)

### Tier 2: Competitor winning history (NEW, 2026-04-16)

If we never won but a competitor did, their winning price IS the market price. Bidding above it guarantees a loss.

- Margin > 8% at competitor price -2%? → **undercut competitor by 2%**
- Margin tight? → bid at cost × 1.10 minimum
- Competitor won below our cost? → can't compete on price, fall through to bracket

**Example (bug #16):** NSN 5905-01-571-0556, cost $19.86, competitor CAGE 75Q65 won at $27.14. Old logic: $19.86 × 1.64 = **$32.57** (would lose). New logic: $27.14 × 0.98 = **$26.60** (25% margin, competitive).

### Tier 3: Bracket markup (no history)

When we have no award history at all, apply the empirical bracket markup. But even here, if a competitor win exists, **cap the suggestion at competitor price -2%** so we don't blindly overshoot the market.

The re-pricing logic lives in `src/app/api/dibbs/enrich/route.ts` (enrichment) and `src/app/api/dibbs/reprice/route.ts` (manual trigger).

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

- **Not a market simulator.** We now anchor to competitor wins when available (tier 2), but we don't predict competitor strategy — we just try to undercut their last winning price.
- **Not a margin optimizer.** We price for the observed win point, not the theoretical profit-maximizing point. A 25% win rate at 40% margin may be worse than 50% win rate at 23% margin depending on volume. We haven't optimized that tradeoff yet.
- **Not forward-looking.** It doesn't account for rising vendor costs or changing demand. We recompute when data changes, not on a schedule.

## When pricing is wrong, here's why

If you see a suggested bid that looks way off, the diagnostic order is:

1. **Is there a `cost_source`?** If it says "AX price agreement (cheapest vendor)" but should say "Recent PO", the waterfall missed a fresh record — check if the PO lines import ran recently.
2. **Is there winning-bid history?** If yes but the suggested price doesn't match, the re-pricer hasn't run for this row — trigger `/api/dibbs/reprice`.
3. **Is the bracket right?** If a $500 item got priced at 1.64x, the cost field might be wrong (or quantities are being confused with per-unit prices).
4. **FOB Destination sneaking in?** If the margin shown is much lower than you expect, shipping is being subtracted.
