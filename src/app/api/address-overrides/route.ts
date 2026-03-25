import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const overrides = await prisma.addressOverride.findMany({
      include: { shippingLocation: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(overrides);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const override = await prisma.addressOverride.create({
    data: {
      shippingLocationId: body.shippingLocationId,
      overrideAddressLine1: body.overrideAddressLine1,
      overrideAddressLine2: body.overrideAddressLine2 || null,
      overrideCity: body.overrideCity,
      overrideState: body.overrideState,
      overrideZipCode: body.overrideZipCode,
      tcnPrefixRule: body.tcnPrefixRule || null,
      productClassification: body.productClassification || null,
      ruleType: body.ruleType,
      notes: body.notes || null,
    },
    include: { shippingLocation: true },
  });

  return NextResponse.json(override, { status: 201 });
}
