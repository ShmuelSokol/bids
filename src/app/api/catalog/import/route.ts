import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/catalog/import
 * Accepts JSON array of catalog items to upsert into supplier_catalog.
 * Expected format:
 * [{ vendorId, partNumber, nsnCode?, description, ourCost, listPrice }]
 */
export async function POST(req: NextRequest) {
  const items: Array<{
    vendorId: string;
    partNumber: string;
    nsnCode?: string;
    description?: string;
    ourCost?: number;
    listPrice?: number;
  }> = await req.json();

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "Expected array of catalog items" }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  let errors: string[] = [];

  for (const item of items) {
    if (!item.vendorId || !item.partNumber) {
      errors.push(`Missing vendorId or partNumber: ${JSON.stringify(item)}`);
      continue;
    }

    // Resolve NSN if provided
    let nsnId: string | null = null;
    if (item.nsnCode) {
      const nsn = await prisma.nsn.findUnique({ where: { nsnCode: item.nsnCode } });
      if (nsn) {
        nsnId = nsn.id;
      } else {
        errors.push(`NSN ${item.nsnCode} not found for part ${item.partNumber}`);
      }
    }

    const existing = await prisma.supplierCatalog.findUnique({
      where: { vendorId_partNumber: { vendorId: item.vendorId, partNumber: item.partNumber } },
    });

    if (existing) {
      await prisma.supplierCatalog.update({
        where: { id: existing.id },
        data: {
          nsnId: nsnId ?? existing.nsnId,
          description: item.description ?? existing.description,
          ourCost: item.ourCost ?? existing.ourCost,
          listPrice: item.listPrice ?? existing.listPrice,
          lastUpdated: new Date(),
        },
      });
      updated++;
    } else {
      await prisma.supplierCatalog.create({
        data: {
          vendorId: item.vendorId,
          partNumber: item.partNumber,
          nsnId,
          description: item.description,
          ourCost: item.ourCost,
          listPrice: item.listPrice,
          lastUpdated: new Date(),
        },
      });
      created++;
    }
  }

  return NextResponse.json({
    success: true,
    created,
    updated,
    errors: errors.length > 0 ? errors : undefined,
    total: items.length,
  });
}
