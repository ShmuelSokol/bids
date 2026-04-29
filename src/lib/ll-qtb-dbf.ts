/**
 * Build a qtb_tab.dbf + qtb_tab.FPT pair for LL bid (quote) transmission.
 *
 * Companion to ll-ck5-dbf.ts (invoices). Captured 2026-04-29 via procmon
 * during Abe's bid-Post on a fresh envelope (LAM_ID=20635236+20635250,
 * filename A0566701_EVERREADY_7GD0TYKPH.laz, 2111 bytes).
 *
 * Key differences from ck5:
 *   - qtb is MULTI-RECORD (one record per CLIN/bid line); ck5 is one row.
 *   - File type byte is 0x30 (vs 0x32 for ck5).
 *   - Header length 3592, record length 1554, 102 fields.
 *   - Single .laz upload per envelope Post (vs ck5's 810+856 = 2 uploads).
 *   - GENNTE/PKGNTE memo fields exist but were empty in capture.
 *
 * Reference files:
 *   data/ll-templates/bid/qtb_tab.dbf  (6701 bytes, 2 records)
 *   data/ll-templates/bid/qtb_tab.FPT  (2816 bytes)
 *
 * Approach: template-patch. Take template record 0 as a skeleton, replicate
 * once per bid line, overwrite per-line fields at fixed byte offsets, then
 * fix header.recCount + last-modified date.
 */
import { readFileSync } from "fs";
import { join } from "path";

// ─── Per-line data shape ─────────────────────────────────────────────────

export interface QtbBidLineData {
  idnqtb?: number;       // == k34_tab.idnk34 (qtb is the wire-format twin of k34).
                         // Worker passes the just-allocated idnk34. Omit to send 0.
  lam_id: number;        // k11_tab.lam_id_k11 — LL solicitation id
  lamref: string;        // sol part code, e.g. "8920-156-2285"
  lamitm: number;        // sol item idn (k08.idnk08 or similar)
  agency?: string;       // "DoD"
  duedte: Date;          // sol due date
  buycod: string;        // buyer code, e.g. "PEPCA"
  buynam: string;        // buyer name
  buyfax?: string;       // buyer fax
  yp_no: string;         // YP number from sol
  sol_no: string;        // solicitation number, e.g. "SPE8E8-26-T-3183"
  vpn?: string;          // vendor part number (typically blank)
  pn: string;            // mfr part number
  pn_rev?: string;
  mcage: string;         // mfr CAGE
  desc: string;          // description (20 chars)
  nsn: string;           // dashed NSN
  // Supplier (us = ERG / 0AG09) defaults applied if omitted
  scage?: string;
  sname?: string;
  saddr1?: string;
  saddr2?: string;
  scitys?: string;
  szip?: string;
  sfax?: string;
  sphone?: string;
  semail?: string;
  sattn?: string;
  staxid?: string;
  bizsiz?: string;       // "G" (large business)
  // Bid terms
  trmdes?: string;       // "Net 30 days"
  bidtyp?: number;       // 1
  fobcod: "D" | "O";     // Destination/Origin
  shpcty?: string;       // "BROOKLYN, NY"
  valday?: number;       // 90
  allqty?: boolean;      // T = bid all-or-none
  insmat?: string;       // "D"
  inspkg?: string;       // "D"
  hazard?: boolean;
  forign?: boolean;
  newprt?: boolean;
  surpls?: boolean;
  rebilt?: boolean;
  qty_ui: string;        // unit of issue, e.g. "EA"
  solqty: number;        // quantity solicited
  qty1: number;          // tier 1 quantity (usually = solqty)
  qty2?: number;
  qty3?: number;
  up1: number;           // tier 1 unit price
  up2?: number;
  up3?: number;
  aro1: number;          // days ARO tier 1
  aro2?: number;
  aro3?: number;
  // Memos (typically empty for normal bids)
  gennte?: string;       // general note
  pkgnte?: string;       // packaging note
  // Sub-tier vendors (default to us if omitted)
  s1cage?: string; s1name?: string; s1city?: string;
  s2cage?: string; s2name?: string; s2city?: string;
  s3cage?: string; s3name?: string; s3city?: string;
  // Bid-form misc fields
  orgtyp?: string;       // "OE"
  sub_eo?: string;       // "Y4"
  sub_aa?: string;       // "Y6"
  cuntor?: string;       // "United States of America"
  adclin?: string;       // "NC"
  idpo?: string;         // "2"
  hubzsb?: string;       // "N"
  altadr?: string;       // "A"
  chlbor?: string;       // "M"
  bq_sta?: string;       // "included"
  sol_ti?: string;       // "F" (manual) or "T" (DIBBS auto)
}

