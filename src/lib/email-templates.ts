/**
 * Email Template Generator for Contracting Officer Follow-ups
 *
 * Abe sends hundreds of emails to contracting officers for unpaid invoices.
 * Format: Contract number + POD (Proof of Delivery)
 * Root cause: Small depots don't scan/confirm receipt → payment blocked
 */

export interface OutstandingInvoice {
  invoiceNumber: string;
  contractNumber: string;
  amount: number;
  submittedDate: string;
  daysPending: number;
  itemDescription: string;
  shipToLocation: string;
  trackingNumber?: string;
  carrier?: string;
  deliveredDate?: string;
  wafStatus: string;
  contractingOfficerEmail?: string;
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
  invoiceNumber: string;
  contractNumber: string;
}

/**
 * Generate a single follow-up email for an outstanding invoice
 */
export function generateFollowUpEmail(invoice: OutstandingInvoice): EmailDraft {
  const to = invoice.contractingOfficerEmail || "contracting.officer@dla.mil";

  const subject = `Payment Follow-up: Contract ${invoice.contractNumber} - Invoice ${invoice.invoiceNumber}`;

  const podSection = invoice.trackingNumber
    ? `Proof of Delivery:
- Carrier: ${invoice.carrier || "UPS"}
- Tracking: ${invoice.trackingNumber}
- Delivered: ${invoice.deliveredDate || "See tracking"}
`
    : `Proof of delivery available upon request.
`;

  const body = `Dear Contracting Officer,

I am writing to follow up on the status of payment for the following contract:

Contract Number: ${invoice.contractNumber}
Invoice Number: ${invoice.invoiceNumber}
Invoice Amount: $${invoice.amount.toFixed(2)}
Invoice Submitted: ${invoice.submittedDate}
Days Pending: ${invoice.daysPending}
WAWF Status: ${invoice.wafStatus}

Item: ${invoice.itemDescription}
Shipped To: ${invoice.shipToLocation}

${podSection}
This invoice was submitted via WAWF on ${invoice.submittedDate} and has been pending for ${invoice.daysPending} days. Could you please confirm receipt and process for payment?

If there are any issues or additional documentation needed, please let me know and I will provide it promptly.

Thank you for your assistance.

Best regards,
ERG Supply
CAGE Code: 0AG09
`;

  return { to, subject, body, invoiceNumber: invoice.invoiceNumber, contractNumber: invoice.contractNumber };
}

/**
 * Generate batch of follow-up emails grouped by contracting officer
 */
export function generateBatchEmails(invoices: OutstandingInvoice[]): {
  emails: EmailDraft[];
  grouped: Map<string, EmailDraft[]>;
  summary: { totalEmails: number; uniqueOfficers: number; totalAmount: number };
} {
  const emails = invoices.map(generateFollowUpEmail);

  // Group by contracting officer email
  const grouped = new Map<string, EmailDraft[]>();
  for (const email of emails) {
    const existing = grouped.get(email.to) || [];
    existing.push(email);
    grouped.set(email.to, existing);
  }

  const totalAmount = invoices.reduce((s, i) => s + i.amount, 0);

  return {
    emails,
    grouped,
    summary: {
      totalEmails: emails.length,
      uniqueOfficers: grouped.size,
      totalAmount: Math.round(totalAmount * 100) / 100,
    },
  };
}

/**
 * Generate a consolidated email when multiple invoices go to the same CO
 */
export function generateConsolidatedEmail(
  officerEmail: string,
  invoices: OutstandingInvoice[]
): EmailDraft {
  const totalAmount = invoices.reduce((s, i) => s + i.amount, 0);
  const contracts = invoices.map(i => i.contractNumber).join(", ");

  const invoiceList = invoices.map(i =>
    `  - Contract: ${i.contractNumber} | Invoice: ${i.invoiceNumber} | Amount: $${i.amount.toFixed(2)} | Submitted: ${i.submittedDate} | ${i.daysPending} days pending`
  ).join("\n");

  const body = `Dear Contracting Officer,

I am writing to follow up on ${invoices.length} outstanding invoices totaling $${totalAmount.toFixed(2)}:

${invoiceList}

All invoices were submitted via WAWF. Could you please review and confirm receipt for payment processing?

Proof of delivery documentation is available for all shipments upon request.

Thank you for your assistance.

Best regards,
ERG Supply
CAGE Code: 0AG09
`;

  return {
    to: officerEmail,
    subject: `Payment Follow-up: ${invoices.length} Outstanding Invoices ($${totalAmount.toFixed(2)})`,
    body,
    invoiceNumber: invoices.map(i => i.invoiceNumber).join(", "),
    contractNumber: contracts,
  };
}
