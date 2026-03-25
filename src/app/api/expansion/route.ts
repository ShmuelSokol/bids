import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/expansion
 * Analyzes category expansion opportunities by cross-referencing
 * our supplier catalog against FSC codes and NSN data.
 */
export async function GET() {
  // Get all FSC codes with their NSN counts and our catalog coverage
  const allFscCodes = await prisma.fscCode.findMany({
    include: {
      _count: { select: { nsns: true, solicitations: true } },
      nsns: {
        include: {
          supplierCatalog: { select: { id: true, vendorId: true } },
        },
      },
    },
    orderBy: { code: "asc" },
  });

  const analysis = allFscCodes.map((fsc) => {
    const totalNsns = fsc._count.nsns;
    const nsnsWithSupplier = fsc.nsns.filter(n => n.supplierCatalog.length > 0).length;
    const coveragePercent = totalNsns > 0 ? Math.round((nsnsWithSupplier / totalNsns) * 100) : 0;
    const uniqueVendors = new Set(
      fsc.nsns.flatMap(n => n.supplierCatalog.map(sc => sc.vendorId))
    ).size;

    return {
      code: fsc.code,
      name: fsc.name,
      description: fsc.description,
      isActive: fsc.isActive,
      totalNsns,
      nsnsWithSupplier,
      coveragePercent,
      uniqueVendors,
      solicitationCount: fsc._count.solicitations,
      // Opportunity score: higher = more worth pursuing
      opportunityScore: calculateOpportunityScore(
        fsc.isActive, totalNsns, nsnsWithSupplier, fsc._count.solicitations
      ),
    };
  });

  // Sort by opportunity score descending
  const sorted = analysis.sort((a, b) => b.opportunityScore - a.opportunityScore);

  // Summary stats
  const activeCategories = analysis.filter(a => a.isActive).length;
  const inactiveWithCoverage = analysis.filter(a => !a.isActive && a.nsnsWithSupplier > 0).length;
  const totalUnmappedNsns = analysis.reduce((sum, a) => sum + (a.totalNsns - a.nsnsWithSupplier), 0);

  return NextResponse.json({
    categories: sorted,
    summary: {
      activeCategories,
      inactiveWithCoverage,
      totalUnmappedNsns,
      totalCategories: analysis.length,
    },
  });
}

function calculateOpportunityScore(
  isActive: boolean,
  totalNsns: number,
  nsnsWithSupplier: number,
  solicitationCount: number
): number {
  if (isActive && nsnsWithSupplier === 0 && totalNsns === 0) return 0;

  let score = 0;

  // Inactive categories with supplier coverage = highest opportunity
  if (!isActive && nsnsWithSupplier > 0) {
    score += 50 + nsnsWithSupplier * 10;
  }

  // Active categories with unmapped NSNs = room to grow
  if (isActive && totalNsns > nsnsWithSupplier) {
    score += (totalNsns - nsnsWithSupplier) * 2;
  }

  // More solicitations = more volume potential
  score += solicitationCount * 3;

  // More total NSNs in category = bigger market
  score += totalNsns;

  return score;
}
