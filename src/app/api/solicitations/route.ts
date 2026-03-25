import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const fscCode = searchParams.get("fsc");
  const fobTerms = searchParams.get("fob");
  const breadOnly = searchParams.get("bread") === "true";
  const search = searchParams.get("q");

  const where: Record<string, unknown> = {};

  if (status) where.status = status;
  if (fscCode) where.fscCode = { code: fscCode };
  if (fobTerms) where.fobTerms = fobTerms;
  if (breadOnly) where.isBreadAndButter = true;
  if (search) {
    where.OR = [
      { solicitationNumber: { contains: search, mode: "insensitive" } },
      { nsn: { nsnCode: { contains: search } } },
      { nsn: { description: { contains: search, mode: "insensitive" } } },
    ];
  }

  const solicitations = await prisma.solicitation.findMany({
    where,
    include: {
      nsn: {
        include: {
          bidHistory: {
            orderBy: { awardDate: "desc" },
            take: 10,
          },
          supplierCatalog: {
            include: { vendor: true },
          },
          pricingRules: true,
        },
      },
      fscCode: true,
      lines: {
        include: { shipToLocation: true },
      },
      bids: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(solicitations);
}
