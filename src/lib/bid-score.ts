/**
 * AI Bid/No-Bid Scoring
 *
 * Scores each solicitation 0-100 based on:
 * - Cost confidence (do we have reliable cost data?)
 * - Margin quality (is the markup sustainable?)
 * - FSC win history (how often do we win in this category?)
 * - Volume/value (is this worth the effort?)
 * - Competition (how crowded is this FSC?)
 * - Timing (how much time left to bid?)
 *
 * Empirically calibrated from:
 * - 2,591 bid-to-cost matches
 * - 5,000 award records
 * - 10,000 Abe bid records
 * - Median win markup: 1.29x, median margin: 23%, median lead: 45 days
 */

interface ScoringInput {
  // Item data
  suggestedPrice: number | null;
  ourCost: number | null;
  marginPct: number | null;
  quantity: number;
  estValue: number | null;

  // Source confidence
  isSourceable: boolean;
  source: string | null;        // "ax" = high confidence, "master" = lower
  costSource: string | null;    // "recent_po_2mo" = best, "older_po" = worst
  priceSource: string | null;

  // History
  fscWinRate: number | null;    // 0-1, from fsc_heatmap
  fscBidVolume: number;         // bids in last 6 months for this FSC
  alreadyBid: boolean;
  awardCount: number;           // how many competitors bid on same NSN

  // Timing
  daysUntilDue: number | null;

  // FOB
  fob: string | null;           // "D" = destination (we pay shipping), "O" = origin
}

export interface BidScore {
  score: number;              // 0-100
  recommendation: "BID" | "CONSIDER" | "SKIP";
  reasons: string[];          // why this score
  factors: {
    costConfidence: number;   // 0-25
    marginQuality: number;    // 0-25
    winProbability: number;   // 0-20
    valueScore: number;       // 0-15
    timingScore: number;      // 0-15
  };
}

export function calculateBidScore(input: ScoringInput): BidScore {
  const reasons: string[] = [];
  let costConfidence = 0;
  let marginQuality = 0;
  let winProbability = 0;
  let valueScore = 0;
  let timingScore = 0;

  // === COST CONFIDENCE (0-25) ===
  if (!input.isSourceable) {
    costConfidence = 0;
    reasons.push("Not sourceable — no NSN match in our catalog");
  } else if (input.source === "ax") {
    costConfidence += 15; // AX is authoritative
    if (input.costSource?.includes("recent_po_2mo")) {
      costConfidence += 10;
      reasons.push("Strong cost data (recent PO)");
    } else if (input.costSource?.includes("recent_po")) {
      costConfidence += 7;
    } else if (input.costSource?.includes("price_agreement")) {
      costConfidence += 5;
    } else if (input.costSource?.includes("older_po")) {
      costConfidence += 3;
      reasons.push("Cost data may be stale (older PO)");
    } else {
      costConfidence += 2;
    }
  } else if (input.source === "master") {
    costConfidence += 8;
    reasons.push("Master DB match — verify cost before bidding");
  }

  // === MARGIN QUALITY (0-25) ===
  if (input.marginPct !== null) {
    if (input.marginPct >= 30) {
      marginQuality = 25;
      reasons.push(`Excellent margin (${input.marginPct}%)`);
    } else if (input.marginPct >= 20) {
      marginQuality = 20;
    } else if (input.marginPct >= 15) {
      marginQuality = 15;
    } else if (input.marginPct >= 10) {
      marginQuality = 10;
      reasons.push(`Thin margin (${input.marginPct}%) — watch shipping costs`);
    } else if (input.marginPct >= 0) {
      marginQuality = 5;
      reasons.push(`Very thin margin (${input.marginPct}%) — risky`);
    } else {
      marginQuality = 0;
      reasons.push(`Negative margin (${input.marginPct}%) — would lose money`);
    }

    // FOB destination penalty
    if (input.fob === "D" && input.marginPct < 20) {
      marginQuality = Math.max(0, marginQuality - 5);
      reasons.push("FOB Dest with thin margin — shipping eats profit");
    }
  } else if (input.suggestedPrice) {
    marginQuality = 8; // have a price but no cost = moderate confidence
  }

  // === WIN PROBABILITY (0-20) ===
  if (input.fscWinRate !== null) {
    if (input.fscWinRate >= 0.15) {
      winProbability = 20;
      reasons.push(`High win rate FSC (${(input.fscWinRate * 100).toFixed(0)}%)`);
    } else if (input.fscWinRate >= 0.08) {
      winProbability = 15;
    } else if (input.fscWinRate >= 0.03) {
      winProbability = 10;
    } else if (input.fscWinRate > 0) {
      winProbability = 5;
      reasons.push(`Low win rate FSC (${(input.fscWinRate * 100).toFixed(0)}%)`);
    } else {
      winProbability = 3; // never won but still possible
    }
  } else {
    // No win data — use bid volume as proxy
    if (input.fscBidVolume > 100) {
      winProbability = 12; // we bid a lot here
    } else if (input.fscBidVolume > 20) {
      winProbability = 8;
    } else {
      winProbability = 5; // new category
      reasons.push("New FSC — no bid history");
    }
  }

  // Competition penalty
  if (input.awardCount > 5) {
    winProbability = Math.max(0, winProbability - 5);
    reasons.push(`Crowded (${input.awardCount} competitors)`);
  }

  // === VALUE SCORE (0-15) ===
  const value = input.estValue || (input.suggestedPrice || 0) * input.quantity;
  if (value >= 5000) {
    valueScore = 15;
    reasons.push(`High value ($${value.toLocaleString()})`);
  } else if (value >= 1000) {
    valueScore = 12;
  } else if (value >= 500) {
    valueScore = 9;
  } else if (value >= 100) {
    valueScore = 6;
  } else if (value >= 25) {
    valueScore = 3;
  } else {
    valueScore = 1;
    reasons.push("Very low value — may not be worth the effort");
  }

  // === TIMING SCORE (0-15) ===
  if (input.daysUntilDue === null) {
    timingScore = 10; // unknown = assume reasonable
  } else if (input.daysUntilDue >= 7) {
    timingScore = 15;
  } else if (input.daysUntilDue >= 3) {
    timingScore = 10;
    reasons.push(`Due in ${input.daysUntilDue} days`);
  } else if (input.daysUntilDue >= 1) {
    timingScore = 5;
    reasons.push(`Due tomorrow — act fast`);
  } else {
    timingScore = 0;
    reasons.push("Past due");
  }

  // === TOTAL ===
  const score = costConfidence + marginQuality + winProbability + valueScore + timingScore;

  let recommendation: "BID" | "CONSIDER" | "SKIP";
  if (score >= 65) {
    recommendation = "BID";
  } else if (score >= 40) {
    recommendation = "CONSIDER";
  } else {
    recommendation = "SKIP";
  }

  // Override: never recommend bidding on unsourceable items
  if (!input.isSourceable) {
    return {
      score: Math.min(score, 20),
      recommendation: "SKIP",
      reasons: ["Not in our catalog — cannot source"],
      factors: { costConfidence, marginQuality, winProbability, valueScore, timingScore },
    };
  }

  return {
    score,
    recommendation,
    reasons: reasons.slice(0, 4), // top 4 reasons
    factors: { costConfidence, marginQuality, winProbability, valueScore, timingScore },
  };
}
