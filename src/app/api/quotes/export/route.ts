import { NextRequest, NextResponse } from "next/server";
import { generateLamlinksBatchQuotes, generateDibbsBatchQuotes, type QuoteForExport } from "@/lib/quote-exporter";

/**
 * POST /api/quotes/export
 * Generate batch quote export file for Lamlinks or DIBBS.
 *
 * Body: { quotes: QuoteForExport[], format: "lamlinks" | "dibbs" }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const quotes: QuoteForExport[] = body.quotes;
  const format: string = body.format || "lamlinks";

  if (!Array.isArray(quotes) || quotes.length === 0) {
    return NextResponse.json({ error: "Expected non-empty array of quotes" }, { status: 400 });
  }

  const result = format === "dibbs"
    ? generateDibbsBatchQuotes(quotes)
    : generateLamlinksBatchQuotes(quotes);

  // Return as downloadable CSV
  if (body.download) {
    return new NextResponse(result.csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  }

  return NextResponse.json(result);
}
