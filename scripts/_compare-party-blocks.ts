import { readFileSync } from "fs";
const HEADER = 7880;
const codes: Record<string, number> = {
  B: 1245, C: 2207, H: 3169, J: 4131, K: 5093, M: 6055, N: 7017,
};
for (const which of ["TEMPLATE", "CANARY"]) {
  const path = which === "TEMPLATE" ? "C:\\tmp\\laz\\ref-810-extracted\\ck5_tab.dbf" : "C:\\tmp\\laz\\canary\\ck5_tab.dbf";
  const d = readFileSync(path);
  console.log(`\n=== ${which} ===`);
  for (const [k, off] of Object.entries(codes)) {
    const code = d.slice(HEADER + off, HEADER + off + 10).toString("latin1").trim();
    console.log(`  ${k}_CODE = "${code}"`);
  }
}
