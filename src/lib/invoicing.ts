/**
 * DIBS Invoice Number Generator
 *
 * Rules from Abe's workflow:
 * - Dynamics AX invoice number format: "CIN00012345"
 * - Government (WAF) only allows 7 characters
 * - Strip "CIN" prefix and leading zeros
 * - For multi-line contracts: append A, B, C suffix
 * - Each contract line MUST have a unique invoice number
 * - WAF 810 = invoice submission
 * - WAF 856 = receipt/ASN
 */

export interface InvoiceLine {
  orderId: string;
  contractNumber: string;
  contractLine: number;
  totalLines: number;
  axInvoiceNumber: string;
  amount: number;
  isFastPay: boolean;
}

export interface GeneratedInvoice {
  orderId: string;
  contractNumber: string;
  contractLine: number;
  axInvoiceNumber: string;
  strippedNumber: string;
  lineSuffix: string | null;
  govInvoiceNumber: string; // final number for WAF
  amount: number;
  wafType: "810" | "856";
  isFastPay: boolean;
}

/**
 * Strip AX invoice number to 7-char government format
 * "CIN00012345" → "0012345"
 * "CIN0001234"  → "0001234"
 */
export function stripAxInvoiceNumber(axNumber: string): string {
  // Remove "CIN" prefix
  let stripped = axNumber.replace(/^CIN/i, "");
  // Take last 7 characters
  if (stripped.length > 7) {
    stripped = stripped.slice(-7);
  }
  // Pad to 7 if shorter
  while (stripped.length < 7) {
    stripped = "0" + stripped;
  }
  return stripped;
}

/**
 * Generate line suffix for multi-line contracts
 * Line 1 = no suffix (or "A" if forced)
 * Line 2 = "A"
 * Line 3 = "B"
 * etc.
 */
export function getLineSuffix(lineNumber: number, totalLines: number): string | null {
  if (totalLines <= 1) return null;
  // Line 1 has no suffix, line 2 = A, line 3 = B, etc.
  if (lineNumber === 1) return null;
  const suffixIndex = lineNumber - 2; // 0-based: A=0, B=1, C=2
  return String.fromCharCode(65 + suffixIndex); // A, B, C, ...
}

/**
 * Generate government invoice number
 */
export function generateGovInvoiceNumber(stripped: string, suffix: string | null): string {
  if (!suffix) return stripped;
  // If adding suffix would exceed 7 chars, truncate stripped
  const maxBaseLength = 7 - suffix.length;
  const base = stripped.slice(-maxBaseLength);
  return base + suffix;
}

/**
 * Process a batch of orders into ready-to-submit invoices
 */
export function generateInvoiceBatch(lines: InvoiceLine[]): GeneratedInvoice[] {
  return lines.map((line) => {
    const stripped = stripAxInvoiceNumber(line.axInvoiceNumber);
    const suffix = getLineSuffix(line.contractLine, line.totalLines);
    const govNumber = generateGovInvoiceNumber(stripped, suffix);

    return {
      orderId: line.orderId,
      contractNumber: line.contractNumber,
      contractLine: line.contractLine,
      axInvoiceNumber: line.axInvoiceNumber,
      strippedNumber: stripped,
      lineSuffix: suffix,
      govInvoiceNumber: govNumber,
      amount: line.amount,
      wafType: "810" as const,
      isFastPay: line.isFastPay,
    };
  });
}
