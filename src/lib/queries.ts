/**
 * Database Query Functions
 * Centralized Prisma queries used by server components across all pages.
 * Each function handles its own error gracefully, returning empty/default
 * data if the database isn't connected yet.
 */

import { prisma } from "./db";
import { calculatePricingSuggestion, type PricingSuggestion } from "./pricing";

// ─── Dashboard Queries ──────────────────────────────────────

export async function getDashboardStats() {
  try {
    const [solicitationCount, orderCount, invoiceCount, bidHistoryCount] = await Promise.all([
      prisma.solicitation.count({ where: { status: { in: ["NEW", "REVIEWING"] } } }),
      prisma.order.count({ where: { status: { notIn: ["SHIPPED", "DELIVERED"] } } }),
      prisma.invoice.count({ where: { status: { in: ["SUBMITTED", "OVERDUE"] } } }),
      prisma.bidHistory.count(),
    ]);

    const wins = await prisma.bidHistory.count({ where: { weWon: true } });
    const winRate = bidHistoryCount > 0 ? Math.round((wins / bidHistoryCount) * 100) : 0;

    return { solicitationCount, orderCount, invoiceCount, winRate, bidHistoryCount };
  } catch {
    return { solicitationCount: 0, orderCount: 0, invoiceCount: 0, winRate: 0, bidHistoryCount: 0 };
  }
}

