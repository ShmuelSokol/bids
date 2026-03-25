/**
 * CSV Parser Utility
 * Handles all CSV imports: supplier catalogs, remittance files,
 * Lamlinks exports, Dynamics AX exports, DIBBS batch files.
 */

export interface CsvParseResult<T> {
  data: T[];
  errors: string[];
  rowCount: number;
  headers: string[];
}

/**
 * Parse CSV text into array of objects using header row as keys
 */
export function parseCsv<T = Record<string, string>>(
  csvText: string,
  options?: { delimiter?: string; skipEmpty?: boolean }
): CsvParseResult<T> {
  const delimiter = options?.delimiter ?? ",";
  const skipEmpty = options?.skipEmpty ?? true;
  const errors: string[] = [];

  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) {
    return { data: [], errors: ["File has no data rows"], rowCount: 0, headers: [] };
  }

  const headers = parseRow(lines[0], delimiter).map(h => h.trim());
  const data: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (skipEmpty && !line) continue;

    const values = parseRow(line, delimiter);
    if (values.length !== headers.length) {
      errors.push(`Row ${i + 1}: expected ${headers.length} columns, got ${values.length}`);
      continue;
    }

    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = values[j]?.trim() ?? "";
    });
    data.push(row as T);
  }

  return { data, errors, rowCount: data.length, headers };
}

/** Parse a single CSV row handling quoted fields */
function parseRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ─── Typed Parsers for Specific Import Formats ─────────────

export interface SupplierCatalogRow {
  vendorId: string;
  partNumber: string;
  nsnCode?: string;
  description?: string;
  ourCost?: string;
  listPrice?: string;
  unitOfMeasure?: string;
}

export function parseSupplierCatalogCsv(csvText: string): CsvParseResult<SupplierCatalogRow> {
  const result = parseCsv<SupplierCatalogRow>(csvText);

  // Validate required fields
  result.data.forEach((row, i) => {
    if (!row.vendorId) result.errors.push(`Row ${i + 2}: missing vendorId`);
    if (!row.partNumber) result.errors.push(`Row ${i + 2}: missing partNumber`);
  });

  return result;
}

export interface RemittanceRow {
  invoiceNumber: string;
  amount: string;
  contractNumber?: string;
  status?: string;
  paymentDate?: string;
}

export function parseRemittanceCsv(csvText: string): CsvParseResult<RemittanceRow> {
  return parseCsv<RemittanceRow>(csvText);
}

export interface AxOrderRow {
  contractNumber: string;
  nsn: string;
  quantity: string;
  unitPrice: string;
  shipTo?: string;
  itemNumber?: string;
  multiple?: string;
}

export function parseAxOrderExport(csvText: string): CsvParseResult<AxOrderRow> {
  return parseCsv<AxOrderRow>(csvText);
}

export interface DibbsBatchRow {
  solicitationNumber: string;
  nsn: string;
  quantity: string;
  unitOfMeasure: string;
  deliveryDays?: string;
  fscCode?: string;
  description?: string;
  shipToAddress?: string;
}

export function parseDibbsBatchFile(csvText: string): CsvParseResult<DibbsBatchRow> {
  return parseCsv<DibbsBatchRow>(csvText);
}

export interface LamlinksExportRow {
  solicitationNumber?: string;
  contractNumber?: string;
  nsn: string;
  description?: string;
  quantity?: string;
  winnerCageCode?: string;
  winnerName?: string;
  winningPrice?: string;
  ourPrice?: string;
  awardDate?: string;
  status?: string;
}

export function parseLamlinksExport(csvText: string): CsvParseResult<LamlinksExportRow> {
  return parseCsv<LamlinksExportRow>(csvText);
}
