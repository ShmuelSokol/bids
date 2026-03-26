import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { trackEvent, requestContext } from "@/lib/track";

/**
 * GET /api/solicitations/find-suppliers?nsn=...&description=...
 * Searches multiple ways, scrapes results, returns structured supplier data inline.
 */

async function scrapeGoogle(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const resp = await fetch(
      `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!resp.ok) return [];
    const html = await resp.text();
    const results: { title: string; url: string; snippet: string }[] = [];
    // Parse href="/url?q=..." links
    const linkRegex = /href="\/url\?q=(https?[^&"]+)/g;
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      const url = decodeURIComponent(m[1]);
      if (url.includes("google.com") || url.includes("youtube.com") || url.includes("wikipedia.org")) continue;
      // Find title near this link
      const idx = m.index;
      const nearby = html.substring(idx, idx + 500);
      const titleMatch = nearby.match(/>([^<]{10,100})</);
      const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
      results.push({ title, url, snippet: "" });
    }
    return results.slice(0, 8);
  } catch {
    return [];
  }
}

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

  // Run ALL searches in parallel
  const [search1, search2, search3, nsnSources, vendorPrices, pastAwards, masterDb] = await Promise.all([
    // Search 1: wholesale/supplier search
    scrapeGoogle(`"${cleanName}" wholesale supplier price`),
    // Search 2: distributor/bulk search
    scrapeGoogle(`"${cleanName}" distributor buy bulk`),
    // Search 3: NSN-specific search
    scrapeGoogle(`NSN ${nsn} supplier source`),
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

  // Deduplicate web results by domain
  const seen = new Set<string>();
  const webResults: { supplier: string; title: string; url: string; searchType: string }[] = [];
  for (const [results, type] of [[search1, "wholesale"], [search2, "distributor"], [search3, "nsn"]] as const) {
    for (const r of results) {
      try {
        const domain = new URL(r.url).hostname.replace("www.", "");
        if (seen.has(domain)) continue;
        seen.add(domain);
        webResults.push({ supplier: domain, title: r.title.substring(0, 80), url: r.url, searchType: type as string });
      } catch {}
    }
  }

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

  return NextResponse.json({
    nsn,
    description: cleanName,
    webResults: webResults.slice(0, 10),
    nsnApprovedCages: nsnSources,
    vendorPrices,
    pastWinners: pastAwards,
    masterDbMatches: masterDb,
    searchCount: 3,
  });
}
