/**
 * Shared solicitation filtering logic.
 * Used by dashboard, solicitations page, and briefing script.
 * ONE source of truth for what counts as "sourceable", "open", etc.
 */

export function isOpenSolicitation(returnByDate: string | null | undefined): boolean {
  if (!returnByDate) return true;
  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD in UTC
  const parts = returnByDate.split("-");
  if (parts.length === 3 && parts[2].length === 4) {
    // MM-DD-YYYY → YYYY-MM-DD
    const isoDate = `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
    return isoDate >= todayStr;
  }
  return returnByDate >= todayStr;
}

export interface FilterableSolicitation {
  is_sourceable: boolean;
  already_bid?: boolean;
  return_by_date?: string | null;
  solicitation_number?: string;
  nsn?: string;
  bid_status?: string | null;
}

export interface FilterContext {
  liveBidSols?: Set<string>;
  decisionKeys?: Set<string>;
}

/** Matches dashboard "Sourceable" count: open + sourceable + not already bid + no decision */
export function isSourceableOpen(s: FilterableSolicitation, ctx?: FilterContext): boolean {
  if (!s.is_sourceable) return false;
  if (s.already_bid) return false;
  if (s.bid_status) return false; // has a decision (quoted/submitted/skipped)
  if (ctx?.liveBidSols?.has(s.solicitation_number?.trim() || "")) return false;
  if (ctx?.decisionKeys?.has(`${s.solicitation_number}_${s.nsn}`)) return false;
  return isOpenSolicitation(s.return_by_date);
}

/** Build filter context from live bids and decisions */
export function buildFilterContext(
  liveBids: Array<{ solicitation_number?: string }>,
  decisions: Array<{ solicitation_number: string; nsn: string }>
): FilterContext {
  return {
    liveBidSols: new Set(liveBids.map(b => b.solicitation_number?.trim()).filter(Boolean) as string[]),
    decisionKeys: new Set(decisions.map(d => `${d.solicitation_number}_${d.nsn}`)),
  };
}
