/**
 * EDI X12 Parser for DLA Government Contracts
 *
 * DLA uses ANSI X12 EDI standard. Key transaction sets:
 * - 840: Request for Quotation (solicitation)
 * - 843: Response to RFQ (our quote)
 * - 850: Purchase Order (award/contract)
 * - 810: Invoice
 * - 856: Ship Notice / ASN (Advance Ship Notice)
 * - 997: Functional Acknowledgement
 *
 * EDI files use segment delimiters (usually ~) and element delimiters (usually *)
 * ISA header defines the delimiters in positions 3 (element) and 105 (segment)
 */

export interface EdiDocument {
  type: string; // transaction set ID (840, 850, 810, etc.)
  sender: string;
  receiver: string;
  controlNumber: string;
  date: string;
  segments: EdiSegment[];
  raw: string;
}

export interface EdiSegment {
  id: string; // segment identifier (ISA, GS, ST, BEG, N1, PO1, etc.)
  elements: string[];
}

export interface ParsedOrder {
  contractNumber: string;
  solicitationNumber: string | null;
  orderDate: string;
  shipByDate: string | null;
  buyerName: string | null;
  shipToAddress: {
    name: string;
    line1: string;
    city: string;
    state: string;
    zip: string;
  } | null;
  lines: ParsedOrderLine[];
}

export interface ParsedOrderLine {
  lineNumber: string;
  nsn: string | null;
  partNumber: string | null;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  tcn: string | null;
}

export interface ParsedSolicitation {
  solicitationNumber: string;
  issueDate: string;
  responseDate: string;
  fscCode: string | null;
  nsn: string | null;
  quantity: number;
  unitOfMeasure: string;
  shipToLocations: Array<{
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  }>;
  acceptableParts: Array<{
    cageCode: string;
    partNumber: string;
  }>;
}

/**
 * Parse raw EDI text into segments
 */
export function parseEdiRaw(raw: string): EdiDocument | null {
  if (!raw || raw.length < 106) return null;

  // ISA segment is always 106 characters
  // Element separator is at position 3
  // Segment terminator is at position 105
  const elementSep = raw[3];
  const segmentSep = raw[105];

  // Some files use newlines as additional separators
  const cleanRaw = raw.replace(/\r?\n/g, "");
  const segmentStrings = cleanRaw.split(segmentSep).filter(s => s.trim());

  const segments: EdiSegment[] = segmentStrings.map(seg => {
    const elements = seg.trim().split(elementSep);
    return {
      id: elements[0],
      elements: elements.slice(1),
    };
  });

  // Extract envelope info from ISA segment
  const isa = segments.find(s => s.id === "ISA");
  const gs = segments.find(s => s.id === "GS");
  const st = segments.find(s => s.id === "ST");

  if (!isa || !st) return null;

  return {
    type: st.elements[0] || "UNKNOWN",
    sender: isa.elements[5]?.trim() || "",
    receiver: isa.elements[7]?.trim() || "",
    controlNumber: isa.elements[12]?.trim() || "",
    date: isa.elements[8]?.trim() || "",
    segments,
    raw,
  };
}

/**
 * Parse an EDI 850 (Purchase Order) into a structured order
 */
export function parseOrder(doc: EdiDocument): ParsedOrder | null {
  if (doc.type !== "850") return null;

  const beg = doc.segments.find(s => s.id === "BEG");
  const dtm = doc.segments.find(s => s.id === "DTM");

  // Find ship-to address (N1 segment with qualifier ST)
  let shipTo: ParsedOrder["shipToAddress"] = null;
  for (let i = 0; i < doc.segments.length; i++) {
    const seg = doc.segments[i];
    if (seg.id === "N1" && seg.elements[0] === "ST") {
      const n3 = doc.segments[i + 1]?.id === "N3" ? doc.segments[i + 1] : null;
      const n4 = doc.segments[i + 2]?.id === "N4" ? doc.segments[i + 2] :
                 doc.segments[i + 1]?.id === "N4" ? doc.segments[i + 1] : null;
      shipTo = {
        name: seg.elements[1] || "",
        line1: n3?.elements[0] || "",
        city: n4?.elements[0] || "",
        state: n4?.elements[1] || "",
        zip: n4?.elements[2] || "",
      };
      break;
    }
  }

  // Parse line items (PO1 segments)
  const lines: ParsedOrderLine[] = [];
  for (const seg of doc.segments) {
    if (seg.id === "PO1") {
      lines.push({
        lineNumber: seg.elements[0] || "",
        nsn: extractNsn(seg.elements),
        partNumber: extractPartNumber(seg.elements),
        description: "", // Usually in PID segment following PO1
        quantity: parseInt(seg.elements[1] || "0", 10),
        unitOfMeasure: seg.elements[2] || "EA",
        unitPrice: parseFloat(seg.elements[3] || "0"),
        tcn: null, // Usually in REF segment
      });
    }
  }

  // Enrich line descriptions from PID segments
  let lineIdx = 0;
  for (const seg of doc.segments) {
    if (seg.id === "PID" && lineIdx < lines.length) {
      lines[lineIdx].description = seg.elements[4] || "";
    }
    if (seg.id === "PO1") lineIdx++;
  }

  return {
    contractNumber: beg?.elements[2] || "",
    solicitationNumber: beg?.elements[3] || null,
    orderDate: beg?.elements[4] || "",
    shipByDate: dtm?.elements[1] || null,
    buyerName: null,
    shipToAddress: shipTo,
    lines,
  };
}

/**
 * Parse an EDI 840 (Request for Quotation) into a structured solicitation
 */
export function parseSolicitation(doc: EdiDocument): ParsedSolicitation | null {
  if (doc.type !== "840") return null;

  const bqt = doc.segments.find(s => s.id === "BQT");
  const dtmSegments = doc.segments.filter(s => s.id === "DTM");

  const solicitation: ParsedSolicitation = {
    solicitationNumber: bqt?.elements[2] || "",
    issueDate: bqt?.elements[4] || "",
    responseDate: dtmSegments.find(d => d.elements[0] === "002")?.elements[1] || "",
    fscCode: null,
    nsn: null,
    quantity: 0,
    unitOfMeasure: "EA",
    shipToLocations: [],
    acceptableParts: [],
  };

  // Extract line items for NSN and quantity
  for (const seg of doc.segments) {
    if (seg.id === "PO1" || seg.id === "RQT") {
      solicitation.quantity = parseInt(seg.elements[1] || "0", 10);
      solicitation.unitOfMeasure = seg.elements[2] || "EA";
      solicitation.nsn = extractNsn(seg.elements);
    }
  }

  // Extract FSC from NSN (first 4 digits)
  if (solicitation.nsn && solicitation.nsn.length >= 4) {
    solicitation.fscCode = solicitation.nsn.substring(0, 4);
  }

  return solicitation;
}

/** Extract NSN from PO1 element array (look for qualifier FS or NS) */
function extractNsn(elements: string[]): string | null {
  for (let i = 0; i < elements.length - 1; i++) {
    if ((elements[i] === "FS" || elements[i] === "NS") && elements[i + 1]) {
      return elements[i + 1];
    }
  }
  return null;
}

/** Extract part number from PO1 element array (look for qualifier VP or MG) */
function extractPartNumber(elements: string[]): string | null {
  for (let i = 0; i < elements.length - 1; i++) {
    if ((elements[i] === "VP" || elements[i] === "MG" || elements[i] === "IN") && elements[i + 1]) {
      return elements[i + 1];
    }
  }
  return null;
}
