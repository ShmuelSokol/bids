import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculatePricingSuggestion } from "@/lib/pricing";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nsnCode: string }> }
) {
  const { nsnCode } = await params;

  const nsn = await prisma.nsn.findUnique({
    where: { nsnCode },
    include: {
      fscCode: true,
      bidHistory: {
        orderBy: { awardDate: "desc" },
        take: 50,
      },
      supplierCatalog: {
        include: { vendor: true },
      },
      competitorActivity: {
        include: { competitor: true },
        orderBy: { awardDate: "desc" },
        take: 20,
      },
      inventory: true,
      pricingRules: true,
      solicitations: {
        where: { status: { in: ["NEW", "REVIEWING"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!nsn) {
    return NextResponse.json({ error: "NSN not found" }, { status: 404 });
  }

  // Find cheapest supplier cost
  const cheapestSupplier = nsn.supplierCatalog
    .filter(sc => sc.ourCost !== null)
    .sort((a, b) => (a.ourCost ?? Infinity) - (b.ourCost ?? Infinity))[0];

  // Calculate pricing suggestion for a typical quantity of 1
  const suggestion = calculatePricingSuggestion({
    ourCost: cheapestSupplier?.ourCost ?? null,
    quantity: 1,
    fobTerms: nsn.fobTerms as "DESTINATION" | "ORIGIN",
    vendorPricingType: cheapestSupplier?.vendor.pricingType as any ?? null,
    vendorSellsDirect: cheapestSupplier?.vendor.sellsDirectToGov ?? false,
    history: nsn.bidHistory.map(bh => ({
      winnerCageCode: bh.winnerCageCode,
      winnerName: bh.winnerName,
      winningPrice: bh.winningPrice,
      ourPrice: bh.ourPrice,
      quantity: bh.quantity,
      awardDate: bh.awardDate,
      weWon: bh.weWon,
    })),
  });

  return NextResponse.json({
    ...nsn,
    cheapestSupplier,
    pricingSuggestion: suggestion,
  });
}
