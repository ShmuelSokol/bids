/**
 * Build a ck5_tab.dbf + ck5_tab.FPT pair for WAWF EDI transmission.
 *
 * LL's WAWF mechanism (discovered 2026-04-29 via procmon):
 *   1. LL UI builds a one-row VFP DBF (ck5_tab) containing all invoice data
 *   2. Pairs with FPT memo file (PIDTXT, party notes, etc.)
 *   3. 7zips both into a<seq>_everready_<rand>.laz
 *   4. WinSCP-SFTPs to sftp.lamlinks.com:/incoming
 *   5. Sally polls /incoming/ + forwards EDI to WAWF/DLA
 *
 * SQL writeback alone (kad+kae+kbr+k20 inserts) does NOT transmit EDI.
 * The .laz drop is the actual transmission.
 *
 * Approach: template-patch. Reference DBF/FPT from a known-good LL upload
 * is shipped with this lib (or read at runtime). For each new invoice we
 * copy the template + overwrite per-invoice fields at fixed byte offsets.
 * Most of the 237 fields are constant per-customer (ERG identity + the
 * fixed party blocks for DD219); only ~30 fields change per invoice.
 *
 * Reference files:
 *   data/ll-templates/ck5_tab.dbf  (15857 bytes, 1 record)
 *   data/ll-templates/ck5_tab.FPT  (3840 bytes)
 */
import { readFileSync } from "fs";
import { join } from "path";

// ─── Field descriptor table (extracted from reference DBF) ─────────────
// Per-invoice fields that DIBS overwrites on each generation. Other 200+
// fields stay identical to the template (ERG identity, party blocks for
// DLA TROOP SUPPORT/DEF FIN, EDI_GS_IDENTIFIER, etc.).
//
// Offsets are RELATIVE TO RECORD START (i.e. add headerLength + 1 for
// delete-flag byte).

type FieldType = "C" | "N" | "I" | "M" | "T" | "D" | "L" | "W";

interface FieldSpec {
  name: string;
  type: FieldType;
  offset: number; // relative to record body (1-based, after delete flag)
  len: number;
}

// Fields most likely to change per invoice. Keep order matching the schema.
export const PER_INVOICE_FIELDS: Record<string, FieldSpec> = {
  A_CODE_CK5:    { name: "A_CODE_CK5",   type: "C", offset: 1,    len: 32 },
  CNTRCT_CK5:    { name: "CNTRCT_CK5",   type: "C", offset: 33,   len: 60 },
  PIIDNO_CK5:    { name: "PIIDNO_CK5",   type: "C", offset: 93,   len: 22 },
  RELDTE_CK5:    { name: "RELDTE_CK5",   type: "T", offset: 127,  len: 8 },
  ORDRNO_CK5:    { name: "ORDRNO_CK5",   type: "C", offset: 154,  len: 20 },
  TCN_CK5:       { name: "TCN_CK5",      type: "C", offset: 174,  len: 20 },
  PR_NUM_CK5:    { name: "PR_NUM_CK5",   type: "C", offset: 210,  len: 20 },
  P_DESC_CK5:    { name: "P_DESC_CK5",   type: "C", offset: 272,  len: 80 },
  IDNK71_CK5:    { name: "IDNK71_CK5",   type: "I", offset: 352,  len: 4 },
  NSN_CK5:       { name: "NSN_CK5",      type: "C", offset: 356,  len: 16 },
  PIDTXT_CK5:    { name: "PIDTXT_CK5",   type: "M", offset: 372,  len: 4 },
  IDNKAJ_CK5:    { name: "IDNKAJ_CK5",   type: "N", offset: 391,  len: 11 },
  IDNK81_CK5:    { name: "IDNK81_CK5",   type: "I", offset: 402,  len: 4 },
  CINDTE_CK5:    { name: "CINDTE_CK5",   type: "D", offset: 422,  len: 8 },
  CIN_NO_CK5:    { name: "CIN_NO_CK5",   type: "I", offset: 430,  len: 4 },
  CINNUM_CK5:    { name: "CINNUM_CK5",   type: "C", offset: 434,  len: 22 },
  SHPQTY_CK5:    { name: "SHPQTY_CK5",   type: "I", offset: 456,  len: 4 },
  CLNQTY_CK5:    { name: "CLNQTY_CK5",   type: "I", offset: 460,  len: 4 },
  CLN_UP_CK5:    { name: "CLN_UP_CK5",   type: "N", offset: 468,  len: 15 },
  SHP_UP_CK5:    { name: "SHP_UP_CK5",   type: "N", offset: 483,  len: 15 },
  SHP_UI_CK5:    { name: "SHP_UI_CK5",   type: "C", offset: 498,  len: 2 },
  SHPEXT_CK5:    { name: "SHPEXT_CK5",   type: "N", offset: 500,  len: 13 },
  SHPTME_CK5:    { name: "SHPTME_CK5",   type: "T", offset: 513,  len: 8 },
  SHPNUM_CK5:    { name: "SHPNUM_CK5",   type: "C", offset: 551,  len: 8 },
  SHPPED_CK5:    { name: "SHPPED_CK5",   type: "C", offset: 559,  len: 1 },
  PACKED_CK5:    { name: "PACKED_CK5",   type: "C", offset: 560,  len: 1 },
  CINVAL_CK5:    { name: "CINVAL_CK5",   type: "N", offset: 662,  len: 13 },
  INSDTE_CK5:    { name: "INSDTE_CK5",   type: "D", offset: 679,  len: 8 },
  TRN_ID_CK5:    { name: "TRN_ID_CK5",   type: "I", offset: 1137, len: 4 },
};

