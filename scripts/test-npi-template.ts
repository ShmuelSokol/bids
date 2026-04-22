import ExcelJS from "exceljs";

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("\\\\nyevrvdc001\\Users\\ssokol\\Documents\\New Product Import Dashboard.xlsm");
  console.log("Sheets:", wb.worksheets.map((w) => w.name));
  console.log("Has vbaProject:", !!(wb as any).vbaProject);
  // Try writing back as xlsm
  const raw = wb.getWorksheet("RawData");
  if (raw) {
    console.log("RawData row count:", raw.rowCount);
    // Add a test row
    raw.addRow(["TEST001", "Test desc", "THOMAS", "ext-001", "6509-01-123-4567", 12.34]);
  }
  await wb.xlsx.writeFile("C:\\tmp\\dibs-init\\dibs\\tmp\\npi-test-out.xlsm");
  console.log("Wrote test xlsm. Check macros preserved by opening in Excel.");
}
main().catch(console.error);
