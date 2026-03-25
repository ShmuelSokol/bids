import { NextRequest, NextResponse } from "next/server";
import {
  generateBatchEmails,
  generateConsolidatedEmail,
  type OutstandingInvoice,
} from "@/lib/email-templates";

/**
 * POST /api/emails/generate
 * Generate batch follow-up emails for contracting officers.
 *
 * Body: { invoices: OutstandingInvoice[], consolidated?: boolean }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const invoices: OutstandingInvoice[] = body.invoices;
  const consolidated: boolean = body.consolidated ?? true;

  if (!Array.isArray(invoices) || invoices.length === 0) {
    return NextResponse.json({ error: "Expected non-empty array of invoices" }, { status: 400 });
  }

  const { emails, grouped, summary } = generateBatchEmails(invoices);

  if (consolidated) {
    // Generate one email per contracting officer with all their invoices
    const consolidatedEmails = Array.from(grouped.entries()).map(
      ([officerEmail, officerEmails]) => {
        const officerInvoices = invoices.filter(
          i => (i.contractingOfficerEmail || "contracting.officer@dla.mil") === officerEmail
        );
        return generateConsolidatedEmail(officerEmail, officerInvoices);
      }
    );

    return NextResponse.json({
      mode: "consolidated",
      emailCount: consolidatedEmails.length,
      emails: consolidatedEmails,
      summary,
    });
  }

  return NextResponse.json({
    mode: "individual",
    emailCount: emails.length,
    emails,
    summary,
  });
}