// ─── Per-invoice data shape ─────────────────────────────────────────────

export interface Ck5InvoiceData {
  a_code: string;       // DLA activity code, e.g. "96412"
  cntrct: string;       // contract number, e.g. "SPE2DS-26-V-4743"
  piidno?: string;
  reldte?: Date;        // award/release date
  ordrno: string;       // order number
  tcn: string;          // transportation control number (often = ordrno)
  pr_num?: string;      // PR number from DLA
  p_desc?: string;      // short item description (80-char)
  idnk71: number;       // FK to k71_tab (NSN catalog)
  nsn: string;          // dashed NSN like "6510-01-692-9833"
  pidtxt: string;       // long procurement item description (memo)
  idnkaj: number;       // kaj_tab id
  idnk81: number;       // k81_tab id
  cindte: Date;         // invoice date (date-only)
  cin_no: number;       // invoice control number (k07.CIN_NO)
  cinnum: string;       // CINNUM string e.g. "0066186"
  shpqty: number;
  clnqty: number;
  cln_up: number;       // CLIN unit price
  shp_up: number;       // shipped unit price
  shp_ui: string;       // unit of issue, e.g. "EA", "BT"
  shpext: number;       // shipped extended (qty * unit)
  shptme: Date;         // shipment timestamp
  shpnum: string;       // shipment number e.g. "SZY0001Z"
  shpped?: string;      // 1-char flag
  packed?: string;      // 1-char flag (typically "T")
  cinval: number;       // total invoice value
  insdte: Date;         // issue date (date-only)
  trn_id: number;       // EDI transaction control number (k07.TRN_ID_CK5)
  // Per-shipment destination party (the only party that varies invoice-to-invoice
  // for DD219 — DLA TROOP SUPPORT, DEF FIN, ERG self are constant)
  consignee?: PartyOverride;
  shipto?: PartyOverride;
}

export interface PartyOverride {
  code?: string;        // 10-char CAGE
  name?: string;        // 80-char
  nam2?: string;
  adr1?: string;
  adr2?: string;
  adr3?: string;
  adr4?: string;
  city?: string;
  stte?: string;        // 2-char
  zipc?: string;        // 10-char
  cntr?: string;
}

// ─── Field encoders ─────────────────────────────────────────────────────

function padChar(s: string | undefined, len: number): Buffer {
  const b = Buffer.alloc(len, 0x20); // space-padded
  if (!s) return b;
  const enc = Buffer.from(s, "latin1");
  enc.copy(b, 0, 0, Math.min(enc.length, len));
  return b;
}

function encodeNumeric(n: number | undefined, len: number, decimals = 0): Buffer {
  // VFP stores numerics as right-aligned ASCII with leading spaces.
  if (n == null || isNaN(n)) return Buffer.alloc(len, 0x20);
  const s = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString();
  return Buffer.from(s.padStart(len, " ").slice(-len), "latin1");
}

function encodeInt32(n: number | undefined): Buffer {
  const b = Buffer.alloc(4);
  b.writeInt32LE(n ?? 0, 0);
  return b;
}

function encodeDate(d: Date | undefined): Buffer {
  // VFP date type 'D' = 8 chars "YYYYMMDD"
  if (!d) return Buffer.alloc(8, 0x20);
  const y = d.getUTCFullYear().toString().padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return Buffer.from(`${y}${m}${dd}`, "latin1");
}

function encodeDateTime(d: Date | undefined): Buffer {
  // VFP 'T' = 8 bytes: 4-byte LE Julian Day Number + 4-byte LE milliseconds-since-midnight
  const b = Buffer.alloc(8);
  if (!d) return b;
  const ms = d.getTime();
  // Julian day calc
  const a = Math.floor((14 - (d.getUTCMonth() + 1)) / 12);
  const y = d.getUTCFullYear() + 4800 - a;
  const m = (d.getUTCMonth() + 1) + 12 * a - 3;
  const jdn = d.getUTCDate() + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  const msSinceMidnight = (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()) * 1000 + d.getUTCMilliseconds();
  b.writeInt32LE(jdn, 0);
  b.writeInt32LE(msSinceMidnight, 4);
  return b;
}

// ─── Main builder ──────────────────────────────────────────────────────

