// Read the AX DMF template files Yosef uses so we know the exact column
// schema to generate. We're going to produce sheets that match these
// column-for-column, which lets him "one-touch" import in AX without
// remapping.

import ExcelJS from "exceljs";
import { readdirSync } from "fs";
import * as path from "path";

async function dumpWorkbook(filePath: string) {
  console.log(`\n=== ${path.basename(filePath)} ===`);
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    for (const ws of wb.worksheets) {
      console.log(`\n  Sheet: "${ws.name}" — ${ws.rowCount} rows, ${ws.columnCount} cols`);
      if (ws.rowCount === 0) continue;
      const headers: string[] = [];
      ws.getRow(1).eachCell({ includeEmpty: true }, (cell) => headers.push(String(cell.value ?? "")));
      console.log(`  Columns (${headers.length}): ${headers.join(" | ")}`);
      if (ws.rowCount > 1) {
        console.log(`  Sample row (row 2):`);
        const row2 = ws.getRow(2);
        for (let i = 0; i < Math.min(headers.length, 40); i++) {
          const val = row2.getCell(i + 1).value;
          console.log(`    ${headers[i]} = ${JSON.stringify(val)}`);
        }
      }
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message}`);
  }
}

const docsPath = "\\\\nyevrvdc001\\Users\\ssokol\\Documents";
const candidates = readdirSync(docsPath)
  .filter((f) => f.includes("Purch") || f.includes("New Product Import"))
  .map((f) => path.join(docsPath, f));
console.log(`Found ${candidates.length} template files:`);
for (const c of candidates) console.log(`  ${c}`);
(async () => {
  for (const c of candidates) await dumpWorkbook(c);
})();