// ─── Field offsets (relative to record body, after delete flag at offset 0)
//      from _dump-qtb-binary.ts on the captured reference DBF.

interface FieldSpec { offset: number; len: number }

const FIELDS: Record<string, FieldSpec> = {
  IDNQTB:  { offset: 1,    len: 4 },   // I (LL assigns; 0 from us)
  ADTIME:  { offset: 5,    len: 8 },   // T (timestamp)
  IDNQTA:  { offset: 13,   len: 4 },   // I (parent quote-template; 0)
  LAM_ID:  { offset: 17,   len: 4 },   // I
  LAMREF:  { offset: 21,   len: 15 },  // C
  LAMITM:  { offset: 36,   len: 4 },   // I
  AGENCY:  { offset: 40,   len: 6 },
  DUEDTE:  { offset: 46,   len: 8 },   // D YYYYMMDD
  BUYCOD:  { offset: 54,   len: 6 },
  BUYNAM:  { offset: 60,   len: 30 },
  BUYFAX:  { offset: 90,   len: 12 },
  YP_NO:   { offset: 102,  len: 14 },
  SOL_NO:  { offset: 116,  len: 30 },
  VPN:     { offset: 146,  len: 32 },
  PN:      { offset: 178,  len: 32 },
  PN_REV:  { offset: 210,  len: 2 },
  MCAGE:   { offset: 212,  len: 5 },
  DESC:    { offset: 217,  len: 20 },
  NSN:     { offset: 237,  len: 16 },
  SCAGE:   { offset: 253,  len: 5 },
  SNAME:   { offset: 258,  len: 40 },
  SADDR1:  { offset: 298,  len: 40 },
  SADDR2:  { offset: 338,  len: 40 },
  SCITYS:  { offset: 378,  len: 40 },
  SZIP:    { offset: 418,  len: 10 },
  SFAX:    { offset: 428,  len: 12 },
  SPHONE:  { offset: 440,  len: 12 },
  SEMAIL:  { offset: 452,  len: 30 },
  SATTN:   { offset: 482,  len: 30 },
  STITLE:  { offset: 512,  len: 30 },
  STAXID:  { offset: 542,  len: 12 },
  BIZSIZ:  { offset: 554,  len: 1 },
  DISADV:  { offset: 555,  len: 1 },   // L
  WOMOWN:  { offset: 556,  len: 1 },   // L
  S1CAGE:  { offset: 557,  len: 5 },
  S1NAME:  { offset: 562,  len: 40 },
  S1CITY:  { offset: 602,  len: 40 },
  S2CAGE:  { offset: 642,  len: 5 },
  S2NAME:  { offset: 647,  len: 40 },
  S2CITY:  { offset: 687,  len: 40 },
  S3CAGE:  { offset: 727,  len: 5 },
  S3NAME:  { offset: 732,  len: 40 },
  S3CITY:  { offset: 772,  len: 40 },
  TRMDES:  { offset: 812,  len: 30 },
  BIDTYP:  { offset: 842,  len: 4 },   // I
  P0301:   { offset: 846,  len: 2 },
  FOBCOD:  { offset: 848,  len: 1 },
  SHPCTY:  { offset: 849,  len: 40 },
  VALDAY:  { offset: 889,  len: 4 },   // I
  ALLQTY:  { offset: 893,  len: 1 },   // L
  CLIN:    { offset: 894,  len: 6 },
  INSMAT:  { offset: 900,  len: 1 },
  INSPKG:  { offset: 901,  len: 1 },
  HAZARD:  { offset: 902,  len: 1 },   // L
  FORIGN:  { offset: 903,  len: 1 },   // L
  NEWPRT:  { offset: 904,  len: 1 },   // L
  SURPLS:  { offset: 905,  len: 1 },   // L
  REBILT:  { offset: 906,  len: 1 },   // L
  QTYVPP:  { offset: 907,  len: 8 },
  QTYVMP:  { offset: 915,  len: 8 },
  BASPON:  { offset: 923,  len: 20 },
  QMCAGE:  { offset: 943,  len: 5 },
  QSCAGE:  { offset: 948,  len: 5 },
  QPLTNO:  { offset: 953,  len: 20 },
  DLY_AR:  { offset: 973,  len: 1 },   // L
  QTY_UI:  { offset: 974,  len: 2 },
  SOLQTY:  { offset: 976,  len: 4 },   // I
  QTY1:    { offset: 980,  len: 4 },   // I
  QTY2:    { offset: 984,  len: 4 },   // I
  QTY3:    { offset: 988,  len: 4 },   // I
  UP1:     { offset: 992,  len: 12 },  // N(12,4)
  UP2:     { offset: 1004, len: 12 },
  UP3:     { offset: 1016, len: 12 },
  ARO1:    { offset: 1028, len: 4 },   // I
  ARO2:    { offset: 1032, len: 4 },
  ARO3:    { offset: 1036, len: 4 },
  GENNTE:  { offset: 1040, len: 4 },   // M
  PKGNTE:  { offset: 1044, len: 4 },   // M
  DONE:    { offset: 1048, len: 1 },   // L
  DNTIME:  { offset: 1049, len: 8 },   // T
  SENT:    { offset: 1057, len: 1 },   // L
  SNTIME:  { offset: 1058, len: 8 },   // T
  ACKDES:  { offset: 1066, len: 30 },
  AKTIME:  { offset: 1096, len: 8 },   // T
  QREFNO:  { offset: 1104, len: 20 },
  ORGTYP:  { offset: 1124, len: 2 },
  POPNAM:  { offset: 1126, len: 30 },
  POPTIN:  { offset: 1156, len: 16 },
  QPLSID:  { offset: 1172, len: 20 },
  SUB_EO:  { offset: 1192, len: 2 },
  SUB_AA:  { offset: 1194, len: 2 },
  CUNTOR:  { offset: 1196, len: 30 },
  ABPFUN:  { offset: 1226, len: 30 },
  HLQS:    { offset: 1256, len: 30 },
  ADCLIN:  { offset: 1286, len: 3 },
  IDPO:    { offset: 1289, len: 2 },
  HUBZSB:  { offset: 1291, len: 2 },
  ALTADR:  { offset: 1293, len: 2 },
  CHLBOR:  { offset: 1295, len: 2 },
  BQ_STA:  { offset: 1297, len: 12 },
  SOL_TI:  { offset: 1309, len: 1 },
  MQAIDC:  { offset: 1310, len: 4 },   // I
};