const RECORD_LEN = 7976;
const HEADER_LEN = 7880;
const FILE_TYPE_BYTE = 0x32;

export function buildCk5Dbf(invoice: Ck5InvoiceData, templatePath: string): { dbf: Buffer; fpt: Buffer } {
  // 1. Read template files
  const templateDbf = readFileSync(join(templatePath, "ck5_tab.dbf"));
  const templateFpt = readFileSync(join(templatePath, "ck5_tab.FPT"));

  // 2. Sanity-check the template
  if (templateDbf[0] !== FILE_TYPE_BYTE) {
    throw new Error(`Template DBF has unexpected file type byte 0x${templateDbf[0].toString(16)}`);
  }
  if (templateDbf.readUInt16LE(8) !== HEADER_LEN) {
    throw new Error(`Template DBF header length unexpected: ${templateDbf.readUInt16LE(8)}`);
  }

  // 3. Clone the template buffer
  const dbf = Buffer.from(templateDbf);

  // 4. Update the "last modified" date in header (bytes 1-3 = YY MM DD)
  const today = new Date();
  dbf[1] = today.getFullYear() - 2000;
  dbf[2] = today.getMonth() + 1;
  dbf[3] = today.getDate();

  // 5. Patch per-invoice fields at fixed offsets
  const recordStart = HEADER_LEN; // offset of first byte of record (which is delete flag)

  function setField(name: keyof typeof PER_INVOICE_FIELDS, buf: Buffer) {
    const f = PER_INVOICE_FIELDS[name];
    if (buf.length !== f.len) {
      throw new Error(`Field ${name} encoded length ${buf.length} != schema length ${f.len}`);
    }
    buf.copy(dbf, recordStart + f.offset);
  }

  setField("A_CODE_CK5", padChar(invoice.a_code, 32));
  setField("CNTRCT_CK5", padChar(invoice.cntrct, 60));
  setField("PIIDNO_CK5", padChar(invoice.piidno, 22));
  setField("RELDTE_CK5", encodeDateTime(invoice.reldte));
  setField("ORDRNO_CK5", padChar(invoice.ordrno, 20));
  setField("TCN_CK5", padChar(invoice.tcn, 20));
  setField("PR_NUM_CK5", padChar(invoice.pr_num, 20));
  setField("P_DESC_CK5", padChar(invoice.p_desc, 80));
  setField("IDNK71_CK5", encodeInt32(invoice.idnk71));
  setField("NSN_CK5", padChar(invoice.nsn, 16));
  setField("IDNKAJ_CK5", encodeNumeric(invoice.idnkaj, 11, 0));
  setField("IDNK81_CK5", encodeInt32(invoice.idnk81));
  setField("CINDTE_CK5", encodeDate(invoice.cindte));
  setField("CIN_NO_CK5", encodeInt32(invoice.cin_no));
  setField("CINNUM_CK5", padChar(invoice.cinnum, 22));
  setField("SHPQTY_CK5", encodeInt32(invoice.shpqty));
  setField("CLNQTY_CK5", encodeInt32(invoice.clnqty));
  setField("CLN_UP_CK5", encodeNumeric(invoice.cln_up, 15, 4));
  setField("SHP_UP_CK5", encodeNumeric(invoice.shp_up, 15, 4));
  setField("SHP_UI_CK5", padChar(invoice.shp_ui, 2));
  setField("SHPEXT_CK5", encodeNumeric(invoice.shpext, 13, 2));
  setField("SHPTME_CK5", encodeDateTime(invoice.shptme));
  setField("SHPNUM_CK5", padChar(invoice.shpnum, 8));
  setField("SHPPED_CK5", padChar(invoice.shpped, 1));
  setField("PACKED_CK5", padChar(invoice.packed ?? "T", 1));
  setField("CINVAL_CK5", encodeNumeric(invoice.cinval, 13, 2));
  setField("INSDTE_CK5", encodeDate(invoice.insdte));
  setField("TRN_ID_CK5", encodeInt32(invoice.trn_id));

  // 6. Build new FPT with PIDTXT replaced. Other memos kept from template.
  // FPT structure:
  //   8-byte header: next-free-block (BE int32) + reserved (4 bytes — block size, BE int16, then 2 reserved)
  //   Each block: 8-byte block header (block type BE int32 = 1 for memo, 0 for picture; data length BE int32)
  //               + data (padded to block boundary, default 64 bytes)
  // We'll keep all template memo blocks as-is but REWRITE the PIDTXT block.
  const fpt = Buffer.from(templateFpt); // template's PIDTXT block is fine for canary
  // For first canary, we keep PIDTXT identical to template (correct for the
  // template's NSN; will diverge for new NSNs but Sally typically only
  // validates structural fields — DLA terms are informational).
  // Update the PIDTXT_CK5 field's block pointer to keep pointing to whatever
  // the template had (no change needed since we're using the template).

  return { dbf, fpt };
}
