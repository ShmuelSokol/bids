/**
 * Dump the binary structure of the extracted ck5_tab.dbf to understand
 * field offsets, types, and where the per-invoice data lives.
 */
import "./env";
import { readFileSync } from "fs";

const path = process.argv[2] || `${process.env.TEMP}\\laz-extracted\\ck5_tab.dbf`;
const buf = readFileSync(path);
console.log(`File size: ${buf.length} bytes`);

// VFP DBF header (32 bytes)
const fileType = buf[0];
const lastUpdate = `20${String(buf[1]).padStart(2, "0")}-${String(buf[2]).padStart(2, "0")}-${String(buf[3]).padStart(2, "0")}`;
const recordCount = buf.readUInt32LE(4);
const headerLen = buf.readUInt16LE(8);
const recordLen = buf.readUInt16LE(10);
console.log(`\nHeader:`);
console.log(`  File type: 0x${fileType.toString(16).padStart(2, "0")} ${fileType === 0x30 ? "(VFP w/ memo)" : fileType === 0xf5 ? "(VFP with DBC)" : ""}`);
console.log(`  Last update: ${lastUpdate}`);
console.log(`  Record count: ${recordCount}`);
console.log(`  Header length: ${headerLen}`);
console.log(`  Record length: ${recordLen}`);

// Field descriptors start at offset 32, each is 32 bytes, terminated by 0x0D
console.log(`\nField descriptors:`);
console.log(`  ${"Name".padEnd(13)} Type Len Dec Offset`);
let off = 32;
const fields: { name: string; type: string; len: number; dec: number; offsetInRecord: number }[] = [];
let recordOffset = 1; // first byte of record is delete flag
while (off < headerLen && buf[off] !== 0x0d) {
  const name = buf.slice(off, off + 11).toString("latin1").replace(/\0+$/, "");
  const type = String.fromCharCode(buf[off + 11]);
  const len = buf[off + 16];
  const dec = buf[off + 17];
  fields.push({ name, type, len, dec, offsetInRecord: recordOffset });
  console.log(`  ${name.padEnd(13)} ${type}    ${len.toString().padStart(3)} ${dec.toString().padStart(3)} ${recordOffset}`);
  recordOffset += len;
  off += 32;
}

console.log(`\nTotal fields: ${fields.length}`);
console.log(`Record body length (sum of field lengths + 1): ${recordOffset}`);
console.log(`Header field area: ${off}-${headerLen} (terminator at ${off})`);

// Locate the actual record bytes (starts at headerLen)
const recordStart = headerLen;
console.log(`\nRecord 0 starts at byte offset: ${recordStart}`);
console.log(`Record 0 length: ${recordLen} bytes`);

// Show specific high-value fields' contents (the modifiable ones)
const interesting = ["CNTRCT_CK5", "PIIDNO_CK5", "IDNKAJ_CK5", "NSN_CK5", "ORDRNO_CK5", "TCN_CK5", "EDIXML_CK5", "BF5TAB_CK5"];
console.log(`\nField values in record 0:`);
for (const f of fields) {
  if (!interesting.includes(f.name)) continue;
  const val = buf.slice(recordStart + f.offsetInRecord, recordStart + f.offsetInRecord + f.len);
  let display: string;
  if (f.type === "I") {
    display = `int32=${val.readInt32LE(0)}`;
  } else if (f.type === "M") {
    // memo points into FPT
    display = `memo_block=${val.readInt32LE(0)} (4-byte int into FPT)`;
  } else if (f.type === "T") {
    display = `datetime=<${val.length} bytes>`;
  } else {
    display = `"${val.toString("latin1").trim()}"`;
  }
  console.log(`  ${f.name.padEnd(13)} ${display}`);
}
