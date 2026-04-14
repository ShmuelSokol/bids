/**
 * Shared margin math. One formula for the whole app so enrichment,
 * PO generation, analytics, and the UI can't silently disagree.
 */

export function computeMarginPct(
  sellPrice: number | null | undefined,
  cost: number | null | undefined
): number | null {
  const s = Number(sellPrice);
  const c = Number(cost);
  if (!isFinite(s) || !isFinite(c) || s <= 0) return null;
  return Math.round(((s - c) / s) * 100);
}

/**
 * Margin after subtracting estimated shipping for FOB Destination items.
 * FOB Origin returns the naive margin unchanged.
 */
export function computeMarginPctFob(
  sellPrice: number | null | undefined,
  cost: number | null | undefined,
  estShipping: number | null | undefined,
  fob: string | null | undefined
): number | null {
  const s = Number(sellPrice);
  const c = Number(cost);
  if (!isFinite(s) || !isFinite(c) || s <= 0) return null;
  const shipCost = fob === "D" ? Number(estShipping) || 0 : 0;
  return Math.round(((s - c - shipCost) / s) * 100);
}
