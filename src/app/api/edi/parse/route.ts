import { NextRequest, NextResponse } from "next/server";
import { parseEdiRaw, parseOrder, parseSolicitation } from "@/lib/edi-parser";

/**
 * POST /api/edi/parse
 * Accepts raw EDI text and returns parsed structured data.
 * Supports transaction sets: 850 (orders), 840 (solicitations)
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const rawEdi: string = body.edi;

  if (!rawEdi) {
    return NextResponse.json({ error: "Missing 'edi' field in request body" }, { status: 400 });
  }

  const doc = parseEdiRaw(rawEdi);
  if (!doc) {
    return NextResponse.json({ error: "Could not parse EDI document. Check format." }, { status: 400 });
  }

  let parsed: unknown = null;

  switch (doc.type) {
    case "850":
      parsed = parseOrder(doc);
      break;
    case "840":
      parsed = parseSolicitation(doc);
      break;
    default:
      // Return raw segments for unsupported transaction sets
      parsed = { segments: doc.segments };
  }

  return NextResponse.json({
    transactionType: doc.type,
    sender: doc.sender,
    receiver: doc.receiver,
    controlNumber: doc.controlNumber,
    date: doc.date,
    parsed,
  });
}
