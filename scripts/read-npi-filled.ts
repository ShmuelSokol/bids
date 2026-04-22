import ExcelJS from "exceljs";
import * as path from "path";

async function dump(filePath: string, maxRowsPerSheet = 3) {
  console.log(`\n\n########## ${path.basename(filePath)} ##########`);
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    for (const ws of wb.worksheets) {
      console.log(`\n===== Sheet: "${ws.name}"  (${ws.rowCount} rows × ${ws.columnCount} cols) =====`);
      if (ws.rowCount === 0) continue;
      const headers: string[] = [];
      ws.getRow(1).eachCell({ includeEmpty: true }, (cell) => headers.push(String(cell.value ?? "")));
      console.log(`Headers: ${headers.join(" | ")}`);
      for (let r = 2; r <= Math.min(ws.rowCount, maxRowsPerSheet + 1); r++) {
        const row = ws.getRow(r);
        const vals: any[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => vals.push(cell.value));
        console.log(`  row ${r}: ${vals.map((v) => (v && typeof v === "object" && "result" in v ? v.result : v)).join(" | ")}`);
      }
    }
  } catch (e: any) {
    console.log(`ERROR: ${e.message}`);
  }
}

(async () => {
  for (const f of [
    "\\\\nyevrvdc001\\Users\\ssokol\\Documents\\NPI 8-7-19.xlsx",
    "\\\\nyevrvdc001\\Users\\ssokol\\Documents\\NPI 11-17-15.xlsx",
  ]) {
    await dump(f, 2);
  }
})();