// Fields LL fills server-side (we send zero/blank to mirror what UI emits)
const SERVER_FILLED = new Set(["IDNQTB", "IDNQTA", "DONE", "DNTIME", "SENT", "SNTIME", "ACKDES", "AKTIME", "QREFNO", "MQAIDC"]);

// ─── DBF constants ───────────────────────────────────────────────────────

const HEADER_LEN = 3592;
const RECORD_LEN = 1554;
const FILE_TYPE_BYTE = 0x30;

// ─── ERG (us) supplier defaults — match what LL UI auto-populates ────────

const ERG_DEFAULTS = {
  scage: "0AG09",
  sname: "SZY Holdings, LLC",
  saddr1: "10101 FOSTER AVE",
  scitys: "BROOKLYN, NY",
  szip: "11236",
  sfax: "718-257-6401",
  sphone: "718-495-4600",
  semail: "ajoseph@everreadygroup.com",
  sattn: "Abe",
  staxid: "030538101",
  bizsiz: "G",
} as const;

// ─── Field encoders (lifted from ll-ck5-dbf.ts) ──────────────────────────

function padChar(s: string | undefined, len: number): Buffer {
  const b = Buffer.alloc(len, 0x20);
  if (!s) return b;
  const enc = Buffer.from(s, "latin1");
  enc.copy(b, 0, 0, Math.min(enc.length, len));
  return b;
}

