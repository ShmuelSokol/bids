import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { trackEvent, requestContext } from "@/lib/track";

/**
 * GET /api/solicitations/find-suppliers?nsn=...&description=...
 * Searches multiple ways, scrapes results, returns structured supplier data inline.
 */

// Google scraping was dropped 2026-04-23 — Railway IPs are rate-limited,
// this returned empty ~90% of the time and cost ~3s per click for nothing.
// Operators now use the External Lookups chips at the bottom of the results
// panel (DIBBS / NSNLookup / GSA / etc.) to reach the sites directly.

async function nsnLookup(nsn: string): Promise<string[]> {
  try {
    const resp = await fetch(`https://www.nsnlookup.com/search?q=${nsn.replace(/-/g, "")}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    // Extract manufacturer/source info
    const matches = html.match(/(?:cage|CAGE|Cage)[:\s]*([A-Z0-9]{5})/g) || [];
    return [...new Set(matches.map(m => m.replace(/[^A-Z0-9]/g, "").slice(-5)))].slice(0, 5);
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const nsn = req.nextUrl.searchParams.get("nsn") || "";
  const description = req.nextUrl.searchParams.get("description") || "";
  const cleanName = description.replace(/[^a-zA-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

  const supabase = createServiceClient();
  const fscPart = nsn.split("-")[0];
  const niinPart = nsn.split("-").slice(1).join("-");

  // Run ALL searches in parallel (Google scraping dropped 2026-04-23)
  const [nsnSources, vendorPrices, pastAwards, masterDb] = await Promise.all([
    // NSN approved sources
    nsnLookup(nsn),
    // Our vendor prices
    supabase.from("nsn_vendor_prices").select("vendor, price, price_source").eq("nsn", nsn).order("price").limit(10).then(r => r.data || []),
    // Past winners
    supabase.from("awards").select("cage, unit_price, award_date").eq("fsc", fscPart).eq("niin", niinPart).order("award_date", { ascending: false }).limit(10).then(r => {
      const map = new Map<string, { cage: string; price: number; wins: number }>();
      for (const a of r.data || []) {
        const c = a.cage?.trim() || "?";
        if (!map.has(c)) map.set(c, { cage: c, price: a.unit_price, wins: 1 });
        else map.get(c)!.wins++;
      }
      return Array.from(map.values()).sort((a, b) => b.wins - a.wins);
    }),
    // Master DB
    (() => {
      const KEY = process.env.MASTERDB_API_KEY;
      if (!KEY) return [];
      return fetch(`https://masterdb.everreadygroup.com/api/dibs/items?nsn=${encodeURIComponent(nsn)}&limit=5`, {
        headers: { "X-Api-Key": KEY }, signal: AbortSignal.timeout(5000),
      }).then(r => r.json()).then(d => (d.results || []).map((r: any) => ({
        sku: r.sku, description: r.description?.substring(0, 60), cost: r.cost, supplier: r.supplier_name,
      }))).catch(() => []);
    })(),
  ]);

  // webResults kept as [] for schema compatibility with older UI code —
  // Google scraping dropped; operators use the externalLookups chips instead.
  const webResults: { supplier: string; title: string; url: string; searchType: string }[] = [];

  // Track supplier search
  const { ip, userAgent } = requestContext(req);
  trackEvent({
    eventType: "search",
    eventAction: "supplier_search",
    page: "/solicitations",
    details: { nsn, description: cleanName, results: webResults.length, vendors: vendorPrices?.length || 0 },
    ip,
    userAgent,
  });

  // External-lookup links — ALWAYS returned. When the Railway box can't
  // scrape Google (blocked / rate-limited) these are Abe's one-click path
  // to the actual authoritative sites. No API costs, no fragile regex —
  // just parameterized URLs he was already visiting manually.
  const nsnDigits = nsn.replace(/-/g, "");
  const externalLookups = [
    { label: "DIBBS awards", url: `https://www.dibbs.bsm.dla.mil/Awards/AwdRecs.aspx?Category=NSN&Value=${encodeURIComponent(nsnDigits)}`, hint: "DLA award history by NSN" },
    { label: "DLA NSN search", url: `https://www.dibbs.bsm.dla.mil/RFQ/RfqRecs.aspx?category=NSN&value=${encodeURIComponent(nsnDigits)}&scope=open`, hint: "Current open DLA RFQs for this NSN" },
    { label: "NSNLookup", url: `https://www.nsnlookup.com/search?q=${encodeURIComponent(nsnDigits)}`, hint: "Approved mfr CAGEs + part numbers" },
    { label: "NATOStockNumber", url: `https://www.natostocknumber.org/?q=${encodeURIComponent(nsn)}`, hint: "Community cross-reference" },
    { label: "GSA Advantage", url: `https://www.gsaadvantage.gov/advantage/ws/search/specific_items?q=${encodeURIComponent(nsnDigits)}`, hint: "GSA schedule sources" },
    { label: "Google (mfr)", url: `https://www.google.com/search?q=${encodeURIComponent(`"${nsn}" OR "${nsnDigits}" manufacturer supplier`)}`, hint: "Open search" },
    { label: "Google (nomenclature)", url: `https://www.google.com/search?q=${encodeURIComponent(`${cleanName} supplier wholesale`)}`, hint: "Nomenclature-based search" },
  ];

  return NextResponse.json({
    nsn,
    description: cleanName,
    webResults: webResults.slice(0, 10),
    nsnApprovedCages: nsnSources,
    vendorPrices,
    pastWinners: pastAwards,
    masterDbMatches: masterDb,
    externalLookups,
    searchCount: 0,
    internalEmpty: (vendorPrices?.length ?? 0) === 0 && (pastAwards?.length ?? 0) === 0 && (masterDb?.length ?? 0) === 0,
    webEmpty: true,
  });
}
