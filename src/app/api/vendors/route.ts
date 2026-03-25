import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("q");

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { cageCode: { contains: search, mode: "insensitive" } },
    ];
  }

  const vendors = await prisma.vendor.findMany({
    where,
    include: {
      supplierCatalog: { include: { nsn: true } },
      _count: { select: { supplierCatalog: true, purchaseOrders: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(vendors);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const vendor = await prisma.vendor.create({
    data: {
      name: body.name,
      cageCode: body.cageCode || null,
      contactName: body.contactName || null,
      email: body.email || null,
      phone: body.phone || null,
      website: body.website || null,
      sellsDirectToGov: body.sellsDirectToGov || false,
      pricingType: body.pricingType || "NEGOTIATED",
      notes: body.notes || null,
    },
  });

  return NextResponse.json(vendor, { status: 201 });
}