function encodeNumeric(n: number | undefined, len: number, decimals = 0): Buffer {
  if (n == null || isNaN(n)) return Buffer.alloc(len, 0x20);
  const s = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString();
  return Buffer.from(s.padStart(len, " ").slice(-len), "latin1");
}

function encodeInt32(n: number | undefined): Buffer {
  const b = Buffer.alloc(4);
  b.writeInt32LE(n ?? 0, 0);
  return b;
}

function encodeBool(v: boolean | undefined): Buffer {
  return Buffer.from(v ? "T" : "F", "latin1");
}

function encodeDate(d: Date | undefined): Buffer {
  if (!d) return Buffer.alloc(8, 0x20);
  const y = d.getUTCFullYear().toString().padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return Buffer.from(`${y}${m}${dd}`, "latin1");
}

function encodeDateTime(d: Date | undefined): Buffer {
  const b = Buffer.alloc(8);
  if (!d) return b;
  const a = Math.floor((14 - (d.getUTCMonth() + 1)) / 12);
  const y = d.getUTCFullYear() + 4800 - a;
  const m = (d.getUTCMonth() + 1) + 12 * a - 3;
  const jdn = d.getUTCDate() + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  const ms = (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()) * 1000 + d.getUTCMilliseconds();
  b.writeInt32LE(jdn, 0);
  b.writeInt32LE(ms, 4);
  return b;
}

function encodeMemoRef(blockIdx: number | undefined): Buffer {
  // VFP memo type 'M' with len=4 stores the block number as 4-byte LE int.
  // Empty memo ref is 4 binary zeros (NOT spaces) per captured reference.
  const b = Buffer.alloc(4, 0x00);
  if (blockIdx && blockIdx > 0) {
    b.writeUInt32LE(blockIdx, 0);
  }
  return b;
}

// ─── GENNTE_QTB control XML wrapper ──────────────────────────────────────
// LL UI emits this 566-byte XML for every record's GENNTE field after Post.
// User-entered general / packaging notes live INSIDE this XML as
// <gennte>...</gennte> and <pkgnte>...</pkgnte>. PKGNTE_QTB memo ref is
// always binary zero — the wrapper carries both notes inline.

function buildGennteXml(gennte?: string, pkgnte?: string): Buffer {
  const xml =
    `<ver_no>1.902</ver_no>` +
    `<procod>1</procod>` +
    `<socode></socode>` +
    `<fatwvr>N</fatwvr>` +
    `<qt_4cg></qt_4cg>` +
    `<nf1cod>D</nf1cod>` +
    `<bunfco></bunfco>` +
    `<nf1_cc></nf1_cc>` +
    `<dferfl>N</dferfl>` +
    `<dffsuc></dffsuc>` +
    `<dfrdpc></dfrdpc>` +
    `<dfdrpa></dfdrpa>` +
    `<tsbprc>B</tsbprc>` +
    `<dethnc></dethnc>` +
    `<ownvet></ownvet>` +
    `<hbzjnv></hbzjnv>` +
    `<hbzpsb></hbzpsb>` +
    `<minqty></minqty>` +
    `<snowup></snowup>` +
    `<sndaro></sndaro>` +
    `<snowqt>0</snowqt>` +
    `<mqnotf></mqnotf>` +
    `<bd9_tab></bd9_tab>` +
    `<bda_tab></bda_tab>` +
    `<pnotes></pnotes>` +
    `<sonote></sonote>` +
    `<hqnote></hqnote>` +
    `<gennte>${gennte ?? ""}</gennte>` +
    `<pkgnte>${pkgnte ?? ""}</pkgnte>` +
    `<qtclas>process_normally</qtclas>` +
    `<qtctyp>validate</qtctyp>`;
  return Buffer.from(xml, "latin1");
}

// ─── FPT helpers ─────────────────────────────────────────────────────────

const FPT_BLOCK_SIZE = 64;

interface MemoEntry { type: number; data: Buffer }

