import { readFileSync } from "fs";
const fpt = readFileSync("C:\\tmp\\laz\\canary\\ck5_tab.FPT");
console.log(`Size: ${fpt.length}, next free block: ${fpt.readUInt32BE(0)}, block size: ${fpt.readUInt16BE(6)}`);
let blk = 1;
const total = fpt.length / 64;
while (blk < total) {
  const off = blk * 64;
  const t = fpt.readUInt32BE(off);
  const l = fpt.readUInt32BE(off + 4);
  if (t === 0 && l === 0) { blk += 1; continue; }
  if (t < 0 || t > 10 || l < 0 || l > 1_000_000) break;
  const used = Math.ceil((8 + l) / 64);
  const data = fpt.slice(off + 8, off + 8 + l);
  console.log(`  block ${blk}: type=${t} len=${l} used=${used} preview="${data.toString("latin1").replace(/[\r\n]+/g, " ").slice(0, 70)}"`);
  blk += used;
}

// Also: read DBF memo pointers to confirm they're remapped correctly
const dbf = readFileSync("C:\\tmp\\laz\\canary\\ck5_tab.dbf");
const HEADER = 7880;
const memoFields: Record<string, number> = {
  PIDTXT_CK5: 372, ADJDES_CK5: 658, CLNDES_CK5: 675, D25B23_CK5: 687,
  B_NOTE_CK5: 2187, B_NADR_CK5: 2191,
  C_NOTE_CK5: 3149, C_NADR_CK5: 3153,
  H_NOTE_CK5: 4111, H_NADR_CK5: 4115,
  J_NOTE_CK5: 5073, J_NADR_CK5: 5077,
  K_NOTE_CK5: 6035, K_NADR_CK5: 6039,
  M_NOTE_CK5: 6997, M_NADR_CK5: 7001,
  N_NOTE_CK5: 7959, N_NADR_CK5: 7963,
  EDIXML_CK5: 7967,
};
console.log("\n=== DBF memo pointers ===");
for (const [name, off] of Object.entries(memoFields)) {
  const ptr = dbf.readUInt32LE(HEADER + off);
  if (ptr > 0) console.log(`  ${name.padEnd(15)} → block ${ptr}`);
}
