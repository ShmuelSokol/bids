/**
 * EDI X12 810C Invoice Generator for WAWF Submission
 *
 * Generates ANSI X12 4010 810C (Commercial Invoice) transaction sets
 * that can be submitted to WAWF via:
 *   1. Mil-Pac VAN (~$40/month, easiest)
 *   2. Direct SFTP to ftpwawf.eb.mil (requires DD2875 + JITC cert)
 *   3. GEX connection ($5K-$10K setup)
 *
 * Reference: PIEE EDI Guide Appendix A
 * https://piee.eb.mil/cms/docs/EDI/EDIGuide-AppendixA(810C_Invoice_Invoice2n1_EnergyInvoice_4010).doc
 */

export interface InvoiceForEdi {
  invoiceNumber: string;      // Our invoice number (7-char stripped)
  invoiceDate: string;        // YYYYMMDD
  contractNumber: string;     // SPE2D1-26-C-XXXX
  contractDate: string;       // YYYYMMDD
  shipToName: string;
  shipToAddress: string;
  shipToCity: string;
  shipToState: string;
  shipToZip: string;
  shipToDodaac: string;       // DoD Activity Address Code
  lines: Array<{
    lineNumber: string;       // CLIN number
    nsn: string;
    description: string;
    quantity: number;
    unitOfMeasure: string;
    unitPrice: number;
  }>;
}

interface EdiConfig {
  senderQualifier: string;    // ZZ = mutually defined
  senderId: string;           // Our ID (padded to 15 chars)
  receiverQualifier: string;
  receiverId: string;         // WAWF/GEX receiver ID
  ourCageCode: string;
  ourCompanyName: string;
  ourAddress: string;
  ourCity: string;
  ourState: string;
  ourZip: string;
}

const DEFAULT_CONFIG: EdiConfig = {
  senderQualifier: "ZZ",
  senderId: "0AG09          ", // Padded to 15 chars
  receiverQualifier: "ZZ",
  receiverId: "DFAS           ",
  ourCageCode: "0AG09",
  ourCompanyName: "ERG SUPPLY",
  ourAddress: "123 BUSINESS AVE",
  ourCity: "NEW YORK",
  ourState: "NY",
  ourZip: "10001",
};

let controlNumber = 1;

/**
 * Generate a complete EDI 810C interchange for a batch of invoices
 */
export function generateInvoiceBatchEdi(
  invoices: InvoiceForEdi[],
  config: EdiConfig = DEFAULT_CONFIG
): string {
  const timestamp = new Date();
  const date = formatDate(timestamp, "short"); // YYMMDD
  const time = formatTime(timestamp);           // HHMM
  const isaControl = padNumber(controlNumber++, 9);

  const segments: string[] = [];

  // ISA — Interchange Control Header (always exactly 106 chars before terminator)
  segments.push(
    `ISA*00*          *00*          *${config.senderQualifier}*${config.senderId}*${config.receiverQualifier}*${config.receiverId}*${date}*${time}*U*00401*${isaControl}*0*P*>`
  );

  // GS — Functional Group Header
  segments.push(
    `GS*IN*${config.senderId.trim()}*${config.receiverId.trim()}*${formatDate(timestamp, "long")}*${time}*${controlNumber}*X*004010`
  );

  // Generate each invoice as a separate ST/SE transaction set
  let transactionSetNum = 1;
  for (const invoice of invoices) {
    const stSegments = generateSingleInvoice(invoice, config, transactionSetNum);
    segments.push(...stSegments);
    transactionSetNum++;
  }

  // GE — Functional Group Trailer
  segments.push(`GE*${invoices.length}*${controlNumber}`);

  // IEA — Interchange Control Trailer
  segments.push(`IEA*1*${isaControl}`);

  return segments.join("~\n") + "~";
}

function generateSingleInvoice(
  invoice: InvoiceForEdi,
  config: EdiConfig,
  stNum: number
): string[] {
  const segments: string[] = [];
  const stControl = padNumber(stNum, 4);

  // ST — Transaction Set Header
  segments.push(`ST*810*${stControl}`);

  // BIG — Beginning Segment for Invoice
  // BIG01=invoice date, BIG02=invoice number, BIG03=PO date, BIG04=PO number
  segments.push(
    `BIG*${invoice.invoiceDate}*${invoice.invoiceNumber}*${invoice.contractDate}*${invoice.contractNumber}`
  );

  // REF — Contract Reference
  segments.push(`REF*CT*${invoice.contractNumber}`);

  // N1 Loop — Payee (our company)
  segments.push(`N1*PE*${config.ourCompanyName}*9*${config.ourCageCode}`);
  segments.push(`N3*${config.ourAddress}`);
  segments.push(`N4*${config.ourCity}*${config.ourState}*${config.ourZip}`);

  // N1 Loop — Buying Activity
  segments.push(`N1*PO*DLA*10*${invoice.shipToDodaac}`);

  // N1 Loop — Ship To
  segments.push(`N1*ST*${invoice.shipToName}*10*${invoice.shipToDodaac}`);
  segments.push(`N3*${invoice.shipToAddress}`);
  segments.push(`N4*${invoice.shipToCity}*${invoice.shipToState}*${invoice.shipToZip}`);

  // IT1 Loop — Line Items
  let totalCents = 0;
  for (const line of invoice.lines) {
    const lineTotal = Math.round(line.quantity * line.unitPrice * 100);
    totalCents += lineTotal;
    segments.push(
      `IT1*${line.lineNumber}*${line.quantity}*${line.unitOfMeasure}*${line.unitPrice.toFixed(2)}**FS*${line.nsn}`
    );
    if (line.description) {
      segments.push(`PID*F****${line.description}`);
    }
  }

  // TDS — Total Monetary Value (in cents)
  segments.push(`TDS*${totalCents}`);

  // CTT — Transaction Totals
  segments.push(`CTT*${invoice.lines.length}`);

  // SE — Transaction Set Trailer (count of segments including ST and SE)
  const segCount = segments.length + 1; // +1 for SE itself
  segments.push(`SE*${segCount}*${stControl}`);

  return segments;
}

function formatDate(d: Date, format: "short" | "long"): string {
  const yy = d.getFullYear().toString().slice(-2);
  const yyyy = d.getFullYear().toString();
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return format === "short" ? `${yy}${mm}${dd}` : `${yyyy}${mm}${dd}`;
}

function formatTime(d: Date): string {
  return d.getHours().toString().padStart(2, "0") + d.getMinutes().toString().padStart(2, "0");
}

function padNumber(n: number, length: number): string {
  return n.toString().padStart(length, "0");
}