function buildFpt(entries: MemoEntry[]): { fpt: Buffer; idxs: number[] } {
  // Header is 1 block, then each entry takes ceil((8 + len) / 64) blocks.
  let blocksNeeded = 1;
  const idxs: number[] = [];
  for (const e of entries) {
    idxs.push(blocksNeeded);
    blocksNeeded += Math.ceil((8 + e.data.length) / FPT_BLOCK_SIZE);
  }
  const fpt = Buffer.alloc(blocksNeeded * FPT_BLOCK_SIZE);
  fpt.writeUInt32BE(blocksNeeded, 0);
  fpt.writeUInt16BE(FPT_BLOCK_SIZE, 6);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const off = idxs[i] * FPT_BLOCK_SIZE;
    fpt.writeUInt32BE(e.type, off);
    fpt.writeUInt32BE(e.data.length, off + 4);
    e.data.copy(fpt, off + 8);
  }
  return { fpt, idxs };
}

// ─── Build a single record ───────────────────────────────────────────────

function buildRecord(
  line: QtbBidLineData,
  template: Buffer,
  idnqtbBase: number,        // sequential per-record placeholder (we keep 0)
  gennteBlock: number | null,
  pkgnteBlock: number | null,
): Buffer {
  // Start from the template's first record body (so we inherit any
  // template-only field values we don't explicitly patch).
  const rec = Buffer.from(template.subarray(HEADER_LEN, HEADER_LEN + RECORD_LEN));
  rec[0] = 0x20; // delete flag = " " (not deleted)

  function setField(name: keyof typeof FIELDS, buf: Buffer) {
    const f = FIELDS[name];
    if (buf.length !== f.len) {
      throw new Error(`Field ${name} encoded length ${buf.length} != schema length ${f.len}`);
    }
    buf.copy(rec, f.offset);
  }

  // IDNQTB == idnk34_k34. qtb_tab is NOT a SQL table — it's the wire-format
  // wrapper around the k34 record. Captured reference IDs were in the live
  // k34 sequence (kdy_tab idnnam='idnk34'). We pass through the just-allocated
  // idnk34 so the .laz drop reconciles with our k34/k35 SQL rows.
  setField("IDNQTB", encodeInt32(line.idnqtb ?? 0));
  setField("IDNQTA", encodeInt32(0));
  setField("DONE", encodeBool(true));   // Save sets DONE=T; Post is downstream
  setField("DNTIME", encodeDateTime(undefined));
  setField("SENT", encodeBool(false));
  setField("SNTIME", encodeDateTime(undefined));
  padChar("", 30).copy(rec, FIELDS.ACKDES.offset);
  setField("AKTIME", encodeDateTime(undefined));
  padChar("", 20).copy(rec, FIELDS.QREFNO.offset);
  setField("MQAIDC", encodeInt32(0));

  // Timestamp: now
  setField("ADTIME", encodeDateTime(new Date()));

  // Envelope linkage
  setField("LAM_ID", encodeInt32(line.lam_id));
  setField("LAMREF", padChar(line.lamref, 15));
  setField("LAMITM", encodeInt32(line.lamitm));

  // Sol metadata
  setField("AGENCY", padChar(line.agency ?? "DoD", 6));
  setField("DUEDTE", encodeDate(line.duedte));
  setField("BUYCOD", padChar(line.buycod, 6));
  setField("BUYNAM", padChar(line.buynam, 30));
  setField("BUYFAX", padChar(line.buyfax, 12));
  setField("YP_NO", padChar(line.yp_no, 14));
  setField("SOL_NO", padChar(line.sol_no, 30));

  // Item
  setField("VPN", padChar(line.vpn, 32));
  setField("PN", padChar(line.pn, 32));
  setField("PN_REV", padChar(line.pn_rev, 2));
  setField("MCAGE", padChar(line.mcage, 5));
  setField("DESC", padChar(line.desc, 20));
  setField("NSN", padChar(line.nsn, 16));

  // Supplier (ERG defaults)
  setField("SCAGE", padChar(line.scage ?? ERG_DEFAULTS.scage, 5));
  setField("SNAME", padChar(line.sname ?? ERG_DEFAULTS.sname, 40));
  setField("SADDR1", padChar(line.saddr1 ?? ERG_DEFAULTS.saddr1, 40));
  setField("SADDR2", padChar(line.saddr2, 40));
  setField("SCITYS", padChar(line.scitys ?? ERG_DEFAULTS.scitys, 40));
  setField("SZIP", padChar(line.szip ?? ERG_DEFAULTS.szip, 10));
  setField("SFAX", padChar(line.sfax ?? ERG_DEFAULTS.sfax, 12));
  setField("SPHONE", padChar(line.sphone ?? ERG_DEFAULTS.sphone, 12));
  setField("SEMAIL", padChar(line.semail ?? ERG_DEFAULTS.semail, 30));
  setField("SATTN", padChar(line.sattn ?? ERG_DEFAULTS.sattn, 30));
  setField("STITLE", padChar("", 30));
  setField("STAXID", padChar(line.staxid ?? ERG_DEFAULTS.staxid, 12));
  setField("BIZSIZ", padChar(line.bizsiz ?? ERG_DEFAULTS.bizsiz, 1));
  setField("DISADV", encodeBool(false));
  setField("WOMOWN", encodeBool(false));

  // Sub-tier vendors (default: copy of ERG row, mirroring captured behavior)
  setField("S1CAGE", padChar(line.s1cage ?? ERG_DEFAULTS.scage, 5));
  setField("S1NAME", padChar(line.s1name ?? ERG_DEFAULTS.saddr1, 40));
  setField("S1CITY", padChar(line.s1city ?? ERG_DEFAULTS.scitys, 40));
  setField("S2CAGE", padChar(line.s2cage ?? ERG_DEFAULTS.scage, 5));
  setField("S2NAME", padChar(line.s2name ?? ERG_DEFAULTS.saddr1, 40));
  setField("S2CITY", padChar(line.s2city ?? ERG_DEFAULTS.scitys, 40));
  setField("S3CAGE", padChar(line.s3cage ?? ERG_DEFAULTS.scage, 5));
  setField("S3NAME", padChar(line.s3name ?? ERG_DEFAULTS.saddr1, 40));
  setField("S3CITY", padChar(line.s3city ?? ERG_DEFAULTS.scitys, 40));

  // Bid terms
  setField("TRMDES", padChar(line.trmdes ?? "Net 30 days", 30));
  setField("BIDTYP", encodeInt32(line.bidtyp ?? 1));
  setField("P0301", padChar("", 2));
  setField("FOBCOD", padChar(line.fobcod, 1));
  setField("SHPCTY", padChar(line.shpcty ?? "BROOKLYN, NY", 40));
  setField("VALDAY", encodeInt32(line.valday ?? 90));
  setField("ALLQTY", encodeBool(line.allqty ?? true));
  setField("CLIN", padChar("", 6));
  setField("INSMAT", padChar(line.insmat ?? "D", 1));
  setField("INSPKG", padChar(line.inspkg ?? "D", 1));
  setField("HAZARD", encodeBool(line.hazard ?? false));
  setField("FORIGN", encodeBool(line.forign ?? false));
  setField("NEWPRT", encodeBool(line.newprt ?? true));
  setField("SURPLS", encodeBool(line.surpls ?? false));
  setField("REBILT", encodeBool(line.rebilt ?? false));
  setField("QTYVPP", padChar("0", 8));
  setField("QTYVMP", padChar("0", 8));
  setField("BASPON", padChar("", 20));
  setField("QMCAGE", padChar("", 5));
  setField("QSCAGE", padChar("", 5));
  setField("QPLTNO", padChar("", 20));
  setField("DLY_AR", encodeBool(false));
  setField("QTY_UI", padChar(line.qty_ui, 2));
  setField("SOLQTY", encodeInt32(line.solqty));
  setField("QTY1", encodeInt32(line.qty1));
  setField("QTY2", encodeInt32(line.qty2));
  setField("QTY3", encodeInt32(line.qty3));
  setField("UP1", encodeNumeric(line.up1, 12, 4));
  setField("UP2", encodeNumeric(line.up2 ?? 0, 12, 4));
  setField("UP3", encodeNumeric(line.up3 ?? 0, 12, 4));
  setField("ARO1", encodeInt32(line.aro1));
  setField("ARO2", encodeInt32(line.aro2));
  setField("ARO3", encodeInt32(line.aro3));

  // Memos
  setField("GENNTE", encodeMemoRef(gennteBlock ?? undefined));
  setField("PKGNTE", encodeMemoRef(pkgnteBlock ?? undefined));

  // Bid form misc
  setField("ORGTYP", padChar(line.orgtyp ?? "OE", 2));
  setField("POPNAM", padChar("", 30));
  setField("POPTIN", padChar("", 16));
  setField("QPLSID", padChar("", 20));
  setField("SUB_EO", padChar(line.sub_eo ?? "Y4", 2));
  setField("SUB_AA", padChar(line.sub_aa ?? "Y6", 2));
  setField("CUNTOR", padChar(line.cuntor ?? "United States of America", 30));
  setField("ABPFUN", padChar("", 30));
  setField("HLQS", padChar("", 30));
  setField("ADCLIN", padChar(line.adclin ?? "NC", 3));
  setField("IDPO", padChar(line.idpo ?? "2", 2));
  setField("HUBZSB", padChar(line.hubzsb ?? "N", 2));
  setField("ALTADR", padChar(line.altadr ?? "A", 2));
  setField("CHLBOR", padChar(line.chlbor ?? "M", 2));
  setField("BQ_STA", padChar(line.bq_sta ?? "included", 12));
  setField("SOL_TI", padChar(line.sol_ti ?? "F", 1));

  return rec;
}

