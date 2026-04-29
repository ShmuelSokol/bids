import { readFileSync } from "fs";
const fpt = readFileSync("C:\\tmp\\laz\\ref-810-extracted\\ck5_tab.FPT");
console.log(`FPT size: ${fpt.length} bytes`);
// VFP FPT header: 4-byte BE next-free-block, 4 zeros, 2-byte BE block size
const nextFree = fpt.readUInt32BE(0);
const blockSize = fpt.readUInt16BE(6);
console.log(`Header: next free block = ${nextFree}, block size = ${blockSize}`);
console.log(`Total blocks used (header + memos): ${fpt.length / blockSize}`);
// Walk memo blocks
let blk = 1;
while (blk < fpt.length / blockSize && blk < nextFree) {
  const offset = blk * blockSize;
  if (offset + 8 > fpt.length) break;
  const type = fpt.readUInt32BE(offset);
  const len = fpt.readUInt32BE(offset + 4);
  if (type < 0 || type > 10 || len < 0 || len > 100000) {
    console.log(`  block ${blk}: invalid header (type=${type} len=${len}) — stopping`);
    break;
  }
  const blocksUsed = Math.ceil((8 + len) / blockSize);
  const data = fpt.slice(offset + 8, offset + 8 + len);
  const preview = data.toString("latin1").replace(/[\r\n]+/g, " ").slice(0, 80);
  console.log(`  block ${blk}: type=${type} len=${len} blocksUsed=${blocksUsed} preview="${preview}"`);
  blk += blocksUsed;
}
