import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * GET /api/lookup?nsn=6515-01-153-4716
 *
 * The one-NSN probe page. Fires live queries against EVERY source
 * DIBS knows about so Abe can confirm "is this NSN wrong in DIBS,
 * or is it wrong at the source?" No caching, no filtering.
 *
 * Sources surfaced:
 *   - AX ProductBarcodesV3 (live OData)
 *   - Supabase nsn_costs (waterfall winner + full row)
 *   - Supabase nsn_vendor_prices (all vendors known for this NSN)
 *   - Supabase awards (every win/loss we have)
 *   - Supabase abe_bids + abe_bids_live (all our bids)
 *   - Supabase dibbs_solicitations (open + closed)
 *   - Supabase nsn_matches (PUB LOG p/n matches)
 *   - Supabase publog_nsns (item spec)
 */

async function getAxToken() {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.AX_CLIENT_ID!,
    client_secret: process.env.AX_CLIENT_SECRET!,
    scope: `${process.env.AX_D365_URL}/.default`,
  });
  const r = await fetch(
    `https://login.microsoftonline.com/${process.env.AX_TENANT_ID}/oauth2/v2.0/token`,
    { method: "POST", body: params }
  );
  const d: any = await r.json();
  if (!d.access_token) throw new Error("AX auth failed");
  return d.access_token;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const nsn = req.nextUrl.searchParams.get("nsn")?.trim();
  if (!nsn) return NextResponse.json({ error: "nsn required" }, { status: 400 });

  const supabase = createServiceClient();
  const [fsc, ...niinParts] = nsn.split("-");
  const niin = niinParts.join("-");
  const digits = nsn.replace(/-/g, "");

  // Fire all Supabase queries in parallel
  const [cost, vendorPrices, awards, histBids, liveBids, sols, matches, spec] = await Promise.all([
    supabase.from("nsn_costs").select("*").eq("nsn", nsn).maybeSingle(),
    supabase.from("nsn_vendor_prices").select("*").eq("nsn", nsn).order("price"),
    supabase.from("awards").select("id, contract_number, unit_price, quantity, award_date, cage, description, fob").eq("fsc", fsc).eq("niin", niin).order("award_date", { ascending: false }).limit(50),
    supabase.from("abe_bids").select("id, solicitation_number, bid_price, bid_qty, bid_date, lead_time_days, fob").eq("nsn", nsn).order("bid_date", { ascending: false }).limit(50),
    supabase.from("abe_bids_live").select("bid_id, solicitation_number, bid_price, bid_qty, bid_time, lead_days, fob, bid_status").eq("nsn", nsn).order("bid_time", { ascending: false }).limit(50),
    supabase.from("dibbs_solicitations").select("solicitation_number, nsn, quantity, return_by_date, is_sourceable, already_bid, suggested_price, our_cost, margin_pct, cost_source, data_source, channel, created_at").eq("nsn", nsn).order("return_by_date", { ascending: false }).limit(50),
    supabase.from("nsn_matches").select("*").eq("nsn", nsn),
    supabase.from("publog_nsns").select("*").eq("nsn", nsn).maybeSingle(),
  ]);

  // AX live probe
  let axItem: any = null;
  let axError: string | null = null;
  try {
    const token = await getAxToken();
    const D = process.env.AX_D365_URL!;
    if (digits.length === 13) {
      const url = `${D}/data/ProductBarcodesV3?cross-company=true&$filter=BarcodeSetupId eq 'NSN' and Barcode eq '${digits}'&$select=Barcode,ItemNumber,ProductDescription,ProductQuantity,ProductQuantityUnitSymbol`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const d: any = await r.json();
        axItem = d.value?.[0] || null;
      } else {
        axError = `AX HTTP ${r.status}`;
      }
    } else {
      axError = `NSN digits length ${digits.length} — expected 13`;
    }
  } catch (e: any) {
    axError = e?.message || "AX lookup failed";
  }

  return NextResponse.json({
    nsn,
    fsc,
    niin,
    digits,
    ax: { item: axItem, error: axError },
    nsn_cost: cost.data || null,
    vendor_prices: vendorPrices.data || [],
    awards: awards.data || [],
    historical_bids: histBids.data || [],
    live_bids: liveBids.data || [],
    solicitations: sols.data || [],
    publog_match: matches.data || [],
    publog_spec: spec.data || null,
  });
}