// ─── Main builder ────────────────────────────────────────────────────────

export function buildQtbDbf(lines: QtbBidLineData[], templatePath: string): { dbf: Buffer; fpt: Buffer } {
  if (lines.length === 0) {
    throw new Error("buildQtbDbf: lines must contain at least 1 bid line");
  }
  const templateDbf = readFileSync(join(templatePath, "qtb_tab.dbf"));

  if (templateDbf[0] !== FILE_TYPE_BYTE) {
    throw new Error(`Template DBF unexpected type byte 0x${templateDbf[0].toString(16)} (expected 0x${FILE_TYPE_BYTE.toString(16)})`);
  }
  if (templateDbf.readUInt16LE(8) !== HEADER_LEN) {
    throw new Error(`Template header length ${templateDbf.readUInt16LE(8)} != ${HEADER_LEN}`);
  }
  if (templateDbf.readUInt16LE(10) !== RECORD_LEN) {
    throw new Error(`Template record length ${templateDbf.readUInt16LE(10)} != ${RECORD_LEN}`);
  }

  // Build FPT: every record gets a GENNTE_QTB control-XML block (mandatory
  // per LL's captured behavior). PKGNTE_QTB ref is always binary zero — the
  // user-facing pkgnte text is nested inside the GENNTE XML wrapper.
  const memoEntries: MemoEntry[] = [];
  const refsResolved: { gen: number | null; pkg: number | null }[] = [];
  for (const line of lines) {
    const xml = buildGennteXml(line.gennte, line.pkgnte);
    memoEntries.push({ type: 1, data: xml });
    refsResolved.push({ gen: -memoEntries.length, pkg: null });
  }
  const { fpt, idxs } = buildFpt(memoEntries);
  for (let i = 0; i < refsResolved.length; i++) {
    if (refsResolved[i].gen != null) {
      refsResolved[i].gen = idxs[-refsResolved[i].gen! - 1];
    }
  }

  // Build header
  const header = Buffer.from(templateDbf.subarray(0, HEADER_LEN));
  const today = new Date();
  header[1] = today.getUTCFullYear() - 2000;
  header[2] = today.getUTCMonth() + 1;
  header[3] = today.getUTCDate();
  header.writeUInt32LE(lines.length, 4);

  // Build records
  const recordsBuf = Buffer.concat(
    lines.map((line, i) => buildRecord(line, templateDbf, i, refsResolved[i].gen, refsResolved[i].pkg))
  );

  // EOF marker (0x1A) — VFP DBFs end with one
  const eof = Buffer.from([0x1a]);

  return { dbf: Buffer.concat([header, recordsBuf, eof]), fpt };
}
