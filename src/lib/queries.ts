/**
 * Database Query Functions — STUB
 * Legacy Prisma queries. All active pages now use Supabase directly.
 * These stubs prevent build errors from old API routes that still import this.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
export async function getDashboardStats() { return { todaySolicitations: 0, weeklyOrders: 0, outstandingInvoices: 0, totalBids: 0, winRate: 0 }; }
export async function getRecentSolicitations(_limit = 10) { return []; }
export async function getBidHistory(_limit = 10) { return []; }
export async function getOpenSolicitations() { return []; }
export async function getSolicitationDetail(_id: string) { return null; }
export async function getVendors() { return []; }
export async function getSupplierCatalog() { return []; }
export async function getFscCodes() { return []; }
export async function getOrders() { return []; }
export async function getPricingHistory(_nsn: string) { return []; }
export async function getCompetitors() { return []; }
export async function getInvoices() { return []; }
export async function getShipments() { return []; }
export async function getShippingLocations() { return []; }
export async function getAddressOverrides() { return []; }
