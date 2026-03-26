import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

/**
 * GET /api/solicitations/find-suppliers?nsn=6515-01-234-5678&description=APPLICATOR+DISPOSABLE
 *
 * Returns:
 * 1. Past award winners for this NSN (who supplied it before)
 * 2. Approved sources from NSN databases
 * 3. Our catalog matches (Master DB items with this NSN)
 * 4. Search URLs for external supplier sites
 */
export async function GET(req: NextRequest) {
  const nsn = req.nextUrl.searchParams.get("nsn") || "";
  const description = req.nextUrl.searchParams.get("description") || "";
  const fsc = nsn.slice(0, 4);

  const supabase = createServiceClient();

  // 1. Past award winners from our data
  const fscPart = nsn.split("-")[0];
  const niinPart = nsn.split("-").slice(1).join("-");
  const { data: pastAwards } = await supabase
    .from("awards")
    .select("cage, unit_price, quantity, award_date, contract_number")
    .eq("fsc", fscPart)
    .eq("niin", niinPart)
    .order("award_date", { ascending: false })
    .limit(10);

  // Group by CAGE to find unique winners
  const winnerMap = new Map<string, { cage: string; lastPrice: number; lastDate: string; wins: number }>();
  for (const a of pastAwards || []) {
    const cage = a.cage?.trim() || "UNKNOWN";
    if (!winnerMap.has(cage)) {
      winnerMap.set(cage, { cage, lastPrice: a.unit_price, lastDate: a.award_date, wins: 1 });
    } else {
      winnerMap.get(cage)!.wins++;
    }
  }
  const pastWinners = Array.from(winnerMap.values()).sort((a, b) => b.wins - a.wins);

  // 2. Approved sources via nsnlookup.com
  let approvedSources: { nsn: string; name: string; manufacturers: string[] }[] = [];
  try {
    const nsnClean = nsn.replace(/-/g, "");
    const resp = await fetch(
      `https://www.nsnlookup.com/search?q=${nsnClean}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (resp.ok) {
      const html = await resp.text();
      // Extract item name
      const nameMatch = html.match(/class="item-name[^"]*"[^>]*>([^<]+)/);
      const itemName = nameMatch ? nameMatch[1].trim() : description;

      // Extract manufacturer/CAGE info from the page
      const cageMatches = html.match(/CAGE[:\s]+(\w{5})/gi) || [];
      const mfrs = cageMatches.map((m) => m.replace(/CAGE[:\s]+/i, "").trim());

      approvedSources = [{ nsn, name: itemName, manufacturers: [...new Set(mfrs)] }];
    }
  } catch {}

  // 3. Master DB catalog check
  let masterDbMatches: any[] = [];
  try {
    const KEY = process.env.MASTERDB_API_KEY;
    if (KEY) {
      const resp = await fetch(
        `https://masterdb.everreadygroup.com/api/dibs/items?nsn=${encodeURIComponent(nsn)}&limit=5`,
        { headers: { "X-Api-Key": KEY }, signal: AbortSignal.timeout(5000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        masterDbMatches = (data.results || []).map((r: any) => ({
          sku: r.sku,
          description: r.description,
          cost: r.cost,
          supplier: r.supplier_name,
          mfr_part: r.mfr_part_number,
        }));
      }
    }
  } catch {}

  // 4. Vendor prices from our D365 data
  const { data: vendorPrices } = await supabase
    .from("nsn_vendor_prices")
    .select("vendor, price, price_source")
    .eq("nsn", nsn)
    .order("price", { ascending: true })
    .limit(10);

  // 5. Build search URLs
  const searchName = description.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
  const isMedical = ["6505", "6510", "6515", "6520", "6530", "6532", "6540", "6545", "6550"].includes(fsc);
  const isHardware = ["5305", "5310", "5315", "5330", "5340", "5360"].includes(fsc);
  const isSafety = ["4240", "4210", "4220"].includes(fsc);
  const isLab = ["6630", "6640", "6665", "6685"].includes(fsc);

  const searches = [
    {
      name: "Google Shopping",
      url: `https://www.google.com/search?q=${encodeURIComponent(searchName + " buy price")}&tbm=shop`,
      icon: "google",
      always: true,
    },
    {
      name: "Amazon Business",
      url: `https://www.amazon.com/s?k=${encodeURIComponent(searchName)}`,
      icon: "amazon",
      always: true,
    },
    {
      name: "Grainger",
      url: `https://www.grainger.com/search?searchQuery=${encodeURIComponent(searchName)}`,
      icon: "grainger",
      always: true,
    },
    {
      name: "McMaster-Carr",
      url: `https://www.mcmaster.com/catalog/${encodeURIComponent(searchName)}`,
      icon: "mcmaster",
      always: isHardware || isSafety,
    },
    {
      name: "Medline",
      url: `https://www.medline.com/search/?q=${encodeURIComponent(searchName)}`,
      icon: "medline",
      always: isMedical,
    },
    {
      name: "McKesson",
      url: `https://mms.mckesson.com/catalog?q=${encodeURIComponent(searchName)}`,
      icon: "mckesson",
      always: isMedical,
    },
    {
      name: "Fisher Scientific",
      url: `https://www.fishersci.com/us/en/catalog/search/products?keyword=${encodeURIComponent(searchName)}`,
      icon: "fisher",
      always: isLab,
    },
    {
      name: "GSA Advantage",
      url: `https://www.gsaadvantage.gov/advantage/s/search?q=0:2${encodeURIComponent(searchName)}&db=0`,
      icon: "gsa",
      always: true,
    },
    {
      name: "NSN Lookup",
      url: `https://www.nsnlookup.com/search?q=${nsn.replace(/-/g, "")}`,
      icon: "nsn",
      always: true,
    },
    {
      name: "FedMall",
      url: `https://www.fedmall.mil/search?keyword=${encodeURIComponent(nsn)}`,
      icon: "fedmall",
      always: true,
    },
  ];

  // Filter to relevant searches (always + category-specific)
  const relevantSearches = searches.filter((s) => s.always);

  return NextResponse.json({
    nsn,
    description,
    pastWinners,
    approvedSources,
    masterDbMatches,
    vendorPrices: vendorPrices || [],
    searches: relevantSearches,
  });
}
