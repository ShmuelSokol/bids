/**
 * RFQ outbound template — derived from analyzing 37 of Abe's actual outbound
 * RFQ emails (Sent Items, last 90 days, scraped 2026-04-30).
 *
 * Abe's tone, distilled:
 *   - Very terse — no "Dear", no "Best regards"
 *   - First-name greeting only ("Mat", "Hi matt", "Joe")
 *   - "Please quote me on NSN below" as the canonical opener for new RFQs
 *   - NSNs listed one per line, no labels
 *   - Part Number / Quantity pairs separated by blank lines (visual grouping)
 *   - Standard signature block
 *
 * Subjects are typically ALL CAPS:
 *   - "QUOTE REQUEST" — most common, generic
 *   - "RFQ" — abbreviated variant
 *   - "PART NUMBER <PN>" — when known, signals specificity
 *   - "QUOTE REQUEST - <NSN>" — when one NSN
 *
 * Follow-ups are even terser:
 *   - "Hi <name>"
 *   - "Any update on the quote ?"
 *   - signature
 */

export type RfqLine = {
  nsn?: string;
  partNumber?: string;
  qty: number;
  description?: string;
};

export type RfqInput = {
  recipientFirstName?: string;     // "Matt" — first name if known
  lines: RfqLine[];
  contractContext?: string;         // optional: "Need by <date> for sol <X>"
};

const ABE_SIGNATURE = `Abe Joseph
Ever Ready
300 Liberty Ave
Brooklyn, NY 11207
718-495-4600 # 202
Fax 718-257-6401`;

export function buildSubject(input: RfqInput): string {
  // Single-NSN: include it for searchability on supplier side
  if (input.lines.length === 1 && input.lines[0].nsn) {
    return `QUOTE REQUEST - ${input.lines[0].nsn}`;
  }
  // Single part-number: include it
  if (input.lines.length === 1 && input.lines[0].partNumber) {
    return `PART NUMBER ${input.lines[0].partNumber}`;
  }
  // Multi-line: generic
  return "QUOTE REQUEST";
}

export function buildInitialRfq(input: RfqInput): string {
  const greeting = input.recipientFirstName ? `${input.recipientFirstName},\n\n` : "";

  const nsns = input.lines.filter((l) => l.nsn).map((l) => l.nsn);
  const nsnBlock = nsns.length > 0
    ? `Please quote me on NSN below\n\n${nsns.join("\n")}\n\n`
    : "";

  const partBlocks = input.lines
    .filter((l) => l.partNumber)
    .map((l) => `Part number ${l.partNumber}\nQuantity ${l.qty}`)
    .join("\n\n");

  // If no NSN and no part number, fall back to NSN-style listing of qty
  let body: string;
  if (nsnBlock || partBlocks) {
    body = `${greeting}${nsnBlock}${partBlocks}`;
  } else {
    body = `${greeting}Please quote me on the following:\n\n${input.lines
      .map((l) => `${l.description || "(item)"} - Quantity ${l.qty}`)
      .join("\n\n")}`;
  }

  if (input.contractContext) {
    body += `\n\n${input.contractContext}`;
  }

  body += `\n\n${ABE_SIGNATURE}`;
  return body;
}

export function buildFollowUp(input: { firstName?: string }): string {
  const greeting = input.firstName ? `Hi ${input.firstName}\n` : "Hi,\n";
  return `${greeting}Any update on the quote ?\n\n${ABE_SIGNATURE}`;
}
