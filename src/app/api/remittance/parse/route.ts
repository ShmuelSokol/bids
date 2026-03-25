import { NextRequest, NextResponse } from "next/server";
import { parseRemittance } from "@/lib/remittance-parser";

/**
 * POST /api/remittance/parse
 * Parse a government wire remittance file and match to our invoices.
 *
 * Body: { text: string, wireDate: string, wireReference: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.text) {
    return NextResponse.json({ error: "Missing 'text' field" }, { status: 400 });
  }

  // In production, build this lookup from the database
  // For now, use a mock lookup
  const invoiceLookup = new Map<string, string>([
    ["0045521", "CIN00045521"],
    ["0045520", "CIN00045520"],
    ["004552A", "CIN00045520"],
    ["0045519", "CIN00045519"],
    ["0045518", "CIN00045518"],
    ["004551A", "CIN00045518"],
    ["004551B", "CIN00045518"],
    ["0045517", "CIN00045517"],
  ]);

  const result = parseRemittance(
    body.text,
    body.wireDate || new Date().toISOString().slice(0, 10),
    body.wireReference || "MANUAL",
    invoiceLookup
  );

  return NextResponse.json(result);
}
