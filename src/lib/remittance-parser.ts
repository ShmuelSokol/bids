/**
 * Government Payment Remittance Parser
 *
 * DLA pays ~3 times per month via wire. Each payment comes with a
 * 200-300 line remittance file. The remittance uses stripped invoice
 * numbers (no CIN prefix, with A/B/C suffixes).
 *
 * This parser:
 * 1. Reads the remittance file (CSV or text)
 * 2. Maps stripped invoice numbers back to our AX numbers
 * 3. Groups by invoice, sums amounts
 * 4. Identifies unmatched lines
 */

import { parseCsv } from "./csv-parser";

export interface RemittanceLine {
  invoiceNumber: string;  // stripped format from government
  amount: number;
  contractNumber?: string;
  deductionCode?: string; // if money is taken back
  description?: string;
}

export interface MatchedPayment {
  govInvoiceNumber: string;
  axInvoiceNumber: string | null;
  amount: number;
  contractNumber: string | null;
  isDeduction: boolean;
  matched: boolean;
}

export interface RemittanceResult {
  wireDate: string;
  wireReference: string;
  totalAmount: number;
  totalCredits: number;
  totalDeductions: number;
  netAmount: number;
  lineCount: number;
  matchedCount: number;
  unmatchedCount: number;
  lines: MatchedPayment[];
  unmatched: MatchedPayment[];
}

/**
 * Parse a remittance file and attempt to match invoice numbers
 * to our internal records.
 *
 * invoiceLookup: map of stripped gov invoice number → AX invoice number
 */
export function parseRemittance(
  text: string,
  wireDate: string,
  wireReference: string,
  invoiceLookup: Map<string, string>
): RemittanceResult {
  // Try CSV parse first
  const csvResult = parseCsv<Record<string, string>>(text);

  let lines: RemittanceLine[];

  if (csvResult.data.length > 0 && csvResult.headers.length >= 2) {
    // CSV format
    lines = csvResult.data.map(row => {
      // Try to find amount and invoice number columns by common names
      const invoiceNum = row["invoiceNumber"] || row["Invoice Number"] || row["Invoice"] ||
                         row["invoice_number"] || row["INVOICE"] || row["Inv#"] || "";
      const amount = row["amount"] || row["Amount"] || row["AMOUNT"] || row["Payment"] || "0";
      const contract = row["contractNumber"] || row["Contract"] || row["CONTRACT"] || row["contract_number"] || "";
      const deduction = row["deductionCode"] || row["Deduction"] || row["Type"] || "";

      return {
        invoiceNumber: invoiceNum.trim(),
        amount: parseFloat(amount.replace(/[$,]/g, "")) || 0,
        contractNumber: contract.trim() || undefined,
        deductionCode: deduction.trim() || undefined,
      };
    }).filter(l => l.invoiceNumber);
  } else {
    // Fallback: try fixed-width or tab-delimited
    lines = text.split(/\r?\n/)
      .filter(line => line.trim())
      .slice(1) // skip header
      .map(line => {
        const parts = line.split(/\t+|\s{2,}/);
        return {
          invoiceNumber: parts[0]?.trim() || "",
          amount: parseFloat((parts[1] || "0").replace(/[$,]/g, "")) || 0,
          contractNumber: parts[2]?.trim() || undefined,
        };
      })
      .filter(l => l.invoiceNumber);
  }

  // Match to our invoices
  const matchedLines: MatchedPayment[] = lines.map(line => {
    const isDeduction = line.amount < 0 || line.deductionCode === "D";
    const axNumber = invoiceLookup.get(line.invoiceNumber) || null;

    return {
      govInvoiceNumber: line.invoiceNumber,
      axInvoiceNumber: axNumber,
      amount: line.amount,
      contractNumber: line.contractNumber || null,
      isDeduction,
      matched: axNumber !== null,
    };
  });

  const credits = matchedLines.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0);
  const deductions = matchedLines.filter(l => l.amount < 0).reduce((s, l) => s + Math.abs(l.amount), 0);
  const unmatched = matchedLines.filter(l => !l.matched);

  return {
    wireDate,
    wireReference,
    totalAmount: credits + deductions,
    totalCredits: Math.round(credits * 100) / 100,
    totalDeductions: Math.round(deductions * 100) / 100,
    netAmount: Math.round((credits - deductions) * 100) / 100,
    lineCount: matchedLines.length,
    matchedCount: matchedLines.filter(l => l.matched).length,
    unmatchedCount: unmatched.length,
    lines: matchedLines,
    unmatched,
  };
}
