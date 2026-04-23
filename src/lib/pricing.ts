/**
 * DIBS Pricing Engine
 * Encodes Abe's pricing logic ("Yiddishe Kop") for bid suggestions.
 *
 * Key rules from the conversation:
 * - Slow increment: up 1-2% each time until losing, then back off
 * - Don't panic on first loss — wait for pattern (3+ times)
 * - Quantity discount: lower markup for bulk, higher for onesies
 * - McMaster/LIST items: 15-20% markup (everyone pays same price)
 * - Manufacturer competing: undercut by pennies
 * - Gov 10% ceiling: auto-award blocked if >10% above last award price
 * - Lead time gaming: quote 40-60 days, deliver in 10-14
 * - FOB destination: factor freight by ZIP + weight
 * - New items: search suppliers, quote ~18% markup
 * - No competition: keep incrementing (some items $50 → $900+)
 */

export interface BidHistoryRecord {
  winnerCageCode: string | null;
  winnerName: string | null;
  winningPrice: number;
  ourPrice: number | null;
  quantity: number | null;
  awardDate: Date;
  weWon: boolean;
}

export interface PricingSuggestion {
  suggestedPrice: number;
  suggestedLeadTimeDays: number;
  strategy: PricingStrategy;
  rationale: string;
  marginPercent: number;
  estimatedProfit: number;
  flags: string[];
}

export type PricingStrategy =
  | "INCREMENT"       // No competition, slowly raise price
  | "COMPETE"         // Competitor undercut us, match/beat
  | "HOLD"            // Price is stable, maintain
  | "NEW_ITEM"        // First time bidding, standard markup
  | "MANUFACTURER"    // OEM selling direct, undercut by pennies
  | "OPPORTUNITY"     // Lost at low price but winner charged much more
  | "SKIP";           // Don't bid (blocked vendor, etc.)

interface PricingInput {
  ourCost: number | null;
  quantity: number;
  fobTerms: "DESTINATION" | "ORIGIN";
  vendorPricingType: "LIST" | "NEGOTIATED" | "CONTRACT" | null;
  vendorSellsDirect: boolean;
  history: BidHistoryRecord[];
  ourCageCode?: string;
  shipToZip?: string | null;
  // Buyer's required delivery window in days (from earliest k32 dlydte_k32
  // minus issue date). When set, the suggested lead time matches it exactly
  // — Abe's rule: for Q sols especially, match what the buyer asked for.
  // Bidding 50 days on a 15-day Q is an instant loss.
  requiredDeliveryDays?: number | null;
  // Multi-destination ship-to list. Each entry has a qty + destination/zip.
  // When populated, estimateFreight sums per-destination freight across all
  // CLINs instead of using a single shipToZip (which would only price the
  // first destination). Critical for multi-location sols where the average
  // ZIP hides expensive outliers (Hawaii, Alaska, Puerto Rico).
  shipToLocations?: { qty: number; destination: string | null; delivery_date?: string | null }[] | null;
}

const OUR_CAGE_CODE = "0AG09";

