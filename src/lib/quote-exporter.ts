/**
 * Batch Quote Exporter for Lamlinks
 *
 * Lamlinks supports batch quote upload — up to ~50 quotes at a time.
 * This generates a file formatted for Lamlinks batch import.
 *
 * From Abe's demo: each quote needs just price + lead time days.
 * Lamlinks batch upload handles the rest (solicitation number, NSN, etc.)
 */

export interface QuoteForExport {
  solicitationNumber: string;
  nsn: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  leadTimeDays: number;
  strategy: string;
  notes?: string;
}

export interface ExportResult {
  csvContent: string;
  quoteCount: number;
  totalValue: number;
  filename: string;
}

/**
 * Generate CSV batch file for Lamlinks quote upload
 */
export function generateLamlinksBatchQuotes(quotes: QuoteForExport[]): ExportResult {
  const headers = [
    "Solicitation Number",
    "NSN",
    "Description",
    "Quantity",
    "Unit Price",
    "Lead Time Days",
    "Strategy",
    "Notes",
  ];

  const rows = quotes.map(q => [
    q.solicitationNumber,
    q.nsn,
    `"${q.itemDescription.replace(/"/g, '""')}"`,
    q.quantity.toString(),
    q.unitPrice.toFixed(2),
    q.leadTimeDays.toString(),
    q.strategy,
    q.notes ? `"${q.notes.replace(/"/g, '""')}"` : "",
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const totalValue = quotes.reduce((s, q) => s + q.unitPrice * q.quantity, 0);
  const date = new Date().toISOString().slice(0, 10);

  return {
    csvContent,
    quoteCount: quotes.length,
    totalValue: Math.round(totalValue * 100) / 100,
    filename: `lamlinks_quotes_${date}.csv`,
  };
}

/**
 * Generate DIBBS-compatible batch quote file
 * Based on DIBBS Batch File Format (DLA spec)
 */
export function generateDibbsBatchQuotes(quotes: QuoteForExport[]): ExportResult {
  // DIBBS batch format is CSV with specific columns
  const headers = [
    "SOLICITATION_NUMBER",
    "UNIT_PRICE",
    "DELIVERY_DAYS",
    "QUANTITY",
  ];

  const rows = quotes.map(q => [
    q.solicitationNumber,
    q.unitPrice.toFixed(2),
    q.leadTimeDays.toString(),
    q.quantity.toString(),
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const totalValue = quotes.reduce((s, q) => s + q.unitPrice * q.quantity, 0);
  const date = new Date().toISOString().slice(0, 10);

  return {
    csvContent,
    quoteCount: quotes.length,
    totalValue: Math.round(totalValue * 100) / 100,
    filename: `dibbs_batch_quotes_${date}.csv`,
  };
}
