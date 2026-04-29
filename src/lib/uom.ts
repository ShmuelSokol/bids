/**
 * Unit-of-measure helpers for DIBS pricing.
 *
 * AX stores costs per its internal UoM ("B25" = pack of 25). DLA solicitations
 * advertise units in the buyer's UoM (typically "EA"). When these differ, our
 * cost basis must be converted to per-EA before we apply any markup or
 * compare against award history.
 *
 * Discovered 2026-04-28 via SPE2DS-26-T-021J: AX cost $100.90/B25 was being
 * treated as $100.90/EA, suggesting $110.99/EA when the right number was
 * ~$4.50/EA (cost $4.04/EA after pack split). See `docs/gotchas.md` § "UoM
 * B-prefix codes".
 */

/**
 * Pack multiplier — how many "each" units one of this UoM contains.
 * Returns 1 when the UoM is the sellable unit itself.
 *
 * Recognised:
 *   - EA, PR, PG, BG, YD, FT, IN, GA, LB, OZ, RL, SE, SO, ST, TU, EN → 1
 *   - B<NN> (B25, B10, B100, ...) → NN
 *   - Unknown UoM → 1 (with `confident: false`)
 */
export function parseUomMultiplier(uom: string | null | undefined): { mult: number; confident: boolean } {
  const u = (uom || "").trim().toUpperCase();
  if (!u) return { mult: 1, confident: false };

  // B-prefix bundle codes: B<digits>
  const m = u.match(/^B(\d+)$/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0) return { mult: n, confident: true };
  }

  // Known sellable-unit codes (one item per UoM)
  const ones = new Set(["EA", "PR", "PG", "BG", "YD", "FT", "IN", "GA", "LB", "OZ", "RL", "SE", "SO", "ST", "TU", "EN", "KT", "AS", "CD"]);
  if (ones.has(u)) return { mult: 1, confident: true };

  // Generic pack codes where the count comes from elsewhere (item master,
  // catalog) — we don't know the count, default to 1 and flag as not confident.
  const unknownPacks = new Set(["BX", "CN", "PK", "CT", "CS", "DZ", "GR", "HD", "MC", "MX"]);
  if (unknownPacks.has(u)) return { mult: 1, confident: false };

  return { mult: 1, confident: false };
}

/**
 * Convert a cost in `srcUom` to a per-each cost. If srcUom is a known
 * bundle (e.g. B25) we divide; if it's already per-each we return as-is.
 */
export function costPerEach(cost: number, srcUom: string | null | undefined): number {
  const { mult } = parseUomMultiplier(srcUom);
  if (mult <= 0) return cost;
  return cost / mult;
}

/**
 * When two UoMs are involved (e.g. AX cost in B25, sol asks for EA), return
 * the cost expressed in the sol's UoM. If either is unknown we return the
 * source cost unchanged and `converted: false`.
 */
export function convertCost(
  cost: number,
  srcUom: string | null | undefined,
  dstUom: string | null | undefined
): { cost: number; converted: boolean; note: string } {
  const src = parseUomMultiplier(srcUom);
  const dst = parseUomMultiplier(dstUom);
  if (!src.confident || !dst.confident) {
    return { cost, converted: false, note: `UoM unknown (src=${srcUom || "?"} dst=${dstUom || "?"})` };
  }
  if (src.mult === dst.mult) {
    return { cost, converted: false, note: `same UoM (${srcUom})` };
  }
  // Cost is for `srcUom` (containing src.mult eaches). Convert to dst.mult eaches.
  const perEach = cost / src.mult;
  const dstCost = perEach * dst.mult;
  return {
    cost: dstCost,
    converted: true,
    note: `${srcUom}@$${cost.toFixed(2)} → ${dstUom}@$${dstCost.toFixed(2)} (per-each $${perEach.toFixed(4)})`,
  };
}
