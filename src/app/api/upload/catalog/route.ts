import { NextRequest, NextResponse } from "next/server";
import { parseSupplierCatalogCsv } from "@/lib/csv-parser";
import { prisma } from "@/lib/db";

/**
 * POST /api/upload/catalog
 * Upload a CSV file of supplier catalog items.
 * Parses CSV, validates, and upserts into supplier_catalog table.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    // Fall back to JSON body with CSV text
    const body = await req.json().catch(() => null);
    if (!body?.csvText) {
      return NextResponse.json({ error: "No file or csvText provided" }, { status: 400 });
    }
    return processCsv(body.csvText);
  }

  const text = await file.text();
  return processCsv(text);
}

async function processCsv(csvText: string) {
  const parsed = parseSupplierCatalogCsv(csvText);

  if (parsed.data.length === 0) {
    return NextResponse.json({
      error: "No valid rows found",
      parseErrors: parsed.errors,
    }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  const importErrors: string[] = [...parsed.errors];

  for (const row of parsed.data) {
    if (!row.vendorId || !row.partNumber) continue;

    let nsnId: string | null = null;
    if (row.nsnCode) {
      const nsn = await prisma.nsn.findUnique({ where: { nsnCode: row.nsnCode } });
      if (nsn) nsnId = nsn.id;
      else importErrors.push(`NSN ${row.nsnCode} not found for part ${row.partNumber}`);
    }

    try {
      const existing = await prisma.supplierCatalog.findUnique({
        where: { vendorId_partNumber: { vendorId: row.vendorId, partNumber: row.partNumber } },
      });

      if (existing) {
        await prisma.supplierCatalog.update({
          where: { id: existing.id },
          data: {
            nsnId: nsnId ?? existing.nsnId,
            description: row.description || existing.description,
            ourCost: row.ourCost ? parseFloat(row.ourCost) : existing.ourCost,
            listPrice: row.listPrice ? parseFloat(row.listPrice) : existing.listPrice,
            lastUpdated: new Date(),
          },
        });
        updated++;
      } else {
        await prisma.supplierCatalog.create({
          data: {
            vendorId: row.vendorId,
            partNumber: row.partNumber,
            nsnId,
            description: row.description,
            ourCost: row.ourCost ? parseFloat(row.ourCost) : null,
            listPrice: row.listPrice ? parseFloat(row.listPrice) : null,
            lastUpdated: new Date(),
          },
        });
        created++;
      }
    } catch (err) {
      importErrors.push(`Failed to import ${row.partNumber}: ${err}`);
    }
  }

  return NextResponse.json({
    success: true,
    totalRows: parsed.rowCount,
    created,
    updated,
    errors: importErrors.length > 0 ? importErrors : undefined,
  });
}