export function calculatePricingSuggestion(input: PricingInput): PricingSuggestion {
  const { ourCost, quantity, fobTerms, vendorPricingType, vendorSellsDirect, history } = input;
  const flags: string[] = [];

  // Sort history by date descending
  const sorted = [...history].sort((a, b) => b.awardDate.getTime() - a.awardDate.getTime());

  // Separate our wins and losses
  const ourWins = sorted.filter(h => h.weWon);
  const ourLosses = sorted.filter(h => !h.weWon);
  const lastAward = sorted[0];
  const lastOurWin = ourWins[0];
  const lastOurLoss = ourLosses[0];

  // Lead time default: match the buyer's requirement exactly when the
  // solicitation specifies one (Abe's rule). If unknown, fall back to 50 —
  // our historical sweet spot when no constraint is given (we actually
  // deliver in 10-14, which boosts our rating over time).
  let leadTimeDays = input.requiredDeliveryDays && input.requiredDeliveryDays > 0
    ? input.requiredDeliveryDays
    : 50;

  // If no cost data, we can't calculate much
  if (!ourCost || ourCost <= 0) {
    return {
      suggestedPrice: lastAward?.winningPrice ?? 0,
      suggestedLeadTimeDays: leadTimeDays,
      strategy: "NEW_ITEM",
      rationale: "No cost data available. Using last award price as reference.",
      marginPercent: 0,
      estimatedProfit: 0,
      flags: ["NO_COST_DATA"],
    };
  }

  // Estimate freight for FOB Destination items. If the sol has multiple
  // ship-to CLINs (common on DLA depot distributions), sum freight across
  // each destination weighted by its qty. This catches Hawaii/Alaska/PR
  // outliers that would otherwise quietly erode the margin.
  let freightEstimate = 0;
  if (fobTerms === "DESTINATION") {
    if (input.shipToLocations && input.shipToLocations.length > 0) {
      freightEstimate = estimateFreightMulti(input.shipToLocations);
      if (freightEstimate > 0) flags.push(`Freight est: $${freightEstimate.toFixed(2)} across ${input.shipToLocations.length} dest`);
    } else {
      freightEstimate = estimateFreight(quantity, input.shipToZip);
      if (freightEstimate > 0) flags.push(`Freight est: $${freightEstimate.toFixed(2)}`);
    }
  }

  const totalCost = ourCost + (freightEstimate / Math.max(quantity, 1));

  // ─── No history: NEW_ITEM strategy ─────────────────────────
  if (history.length === 0) {
    const markup = vendorPricingType === "LIST" ? 0.17 : 0.20;
    const quantityAdjust = quantity >= 20 ? -0.03 : quantity === 1 ? 0.03 : 0;
    const adjustedMarkup = markup + quantityAdjust;
    const price = roundPrice(totalCost / (1 - adjustedMarkup));

    return {
      suggestedPrice: price,
      // For new items we prefer a conservative 60-day lead time — UNLESS
      // the solicitation mandates a tighter window, in which case honour it.
      suggestedLeadTimeDays: input.requiredDeliveryDays && input.requiredDeliveryDays > 0
        ? input.requiredDeliveryDays
        : 60,
      strategy: "NEW_ITEM",
      rationale: `New item. ${vendorPricingType === "LIST" ? "LIST pricing (17%)" : "Standard 20% markup"}. ${quantity >= 20 ? "Quantity discount applied." : ""}`,
      marginPercent: Math.round((1 - totalCost / price) * 100),
      estimatedProfit: roundPrice((price - totalCost) * quantity),
      flags,
    };
  }

  // ─── Check for OPPORTUNITY: we lost but winner charged way more ─────
  if (lastOurLoss && lastOurWin) {
    const lossPrice = lastOurLoss.ourPrice ?? 0;
    const winnerPrice = lastOurLoss.winningPrice;
    if (winnerPrice > lossPrice * 1.3) {
      // Winner charged 30%+ more than our bid — big pricing opportunity
      const newPrice = roundPrice(winnerPrice * 0.95); // Come in 5% under the winner
      const ceiling = checkTenPercentCeiling(newPrice, winnerPrice);
      if (ceiling) flags.push(ceiling);

      return {
        suggestedPrice: newPrice,
        suggestedLeadTimeDays: leadTimeDays,
        strategy: "OPPORTUNITY",
        rationale: `Lost at $${lossPrice.toFixed(2)} but winner charged $${winnerPrice.toFixed(2)}. Raise price to capture margin.`,
        marginPercent: Math.round((1 - totalCost / newPrice) * 100),
        estimatedProfit: roundPrice((newPrice - totalCost) * quantity),
        flags,
      };
    }
  }

  // ─── MANUFACTURER strategy: vendor sells direct ─────────────
  if (vendorSellsDirect && lastAward) {
    const mfrWins = sorted.filter(h => !h.weWon && h.winnerCageCode !== OUR_CAGE_CODE);
    if (mfrWins.length > 0) {
      const lastMfrPrice = mfrWins[0].winningPrice;
      const undercut = roundPrice(lastMfrPrice - 0.25); // Undercut by pennies/quarters
      if (undercut > totalCost) {
        return {
          suggestedPrice: undercut,
          suggestedLeadTimeDays: leadTimeDays,
          strategy: "MANUFACTURER",
          rationale: `Manufacturer sells direct at $${lastMfrPrice.toFixed(2)}. Undercutting by $0.25.`,
          marginPercent: Math.round((1 - totalCost / undercut) * 100),
          estimatedProfit: roundPrice((undercut - totalCost) * quantity),
          flags: [...flags, "Competing with manufacturer"],
        };
      }
    }
  }

  // ─── Count recent losses to decide COMPETE vs patience ─────
  const recentLosses = ourLosses.filter(
    h => h.awardDate.getTime() > Date.now() - 90 * 24 * 60 * 60 * 1000
  );

  if (recentLosses.length >= 2) {
    // 2+ losses in 90 days — time to compete
    const lowestWinner = Math.min(...recentLosses.map(h => h.winningPrice));
    const competitivePrice = roundPrice(lowestWinner - 0.02);
    if (competitivePrice > totalCost) {
      const ceiling = checkTenPercentCeiling(competitivePrice, lastAward.winningPrice);
      if (ceiling) flags.push(ceiling);

      return {
        suggestedPrice: competitivePrice,
        suggestedLeadTimeDays: leadTimeDays,
        strategy: "COMPETE",
        rationale: `Lost ${recentLosses.length}x in 90 days. Lowest competitor: $${lowestWinner.toFixed(2)}. Undercutting by $0.02.`,
        marginPercent: Math.round((1 - totalCost / competitivePrice) * 100),
        estimatedProfit: roundPrice((competitivePrice - totalCost) * quantity),
        flags,
      };
    }
  }

  if (recentLosses.length === 1) {
    // Single loss — don't panic, hold or slight adjust
    const lastPrice = lastOurWin?.winningPrice ?? lastAward.winningPrice;
    const holdPrice = roundPrice(lastPrice);
    flags.push("Single recent loss — holding price, waiting for pattern");

    return {
      suggestedPrice: holdPrice,
      suggestedLeadTimeDays: leadTimeDays,
      strategy: "HOLD",
      rationale: `Lost once recently. Don't panic — could be a fluke. Holding at $${holdPrice.toFixed(2)}.`,
      marginPercent: Math.round((1 - totalCost / holdPrice) * 100),
      estimatedProfit: roundPrice((holdPrice - totalCost) * quantity),
      flags,
    };
  }

  // ─── INCREMENT strategy: we've been winning, push price up ─────
  if (ourWins.length > 0) {
    const lastWinPrice = ourWins[0].winningPrice;
    const incrementPct = getIncrementPercent(ourWins.length, quantity);
    let newPrice = roundPrice(lastWinPrice * (1 + incrementPct));

    // Quantity adjustment: lower price for bulk, higher for onesies
    if (quantity >= 20) {
      newPrice = roundPrice(newPrice * 0.97); // 3% quantity discount
      flags.push("Quantity discount applied (-3%)");
    } else if (quantity === 1) {
      newPrice = roundPrice(newPrice * 1.02); // 2% onesie premium
    }

    // Check 10% ceiling
    const ceiling = checkTenPercentCeiling(newPrice, lastAward.winningPrice);
    if (ceiling) {
      flags.push(ceiling);
      newPrice = roundPrice(lastAward.winningPrice * 1.09); // Stay under 10%
    }

    // Ensure we're still profitable
    if (newPrice < totalCost * 1.05) {
      newPrice = roundPrice(totalCost * 1.10);
      flags.push("Price floor: minimum 10% margin");
    }

    return {
      suggestedPrice: newPrice,
      suggestedLeadTimeDays: leadTimeDays,
      strategy: "INCREMENT",
      rationale: `Won ${ourWins.length}x consecutively. Incrementing ${(incrementPct * 100).toFixed(1)}%.`,
      marginPercent: Math.round((1 - totalCost / newPrice) * 100),
      estimatedProfit: roundPrice((newPrice - totalCost) * quantity),
      flags,
    };
  }

  // ─── Fallback: standard markup ─────────────────────────────
  const fallbackMarkup = 0.18;
  const fallbackPrice = roundPrice(totalCost / (1 - fallbackMarkup));
  return {
    suggestedPrice: fallbackPrice,
    suggestedLeadTimeDays: leadTimeDays,
    strategy: "NEW_ITEM",
    rationale: "Fallback: standard 18% markup.",
    marginPercent: Math.round((1 - totalCost / fallbackPrice) * 100),
    estimatedProfit: roundPrice((fallbackPrice - totalCost) * quantity),
    flags,
  };
}