export async function getRecentSolicitations(limit = 8) {
  try {
    return await prisma.solicitation.findMany({
      include: { nsn: true, fscCode: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

export async function getRecentAwards(limit = 5) {
  try {
    return await prisma.bidHistory.findMany({
      include: { nsn: true },
      orderBy: { awardDate: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

// ─── Solicitation Queries ───────────────────────────────────

export async function getSolicitations(filters?: {
  status?: string;
  fscCode?: string;
  breadOnly?: boolean;
  search?: string;
}) {
  try {
    const where: Record<string, unknown> = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.fscCode) where.fscCode = { code: filters.fscCode };
    if (filters?.breadOnly) where.isBreadAndButter = true;
    if (filters?.search) {
      where.OR = [
        { solicitationNumber: { contains: filters.search, mode: "insensitive" } },
        { nsn: { nsnCode: { contains: filters.search } } },
        { nsn: { description: { contains: filters.search, mode: "insensitive" } } },
      ];
    }

    return await prisma.solicitation.findMany({
      where,
      include: {
        nsn: {
          include: {
            bidHistory: { orderBy: { awardDate: "desc" }, take: 10 },
            supplierCatalog: { include: { vendor: true } },
          },
        },
        fscCode: true,
        lines: true,
        bids: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export async function getSolicitationWithPricing(solicitationId: string) {
  try {
    const solicitation = await prisma.solicitation.findUnique({
      where: { solicitationNumber: solicitationId },
      include: {
        nsn: {
          include: {
            bidHistory: { orderBy: { awardDate: "desc" }, take: 20 },
            supplierCatalog: { include: { vendor: true } },
            competitorActivity: { include: { competitor: true }, orderBy: { awardDate: "desc" }, take: 10 },
            inventory: true,
          },
        },
        fscCode: true,
        lines: { include: { shipToLocation: true } },
        bids: { orderBy: { createdAt: "desc" } },
        parts: { include: { vendor: true } },
      },
    });

    if (!solicitation) return null;

    // Calculate pricing suggestion
    const cheapestSupplier = solicitation.nsn.supplierCatalog
      .filter(sc => sc.ourCost !== null)
      .sort((a, b) => (a.ourCost ?? Infinity) - (b.ourCost ?? Infinity))[0];

    const suggestion = calculatePricingSuggestion({
      ourCost: cheapestSupplier?.ourCost ?? null,
      quantity: solicitation.totalQuantity,
      fobTerms: solicitation.fobTerms as "DESTINATION" | "ORIGIN",
      vendorPricingType: cheapestSupplier?.vendor.pricingType as any ?? null,
      vendorSellsDirect: cheapestSupplier?.vendor.sellsDirectToGov ?? false,
      history: solicitation.nsn.bidHistory.map(bh => ({
        winnerCageCode: bh.winnerCageCode,
        winnerName: bh.winnerName,
        winningPrice: bh.winningPrice,
        ourPrice: bh.ourPrice,
        quantity: bh.quantity,
        awardDate: bh.awardDate,
        weWon: bh.weWon,
      })),
      shipToZip: solicitation.lines[0]?.shipToZip,
    });

    return { ...solicitation, pricingSuggestion: suggestion, cheapestSupplier };
  } catch {
    return null;
  }
}

// ─── Vendor & Catalog Queries ───────────────────────────────

export async function getVendors() {
  try {
    return await prisma.vendor.findMany({
      include: {
        _count: { select: { supplierCatalog: true, purchaseOrders: true } },
      },
      orderBy: { name: "asc" },
    });
  } catch {
    return [];
  }
}

export async function getSupplierCatalog() {
  try {
    return await prisma.supplierCatalog.findMany({
      include: { vendor: true, nsn: true },
      orderBy: { vendor: { name: "asc" } },
    });
  } catch {
    return [];
  }
}

// ─── FSC Code Queries ───────────────────────────────────────

export async function getFscCodes() {
  try {
    return await prisma.fscCode.findMany({
      include: {
        _count: { select: { nsns: true, solicitations: true } },
      },
      orderBy: { code: "asc" },
    });
  } catch {
    return [];
  }
}

// ─── Order Queries ──────────────────────────────────────────

export async function getOrders(status?: string) {
  try {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    return await prisma.order.findMany({
      where,
      include: {
        contract: true,
        nsn: true,
        sourceVendor: true,
        shipment: { include: { shippingLocation: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

// ─── Analytics Queries ──────────────────────────────────────

export async function getWinRateByFsc() {
  try {
    const history = await prisma.bidHistory.findMany({
      include: { nsn: { include: { fscCode: true } } },
    });

    const fscStats = new Map<string, { code: string; name: string; wins: number; losses: number }>();

    for (const h of history) {
      const fsc = h.nsn.fscCode;
      const key = fsc.code;
      const existing = fscStats.get(key) || { code: fsc.code, name: fsc.name, wins: 0, losses: 0 };
      if (h.weWon) existing.wins++;
      else existing.losses++;
      fscStats.set(key, existing);
    }

    return Array.from(fscStats.values())
      .map(s => ({ ...s, rate: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate);
  } catch {
    return [];
  }
}

export async function getCompetitors() {
  try {
    return await prisma.competitor.findMany({
      include: {
        activity: { orderBy: { awardDate: "desc" }, take: 5 },
        _count: { select: { activity: true } },
      },
      orderBy: { name: "asc" },
    });
  } catch {
    return [];
  }
}

// ─── Invoicing Queries ──────────────────────────────────────

export async function getOutstandingInvoices() {
  try {
    return await prisma.invoice.findMany({
      where: { status: { in: ["SUBMITTED", "OVERDUE", "PARTIAL"] } },
      include: {
        order: { include: { contract: true, nsn: true } },
        paymentFollowups: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { submittedAt: "asc" },
    });
  } catch {
    return [];
  }
}

// ─── Shipping Queries ───────────────────────────────────────

export async function getShipments(status?: string) {
  try {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    return await prisma.shipment.findMany({
      include: {
        order: { include: { contract: true, nsn: true } },
        shippingLocation: true,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export async function getShippingLocations() {
  try {
    return await prisma.shippingLocation.findMany({
      include: {
        _count: { select: { shipments: true, addressOverrides: true } },
      },
      orderBy: { name: "asc" },
    });
  } catch {
    return [];
  }
}

export async function getAddressOverrides() {
  try {
    return await prisma.addressOverride.findMany({
      include: { shippingLocation: true },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}
