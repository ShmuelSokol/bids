import { NextRequest, NextResponse } from "next/server";
import { generateInvoiceBatchEdi, type InvoiceForEdi } from "@/lib/edi-generator";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * POST /api/invoices/generate-edi
 *
 * Accepts an array of invoices and generates an EDI X12 810C file ready for
 * submission to WAWF via Mil-Pac VAN or direct SFTP.
 *
 * Persists each invoice to the `invoices` table with its generated EDI so:
 *   - duplicate gov_invoice_number generation is rejected up front
 *   - the EDI content survives the browser tab closing
 *   - /api/remittance/parse can match DLA wire lines back to real invoices
 *
 * Replaces ~45 min/day of clicking in LamLinks.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.profile?.must_reset_password) {
    return NextResponse.json(
      { error: "Password reset required" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const invoices: InvoiceForEdi[] = body.invoices;

  if (!Array.isArray(invoices) || invoices.length === 0) {
    return NextResponse.json(
      { error: "Expected non-empty array of invoices" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const generatedBy = user.profile?.full_name || user.user.email || "unknown";

  // Collision check: reject if any gov_invoice_number already exists. The
  // 7-char format is deterministic from contract+line-index, so stripping
  // twice on the same contract would silently produce a conflict otherwise.
  const numbers = invoices.map((i) => i.invoiceNumber).filter(Boolean);
  if (numbers.length === 0) {
    return NextResponse.json(
      { error: "Every invoice must have an invoiceNumber" },
      { status: 400 }
    );
  }
  const { data: existing, error: existingErr } = await supabase
    .from("invoices")
    .select("gov_invoice_number")
    .in("gov_invoice_number", numbers);
  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }
  const collisions = existing?.map((r) => r.gov_invoice_number) || [];
  if (collisions.length > 0) {
    return NextResponse.json(
      {
        error: "Duplicate invoice number(s)",
        collisions,
        hint: "Use a different line suffix or pick a different contract.",
      },
      { status: 409 }
    );
  }

  // Generate EDI content for the whole batch (one file, multiple transactions).
  const ediContent = generateInvoiceBatchEdi(invoices);

  // Persist each invoice + its lines. Use individual inserts rather than
  // one big upsert so we can report partial success cleanly.
  const savedIds: number[] = [];
  const saveErrors: { invoice: string; error: string }[] = [];
  for (const inv of invoices) {
    const total = (inv.lines || []).reduce(
      (s: number, l: any) => s + (l.extendedAmount || 0),
      0
    );
    const { data: row, error: insErr } = await supabase
      .from("invoices")
      .insert({
        gov_invoice_number: inv.invoiceNumber,
        contract_number: inv.contractNumber,
        contract_date: inv.contractDate || null,
        invoice_date: inv.invoiceDate || new Date().toISOString().split("T")[0],
        total_amount: total,
        ship_to_name: inv.shipToName,
        ship_to_address: inv.shipToAddress,
        ship_to_city: inv.shipToCity,
        ship_to_state: inv.shipToState,
        ship_to_zip: inv.shipToZip,
        ship_to_dodaac: inv.shipToDodaac,
        line_count: (inv.lines || []).length,
        edi_content: ediContent, // whole batch — allows re-download later
        status: "generated",
        generated_by: generatedBy,
      })
      .select("id")
      .single();

    if (insErr || !row) {
      saveErrors.push({ invoice: inv.invoiceNumber, error: insErr?.message || "insert failed" });
      continue;
    }

    const lineRows = (inv.lines || []).map((l: any, idx: number) => ({
      invoice_id: row.id,
      line_number: idx + 1,
      nsn: l.nsn,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      extended_amount: l.extendedAmount,
      uom: l.uom || "EA",
    }));
    if (lineRows.length > 0) {
      await supabase.from("invoice_lines").insert(lineRows);
    }
    savedIds.push(row.id);
  }

  // Audit log
  await supabase.from("sync_log").insert({
    action: "invoice_generated",
    details: {
      user: generatedBy,
      invoice_count: invoices.length,
      saved_count: savedIds.length,
      saved_ids: savedIds,
      errors: saveErrors,
    },
  });

  // Return as downloadable EDI file if requested
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
    savedCount: savedIds.length,
    savedIds,
    saveErrors,
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
