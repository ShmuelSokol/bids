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
  const [cost, vendorPrices, awards, histBids, liveBids, sols, matches, spec, pid, shipments] = await Promise.all([
    supabase.from("nsn_costs").select("*").eq("nsn", nsn).maybeSingle(),
    supabase.from("nsn_vendor_prices").select("*").eq("nsn", nsn).order("price"),
    supabase.from("awards").select("id, contract_number, unit_price, quantity, award_date, cage, description, fob").eq("fsc", fsc).eq("niin", niin).order("award_date", { ascending: false }).limit(50),
    supabase.from("abe_bids").select("id, solicitation_number, bid_price, bid_qty, bid_date, lead_time_days, fob").eq("nsn", nsn).order("bid_date", { ascending: false }).limit(50),
    supabase.from("abe_bids_live").select("bid_id, solicitation_number, bid_price, bid_qty, bid_time, lead_days, fob, bid_status").eq("nsn", nsn).order("bid_time", { ascending: false }).limit(50),
    supabase.from("dibbs_solicitations").select("solicitation_number, nsn, quantity, return_by_date, is_sourceable, already_bid, suggested_price, our_cost, margin_pct, cost_source, data_source, channel, created_at").eq("nsn", nsn).order("return_by_date", { ascending: false }).limit(50),
    supabase.from("nsn_matches").select("*").eq("nsn", nsn),
    supabase.from("publog_nsns").select("*").eq("nsn", nsn).maybeSingle(),
    // NEW: LL PID + packaging (from kah_tab via ll_item_pids cache)
    supabase.from("ll_item_pids").select("pid_text, packaging_text, packaging_notes, last_award_date, pid_bytes").eq("fsc", fsc).eq("niin", niin).order("last_award_date", { ascending: false }).limit(1).maybeSingle(),
    // NEW: our shipment history for this NSN from ll_shipments
    supabase.from("ll_shipments").select("idnkaj, ship_number, contract_number, clin, ship_status, ship_date, transport_mode, tracking_number, quantity, sell_value, fob").eq("nsn", nsn).order("ship_date", { ascending: false }).limit(30),
  ]);

  // NEW: EDI transmission history — join on shipment idnkaj. Gathered
  // after the shipments query so we know which kaj IDs to pull for.
  let ediByShipment: Record<number, any[]> = {};
  const shipmentIdnkajs = (shipments.data || []).map((s: any) => s.idnkaj).filter((v: any) => v != null);
  if (shipmentIdnkajs.length > 0) {
    const { data: edi } = await supabase
      .from("ll_edi_transmissions")
      .select("idnkbr, parent_id, edi_type, lifecycle, status, transmitted_at")
      .eq("parent_table", "kaj")
      .in("parent_id", shipmentIdnkajs)
      .order("transmitted_at", { ascending: false });
    for (const e of edi || []) {
      const k = Number(e.parent_id);
      if (!ediByShipment[k]) ediByShipment[k] = [];
      ediByShipment[k].push(e);
    }
  }

  // AX data from cached nsn_catalog + vendor_parts (refreshed nightly)
  let axItem: any = null;
  let axError: string | null = null;
  const { data: catalogRow } = await supabase.from("nsn_catalog").select("nsn, source, description").eq("nsn", nsn).maybeSingle();
  if (catalogRow) {
    const itemNumber = catalogRow.source?.replace("AX:", "") || null;
    // Get vendor parts for this item
    const { data: vparts } = await supabase.from("vendor_parts").select("vendor_account, vendor_part_number, vendor_description").eq("nsn", nsn).limit(20);
    axItem = {
      Barcode: digits,
      ItemNumber: itemNumber,
      ProductDescription: catalogRow.description,
      vendors: vparts || [],
    };
  } else {
    axError = "Not in nsn_catalog (not matched in AX)";
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
    ll_pid: pid.data || null,
    ll_shipments: shipments.data || [],
    ll_edi_by_shipment: ediByShipment,
  });
}