/** How much to increment based on consecutive wins */
function getIncrementPercent(consecutiveWins: number, quantity: number): number {
  // More wins = bolder increments (up to a point)
  const base = consecutiveWins <= 2 ? 0.01 : consecutiveWins <= 5 ? 0.02 : 0.03;
  // Smaller quantities = more room to push price
  const qtyFactor = quantity <= 3 ? 1.5 : quantity <= 10 ? 1.0 : 0.7;
  return base * qtyFactor;
}

/** Check if price would trigger gov's 10% automatic block */
function checkTenPercentCeiling(newPrice: number, lastAwardPrice: number): string | null {
  if (lastAwardPrice <= 0) return null;
  const pctOver = (newPrice - lastAwardPrice) / lastAwardPrice;
  if (pctOver > 0.10) {
    return `WARNING: ${(pctOver * 100).toFixed(1)}% above last award ($${lastAwardPrice.toFixed(2)}). Gov blocks auto-award >10%.`;
  }
  return null;
}

/** Rough freight estimate for FOB Destination (medical) items */
function estimateFreight(quantity: number, shipToZip?: string | null): number {
  // Very rough heuristic — real implementation would use carrier API
  const baseRate = 8.50; // base small parcel
  const perUnit = 0.50;
  const hawaiiFactor = shipToZip?.startsWith("96") ? 3.0 : 1.0; // Hawaii/pacific
  const westCoastFactor = shipToZip && parseInt(shipToZip) >= 90000 && parseInt(shipToZip) < 96000 ? 1.3 : 1.0;

  return roundPrice((baseRate + perUnit * quantity) * hawaiiFactor * westCoastFactor);
}

/**
 * Sum estimateFreight across every ship-to destination on a multi-CLIN
 * solicitation. Each CLIN ships as its own parcel (separate base rate +
 * per-unit), so a 4-CLIN sol pays 4 base rates. Extracts ZIPs from the
 * free-text `destination` column (LL k32 stores the full address blob).
 */
function estimateFreightMulti(
  locations: { qty: number; destination: string | null }[]
): number {
  let total = 0;
  for (const loc of locations) {
    const zip = extractZip(loc.destination);
    total += estimateFreight(Math.max(1, loc.qty || 1), zip);
  }
  return roundPrice(total);
}

/** Pull a 5-digit ZIP out of a free-text destination string. */
function extractZip(dest: string | null): string | null {
  if (!dest) return null;
  const m = dest.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : null;
}

function roundPrice(price: number): number {
  return Math.round(price * 100) / 100;
}
