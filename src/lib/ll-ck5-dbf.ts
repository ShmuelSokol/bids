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
  // 7 party blocks (B/C/H/J/K/M/N) — pulled per-invoice from ka7_tab via the
  // ka6 link. Any block not provided keeps template values. See PartyLetter
  // for the MIRR-block→letter mapping.
  parties?: Partial<Record<PartyLetter, PartyOverride>>;
}

export interface PartyOverride {
  code?: string;        // 10-char CAGE
  name?: string;        // 80-char
  nam2?: string;
  nam3?: string;
  adr1?: string;
  adr2?: string;
  adr3?: string;
  adr4?: string;
  city?: string;
  stte?: string;        // 2-char
  zipc?: string;        // 10-char
  cntr?: string;
  attn?: string;
  phon?: string;        // 20-char
  faxn?: string;
  emal?: string;
}

/**
 * 7 party blocks (B/C/H/J/K/M/N). Maps to ka7_tab.gduset_ka7 MIRR qualifiers:
 *   B → MIRR 9 Prime Contractor (ERG self)
 *   C → MIRR 10 Administered By (DLA contracting office)
 *   H → MIRR 11 Shipped From (ERG self)
 *   J → MIRR 12 Payment (DEF FIN AND ACCOUNTING)
 *   K → MIRR 13 Shipped To (consignee)
 *   M → MIRR 14 Marked For
 *   N → MIRR 21 Quality Assurance
 */
export type PartyLetter = "B" | "C" | "H" | "J" | "K" | "M" | "N";

const PARTY_BLOCK_OFFSETS: Record<PartyLetter, number> = {
  B: 1233, C: 2195, H: 3157, J: 4119, K: 5081, M: 6043, N: 7005,
};

const PARTY_FIELD_OFFSETS = {
  CODE: 12,  NAME: 22,  NAM2: 102, NAM3: 182,
  ADR1: 262, ADR2: 342, ADR3: 422, ADR4: 502,
  CITY: 582, STTE: 662, ZIPC: 664, CNTR: 674,
  ATTN: 754, PHON: 834, FAXN: 854, EMAL: 874,
} as const;

const PARTY_FIELD_LENGTHS: Record<keyof typeof PARTY_FIELD_OFFSETS, number> = {
  CODE: 10, NAME: 80, NAM2: 80, NAM3: 80,
  ADR1: 80, ADR2: 80, ADR3: 80, ADR4: 80,
  CITY: 80, STTE: 2,  ZIPC: 10, CNTR: 80,
  ATTN: 80, PHON: 20, FAXN: 20, EMAL: 80,
};

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

// ─── FPT (memo file) parsing + rebuilding ───────────────────────────────

const FPT_BLOCK_SIZE = 64;

interface FptBlock {
  idx: number;        // 1-based block index in source FPT
  type: number;       // 1 = memo (text), 0 = unused/picture
  data: Buffer;       // raw memo bytes (no header, no padding)
  blocksUsed: number; // 64-byte blocks this entry occupies
}

function parseFpt(fpt: Buffer): { blocks: FptBlock[]; blockSize: number } {
  const blockSize = fpt.readUInt16BE(6);
  if (blockSize !== FPT_BLOCK_SIZE) {
    throw new Error(`Unexpected FPT block size ${blockSize}`);
  }
  const totalBlocks = Math.floor(fpt.length / blockSize);
  const blocks: FptBlock[] = [];
  let idx = 1;
  while (idx < totalBlocks) {
    const offset = idx * blockSize;
    if (offset + 8 > fpt.length) break;
    const type = fpt.readUInt32BE(offset);
    const len = fpt.readUInt32BE(offset + 4);
    if (type === 0 && len === 0) {
      blocks.push({ idx, type: 0, data: Buffer.alloc(0), blocksUsed: 1 });
      idx += 1;
      continue;
    }
    if (type < 0 || type > 10 || len < 0 || len > 1_000_000) break;
    const blocksUsed = Math.ceil((8 + len) / blockSize);
    const data = fpt.slice(offset + 8, offset + 8 + len);
    blocks.push({ idx, type, data, blocksUsed });
    idx += blocksUsed;
  }
  return { blocks, blockSize };
}

/**
 * Build FPT from a list of memo entries (in the order they should appear).
 * Returns the FPT buffer + a map from each entry's source idx to its new idx
 * so DBF memo pointers can be remapped.
 */
function serializeFpt(entries: FptBlock[]): { fpt: Buffer; idxMap: Map<number, number> } {
  let blocksNeeded = 1; // header
  for (const e of entries) {
    blocksNeeded += e.type === 0 ? 1 : Math.ceil((8 + e.data.length) / FPT_BLOCK_SIZE);
  }
  const fpt = Buffer.alloc(blocksNeeded * FPT_BLOCK_SIZE);
  const idxMap = new Map<number, number>();

  fpt.writeUInt32BE(blocksNeeded, 0);
  fpt.writeUInt16BE(FPT_BLOCK_SIZE, 6);

  let curIdx = 1;
  for (const e of entries) {
    idxMap.set(e.idx, curIdx);
    if (e.type === 0) {
      curIdx += 1;
    } else {
      const offset = curIdx * FPT_BLOCK_SIZE;
      fpt.writeUInt32BE(e.type, offset);
      fpt.writeUInt32BE(e.data.length, offset + 4);
      e.data.copy(fpt, offset + 8);
      curIdx += Math.ceil((8 + e.data.length) / FPT_BLOCK_SIZE);
    }
  }
  return { fpt, idxMap };
}

