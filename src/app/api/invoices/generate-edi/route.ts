import { NextRequest, NextResponse } from "next/server";
import { generateInvoiceBatchEdi, type InvoiceForEdi } from "@/lib/edi-generator";

/**
 * POST /api/invoices/generate-edi
 *
 * Accepts an array of invoices and generates an EDI X12 810C file
 * ready for submission to WAWF via Mil-Pac VAN or direct SFTP.
 *
 * This replaces the 45 min/day of clicking in LamLinks.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const invoices: InvoiceForEdi[] = body.invoices;

  if (!Array.isArray(invoices) || invoices.length === 0) {
    return NextResponse.json(
      { error: "Expected non-empty array of invoices" },
      { status: 400 }
    );
  }

  const ediContent = generateInvoiceBatchEdi(invoices);

  // Return as downloadable EDI file
  if (body.download) {
    return new NextResponse(ediContent, {
      headers: {
        "Content-Type": "application/edi-x12",
        "Content-Disposition": `attachment; filename="invoices_${new Date().toISOString().slice(0, 10)}.edi"`,
      },
    });
  }

  return NextResponse.json({
    success: true,
    invoiceCount: invoices.length,
    ediContent,
    submissionOptions: {
      milpacVan: {
        description: "Submit via Mil-Pac VAN (~$40/month)",
        steps: [
          "Sign up at milpac.com",
          "Upload this EDI file to Mil-Pac portal",
          "Mil-Pac routes to GEX → WAWF automatically",
        ],
      },
      directSftp: {
        description: "Submit via SFTP to ftpwawf.eb.mil",
        note: "Requires DD2875 form + JITC certification. May not be onboarding new vendors.",
        host: "ftpwawf.eb.mil",
        protocol: "SFTP/SSH2",
      },
    },
  });
}
