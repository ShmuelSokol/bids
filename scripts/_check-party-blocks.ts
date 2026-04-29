import { readFileSync } from "fs";
const dbf = readFileSync("C:\\tmp\\laz\\ref-810-extracted\\ck5_tab.dbf");
const HEADER = 7880;
// Party CAGE codes (10-char) at known offsets from earlier dump
const codeFields: Record<string, number> = {
  B_CODE_CK5: 1245, C_CODE_CK5: 2207, H_CODE_CK5: 3169,
  J_CODE_CK5: 4131, K_CODE_CK5: 5093, M_CODE_CK5: 6055, N_CODE_CK5: 7017,
};
const nameFields: Record<string, number> = {
  B_NAME_CK5: 1255, C_NAME_CK5: 2217, H_NAME_CK5: 3179,
  J_NAME_CK5: 4141, K_NAME_CK5: 5103, M_NAME_CK5: 6065, N_NAME_CK5: 7027,
};
console.log("Party block CAGEs + names from template:");
for (const k of Object.keys(codeFields)) {
  const code = dbf.slice(HEADER + codeFields[k], HEADER + codeFields[k] + 10).toString("latin1").trim();
  const name = dbf.slice(HEADER + nameFields[k.replace("CODE", "NAME") as keyof typeof nameFields]!, HEADER + nameFields[k.replace("CODE", "NAME") as keyof typeof nameFields]! + 80).toString("latin1").trim();
  console.log(`  ${k.padEnd(13)} = "${code.padEnd(7)}"  → ${name.slice(0, 50)}`);
}