// ─── Main builder ──────────────────────────────────────────────────────

const RECORD_LEN = 7976;
const HEADER_LEN = 7880;
const FILE_TYPE_BYTE = 0x32;

// All memo fields' offsets in the DBF record body. Each is a 4-byte LE int
// storing the FPT block index (0 = empty).
const MEMO_FIELDS: Record<string, number> = {
  PIDTXT_CK5: 372,
  ADJDES_CK5: 658,
  CLNDES_CK5: 675,
  D25B23_CK5: 687,
  B_NOTE_CK5: 2187, B_NADR_CK5: 2191,
  C_NOTE_CK5: 3149, C_NADR_CK5: 3153,
  H_NOTE_CK5: 4111, H_NADR_CK5: 4115,
  J_NOTE_CK5: 5073, J_NADR_CK5: 5077,
  K_NOTE_CK5: 6035, K_NADR_CK5: 6039,
  M_NOTE_CK5: 6997, M_NADR_CK5: 7001,
  N_NOTE_CK5: 7959, N_NADR_CK5: 7963,
  EDIXML_CK5: 7967,
};

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

  // Helper to write a single field within a party block
  function writePartyField(
    party: PartyLetter,
    fieldName: keyof typeof PARTY_FIELD_OFFSETS,
    value: string | undefined,
  ) {
    if (value === undefined) return; // leave template value
    const len = PARTY_FIELD_LENGTHS[fieldName];
    const off = recordStart + PARTY_BLOCK_OFFSETS[party] + PARTY_FIELD_OFFSETS[fieldName];
    padChar(value, len).copy(dbf, off);
  }

  // Apply per-invoice party overrides
  if (invoice.parties) {
    for (const [letter, p] of Object.entries(invoice.parties) as [PartyLetter, PartyOverride][]) {
      if (!p) continue;
      writePartyField(letter, "CODE", p.code);
      writePartyField(letter, "NAME", p.name);
      writePartyField(letter, "NAM2", p.nam2);
      writePartyField(letter, "NAM3", p.nam3);
      writePartyField(letter, "ADR1", p.adr1);
      writePartyField(letter, "ADR2", p.adr2);
      writePartyField(letter, "ADR3", p.adr3);
      writePartyField(letter, "ADR4", p.adr4);
      writePartyField(letter, "CITY", p.city);
      writePartyField(letter, "STTE", p.stte);
      writePartyField(letter, "ZIPC", p.zipc);
      writePartyField(letter, "CNTR", p.cntr);
      writePartyField(letter, "ATTN", p.attn);
      writePartyField(letter, "PHON", p.phon);
      writePartyField(letter, "FAXN", p.faxn);
      writePartyField(letter, "EMAL", p.emal);
    }
  }

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

  // 6. Rebuild FPT: replace PIDTXT with our NSN's procurement description,
  // keep all other memo blocks (party addresses etc.) verbatim from template.
  // Then update the DBF's memo pointers so they point to the new block indices.
  const { blocks: templateBlocks } = parseFpt(templateFpt);

  // Find the largest type=1 block in template — that's PIDTXT.
  let pidtxtSourceIdx = -1;
  let pidtxtMaxLen = 0;
  for (const b of templateBlocks) {
    if (b.type === 1 && b.data.length > pidtxtMaxLen) {
      pidtxtMaxLen = b.data.length;
      pidtxtSourceIdx = b.idx;
    }
  }

  // Build new entry list: replace pidtxt block's data; keep others as-is
  const pidtxtBytes = Buffer.from(invoice.pidtxt || "", "latin1");
  const newEntries: FptBlock[] = templateBlocks.map((b) => {
    if (b.idx === pidtxtSourceIdx) {
      return { ...b, data: pidtxtBytes };
    }
    return b;
  });

  const { fpt, idxMap } = serializeFpt(newEntries);

  // 7. Walk all DBF memo fields and remap their pointers using idxMap
  for (const [, off] of Object.entries(MEMO_FIELDS)) {
    const oldIdx = dbf.readUInt32LE(recordStart + off);
    if (oldIdx === 0) continue; // empty memo — leave pointer at 0
    const newIdx = idxMap.get(oldIdx);
    if (newIdx === undefined) {
      // Pointer was stale or unmapped — zero it out to be safe
      dbf.writeUInt32LE(0, recordStart + off);
    } else {
      dbf.writeUInt32LE(newIdx, recordStart + off);
    }
  }

  return { dbf, fpt };
}
