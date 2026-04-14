import { NextRequest, NextResponse } from "next/server";
import { parseRemittance } from "@/lib/remittance-parser";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * POST /api/remittance/parse
 * Parse a government wire remittance file and match to our invoices.
 *
 * Body: { text: string, wireDate: string, wireReference: string }
 *
 * Matching now queries the `invoices` table for real gov_invoice_number
 * rows instead of the previous hardcoded 8-entry mock. Results (plus the
 * raw pasted text) are persisted to `remittance_records` so wire history
 * is queryable, and each matched invoice is updated to `status=paid` with
 * its wire_reference for audit.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();

  if (!body.text) {
    return NextResponse.json({ error: "Missing 'text' field" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const wireDate = body.wireDate || new Date().toISOString().slice(0, 10);
  const wireReference = body.wireReference || "MANUAL";

  // Build a lookup of gov_invoice_number → id by loading every recent
  // invoice. Paginate to stay under the Supabase 1K default limit as the
  // table grows.
  const invoiceLookup = new Map<string, string>();
  const idByNumber = new Map<string, number>();
  let page = 0;
  while (true) {
    const { data: rows } = await supabase
      .from("invoices")
      .select("id, gov_invoice_number")
      .order("created_at", { ascending: false })
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!rows || rows.length === 0) break;
    for (const r of rows) {
      // The parser's map is keyed by stripped gov invoice number; since
      // that's exactly what we store, value can mirror the key. Downstream
      // "axInvoiceNumber" is populated when we wire AX — for now, null.
      invoiceLookup.set(r.gov_invoice_number, r.gov_invoice_number);
      idByNumber.set(r.gov_invoice_number, r.id);
    }
    if (rows.length < 1000) break;
    page++;
    if (page >= 20) break; // safety cap
  }

  const result = parseRemittance(body.text, wireDate, wireReference, invoiceLookup);

  // Persist the remittance batch (upsert on (wire_date, wire_reference))
  const { data: remitRow, error: remitErr } = await supabase
    .from("remittance_records")
    .upsert(
      {
        wire_date: wireDate,
        wire_reference: wireReference,
        total_amount: result.totalAmount,
        total_credits: result.totalCredits,
        total_deductions: result.totalDeductions,
        net_amount: result.netAmount,
        line_count: result.lineCount,
        matched_count: result.matchedCount,
        unmatched_count: result.unmatchedCount,
        raw_text: body.text,
        parsed_lines: result.lines,
        unmatched_lines: result.unmatched,
        imported_by: user.profile?.full_name || user.user.email,
      },
      { onConflict: "wire_date,wire_reference" }
    )
    .select("id")
    .single();

  if (remitErr) {
    return NextResponse.json(
      { error: remitErr.message, warning: "Remittance could not be persisted", ...result },
      { status: 500 }
    );
  }

  // Mark matched invoices as paid with the wire reference.
  const paidUpdates = result.lines
    .filter((l) => l.matched && !l.isDeduction)
    .map((l) => idByNumber.get(l.govInvoiceNumber))
    .filter((id): id is number => typeof id === "number");

  if (paidUpdates.length > 0) {
    await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: wireDate,
        wire_reference: wireReference,
      })
      .in("id", paidUpdates);
  }

  return NextResponse.json({
    ...result,
    remittance_id: remitRow?.id,
    invoices_marked_paid: paidUpdates.length,
  });
}
