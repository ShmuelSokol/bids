import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import ExcelJS from "exceljs";

/**
 * POST /api/so/upload
 *
 * Accepts the LamLinks awards xlsx Abe downloads (the one with
 * CONTRACT_NO / NSN / SHIP_TO_DODAAC columns per Yosef's sample).
 * Parses it, strips today's partial-day rows (matches Yosef's
 * current VBA macro), inserts the rest into so_awards_intake.
 *
 * Returns the batch_id + row count so the UI can kick off validation
 * immediately.
 *
 * Input: multipart/form-data with the xlsx as 'file'.
 */

function excelDateToIso(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v.match(/^\d{4}-\d{2}-\d{2}/)) return new Date(v).toISOString();
  // Excel serial number
  if (typeof v === "number" && v > 25000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString();
  }
  return null;
}

function excelDateToDate(v: any): string | null {
  const iso = excelDateToIso(v);
  return iso ? iso.slice(0, 10) : null;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const ab = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(ab);
  const ws = wb.worksheets[0];
  if (!ws) return NextResponse.json({ error: "no sheet" }, { status: 400 });

  // Header row → column index map (case-insensitive, dots/spaces/underscores flexible)
  const headerIdx: Record<string, number> = {};
  ws.getRow(1).eachCell({ includeEmpty: false }, (c, col) => {
    const key = String(c.value ?? "").trim().toUpperCase().replace(/[\s_]+/g, "");
    headerIdx[key] = col;
  });
  function val(row: ExcelJS.Row, key: string): any {
    const idx = headerIdx[key];
    if (!idx) return null;
    const cell = row.getCell(idx);
    let v: any = cell.value;
    if (v && typeof v === "object") {
      if ("richText" in v) v = (v as any).richText.map((r: any) => r.text).join("");
      else if ("text" in v) v = (v as any).text;
      else if ("result" in v) v = (v as any).result;
    }
    return v;
  }

  // Strip partial-day rows at the trailing edge (matches Yosef's VBA macro).
  // We drop any row whose DATE equals the max DATE in the file — that's
  // today's partial pull; LamLinks is still adding awards as the day
  // progresses, so we only process complete days.
  const allDates: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return;
    const d = excelDateToDate(val(row, "DATE"));
    if (d) allDates.push(d);
  });
  const maxDate = allDates.sort().pop();
  const stripTodayCutoff = maxDate;

  const batchId = `LL-${new Date().toISOString().slice(0, 19).replace(/[:T-]/g, "")}`;
  const inserts: any[] = [];
  let stripped = 0;

  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return;
    const date = excelDateToDate(val(row, "DATE"));
    if (date && stripTodayCutoff && date === stripTodayCutoff) {
      stripped++;
      return;
    }
    const contract = String(val(row, "CONTRACTNO") || val(row, "CONTRACT_NO") || "").trim();
    if (!contract) return; // skip blank rows
    inserts.push({
      batch_id: batchId,
      contract_no: contract,
      piid: String(val(row, "PIID") || "").trim() || null,
      award_date: date,
      clin: String(val(row, "CLIN") || "").trim() || null,
      status: String(val(row, "STATUS") || "").trim() || null,
      nsn: String(val(row, "NSN") || "").trim() || null,
      part_no: String(val(row, "PARTNO") || val(row, "PART_NO") || "").trim() || null,
      rev: String(val(row, "REV") || "").trim() || null,
      quantity: Number(val(row, "QUANTITY")) || null,
      unit_price: Number(val(row, "UNITPRICE") || val(row, "UNIT_PRICE")) || null,
      um: String(val(row, "UM") || "").trim() || null,
      extension: Number(val(row, "EXTENSION")) || null,
      added_to_database: excelDateToIso(val(row, "ADDEDTODATABASE") || val(row, "ADDED_TO_DATABASE")),
      delivery: excelDateToDate(val(row, "DELIVERY")),
      order_no: String(val(row, "ORDERNO") || val(row, "ORDER_NO") || "").trim() || null,
      do_num: String(val(row, "DO#") || val(row, "DO") || val(row, "DO__") || "").trim() || null,
      ship_to_dodaac: String(val(row, "SHIPTODODAAC") || val(row, "SHIP_TO_DODAAC") || "").trim() || null,
      fob: String(val(row, "FOB") || "").trim() || null,
      uploaded_by: user.profile?.full_name || user.user.email || "unknown",
    });
  });

  if (inserts.length === 0) {
    return NextResponse.json({ error: "No rows parsed. Check the file format.", stripped }, { status: 400 });
  }

  const supabase = createServiceClient();
  let saved = 0;
  for (let i = 0; i < inserts.length; i += 200) {
    const chunk = inserts.slice(i, i + 200);
    const { error } = await supabase.from("so_awards_intake").insert(chunk);
    if (error) console.error(`insert error: ${error.message}`);
    else saved += chunk.length;
  }

  return NextResponse.json({
    batch_id: batchId,
    total_rows: inserts.length + stripped,
    saved,
    stripped_today: stripped,
    cutoff_date: stripTodayCutoff,
  });
}
