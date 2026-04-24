/**
 * NSN auto-research — single-call Claude prompt returns identity +
 * candidate suppliers as structured JSON. Cheap, fast, no external web
 * calls (MVP — phase 2 adds real-time web verification).
 */
import { claudeCall, extractJson, ClaudeCallResult } from "./claude";

export type ResearchInput = {
  nsn: string;
  fsc?: string | null;
  niin?: string | null;
  description?: string | null;
  manufacturer_hint?: string | null;
  manufacturer_part_number?: string | null;
  quantity?: number | null;
  fob?: string | null;
  recent_winners?: { cage: string; price: number; date: string }[];
  erg_suppliers?: { cage: string; name: string }[]; // ERG's active AX supplier list
  max_candidates?: number;
};

export type ResearchCandidate = {
  supplier_name: string;
  supplier_cage: string | null;
  supplier_url: string | null;
  product_url: string | null;
  estimated_list_price: number | null;
  moq: number | null;
  lead_time_days: number | null;
  is_manufacturer: boolean;
  erg_has_account: boolean;
  confidence: number; // 0-1
  rationale: string;
};

export type ResearchOutput = {
  identity: {
    item_name: string;
    manufacturer_candidates: string[];
    common_part_numbers: string[];
    item_category: string;
    confidence: number;
  };
  candidates: ResearchCandidate[];
  no_results_reason?: string;
};

export type ResearchResult = {
  output: ResearchOutput;
  call: ClaudeCallResult;
};

const SYSTEM_PROMPT = `You are a procurement research assistant for a government-supply company (ERG, CAGE 0AG09) that bids on DLA (Defense Logistics Agency) solicitations. Your job: given an NSN + description, identify the item, name likely manufacturers, and list candidate suppliers we could buy from to fulfill the order.

Respond with STRICT JSON matching this schema. No prose. No markdown fences.

{
  "identity": {
    "item_name": "<canonical item name>",
    "manufacturer_candidates": ["<mfr1>", "<mfr2>"],
    "common_part_numbers": ["<pn1>", "<pn2>"],
    "item_category": "<e.g. medical supplies | electrical | mechanical | consumable>",
    "confidence": <0.0-1.0>
  },
  "candidates": [
    {
      "supplier_name": "<company name>",
      "supplier_cage": "<CAGE if known, else null>",
      "supplier_url": "<homepage if known, else null>",
      "product_url": "<product page if findable, else null>",
      "estimated_list_price": <retail price estimate per-unit, or null>,
      "moq": <minimum order quantity if known, else null>,
      "lead_time_days": <typical if known, else null>,
      "is_manufacturer": <true if this IS the mfr, false if distributor>,
      "erg_has_account": <true if the supplier name matches ERG's existing supplier list below>,
      "confidence": <0.0-1.0>,
      "rationale": "<brief reason for suggesting: 'Medline is the #1 US distributor of this class', 'Listed in Grainger's catalog', etc.>"
    }
  ],
  "no_results_reason": "<null OR a short explanation if you can't find candidates — custom/legacy DoD items, obsolete NSNs, etc.>"
}

Guidelines:
- Return UP TO max_candidates entries, ranked by likelihood of fulfillment success (availability × reasonable pricing × ERG fit).
- Prefer candidates where ERG has_account = true — surface those in the top positions.
- For commercial items (medical, office, electrical), include well-known US distributors: Grainger, Zoro, McMaster-Carr, MSC, Medline, Cardinal Health, Henry Schein, VWR, Fisher Scientific, Amazon Business, Global Industrial, Home Depot, Uline.
- For specialty/defense-only items, lean on your knowledge of mil-spec suppliers; be honest with lower confidence.
- NEVER fabricate a specific URL or exact price you're not confident about. Use null.
- NEVER fabricate a CAGE code — only fill supplier_cage if you're certain.
- If the item looks genuinely rare or defense-specific and you can't find candidates, set candidates=[] and fill no_results_reason.

Output ONLY the JSON object.`;

export async function researchNsn(
  input: ResearchInput,
  model: string = "claude-haiku-4-5-20251001"
): Promise<ResearchResult> {
  const maxCandidates = input.max_candidates ?? 6;
  const userMsg = buildUserMessage(input, maxCandidates);

  const call = await claudeCall({
    model,
    system: SYSTEM_PROMPT,
    user: userMsg,
    maxTokens: 3000,
    temperature: 0,
  });

  const output = extractJson<ResearchOutput>(call.text);

  // Post-process: clamp confidence values, dedupe, ensure max_candidates limit
  if (output.candidates) {
    output.candidates = output.candidates
      .map((c) => ({
        ...c,
        confidence: Math.max(0, Math.min(1, Number(c.confidence) || 0)),
      }))
      .sort((a, b) => {
        // ERG accounts first, then by confidence
        if (a.erg_has_account !== b.erg_has_account) return a.erg_has_account ? -1 : 1;
        return b.confidence - a.confidence;
      })
      .slice(0, maxCandidates);
  }

  return { output, call };
}

function buildUserMessage(input: ResearchInput, maxCandidates: number): string {
  const parts: string[] = [`NSN: ${input.nsn}`];
  if (input.description) parts.push(`Description: ${input.description}`);
  if (input.manufacturer_hint) parts.push(`Manufacturer hint: ${input.manufacturer_hint}`);
  if (input.manufacturer_part_number) parts.push(`Manufacturer P/N hint: ${input.manufacturer_part_number}`);
  if (input.quantity) parts.push(`Solicitation quantity: ${input.quantity} units`);
  if (input.fob) parts.push(`FOB: ${input.fob}`);

  if (input.recent_winners?.length) {
    parts.push(`\nPast DLA award winners for this NSN (most recent first):`);
    for (const w of input.recent_winners.slice(0, 5)) {
      parts.push(`  CAGE ${w.cage} @ $${w.price} on ${w.date}`);
    }
  }

  if (input.erg_suppliers?.length) {
    parts.push(`\nERG's existing suppliers (we have accounts with these — prefer them in candidates):`);
    for (const s of input.erg_suppliers.slice(0, 50)) {
      parts.push(`  ${s.name} (CAGE ${s.cage})`);
    }
  }

  parts.push(`\nmax_candidates: ${maxCandidates}`);
  parts.push(`\nReturn JSON only.`);
  return parts.join("\n");
}
