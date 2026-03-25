import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * POST /api/dibbs/enrich
 * Matches DIBBS solicitation NSNs against AX (first) then Master DB
 * to identify sourceable items and suggest prices.
 */

// Build NSN lookups at module level (cached between requests)
let axNsnSet: Set<string> | null = null;
let axCostMap: Map<string, number> | null = null;
let mdbNsnSet: Set<string> | null = null;
let mdbCostMap: Map<string, number> | null = null;
let pricingMap: Map<string, { lastPrice: number; avgPrice: number; count: number }> | null = null;

async function loadAXNsns(): Promise<Set<string>> {
  if (axNsnSet) return axNsnSet;
  try {
    const barcodes = JSON.parse(
      readFileSync(join(process.cwd(), "data", "d365", "barcodes.json"), "utf-8")
    );
    axNsnSet = new Set<string>();
    // Build ItemNumber→NSN map
    const itemToNsn = new Map<string, string>();
    for (const b of barcodes) {
      if (b.BarcodeSetupId !== "NSN" || b.Barcode.length !== 13) continue;
      const raw = b.Barcode;
      const nsn = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 9)}-${raw.slice(9)}`;
      axNsnSet.add(nsn);
      itemToNsn.set(b.ItemNumber, nsn);
    }

    // Build NSN→best cost using Abe's rules:
    // 1. If PO within 2 months → use cheapest from that window
    // 2. If PO within 3 months → use cheapest from that window
    // 3. Else cheapest price agreement across all vendors
    // 4. Else most recent PO price
    axCostMap = new Map<string, number>();
    const now = Date.now();
    const TWO_MONTHS = 60 * 86400000;
    const THREE_MONTHS = 90 * 86400000;

    // Collect all PO costs per NSN
    const poCostsByNsn = new Map<string, { cost: number; date: number }[]>();
    try {
      const poLines = JSON.parse(
        readFileSync(join(process.cwd(), "data", "d365", "po-lines.json"), "utf-8")
      );
      for (const po of poLines) {
        if (!po.PurchasePrice || po.PurchasePrice <= 0) continue;
        const nsn = itemToNsn.get(po.ItemNumber);
        if (!nsn) continue;
        if (!poCostsByNsn.has(nsn)) poCostsByNsn.set(nsn, []);
        poCostsByNsn.get(nsn)!.push({
          cost: po.PurchasePrice,
          date: new Date(po.RequestedDeliveryDate).getTime(),
        });
      }
    } catch {}

    // Collect cheapest price agreement per NSN (across all vendors)
    const agreementCostByNsn = new Map<string, number>();
    try {
      const agreements = JSON.parse(
        readFileSync(join(process.cwd(), "data", "d365", "purchase-price-agreements.json"), "utf-8")
      );
      for (const pa of agreements) {
        if (!pa.Price || pa.Price <= 0) continue;
        const nsn = itemToNsn.get(pa.ItemNumber);
        if (!nsn) continue;
        const current = agreementCostByNsn.get(nsn);
        if (!current || pa.Price < current) {
          agreementCostByNsn.set(nsn, pa.Price);
        }
      }
    } catch {}

    // Determine best cost per NSN
    const allNsns = new Set([...poCostsByNsn.keys(), ...agreementCostByNsn.keys()]);
    for (const nsn of allNsns) {
      const poHistory = poCostsByNsn.get(nsn) || [];
      const recent2mo = poHistory.filter((p) => now - p.date <= TWO_MONTHS);
      const recent3mo = poHistory.filter((p) => now - p.date <= THREE_MONTHS);

      let bestCost: number;
      if (recent2mo.length > 0) {
        // Cheapest PO in last 2 months
        bestCost = Math.min(...recent2mo.map((p) => p.cost));
      } else if (recent3mo.length > 0) {
        // Cheapest PO in last 3 months
        bestCost = Math.min(...recent3mo.map((p) => p.cost));
      } else if (agreementCostByNsn.has(nsn)) {
        // Cheapest price agreement (any vendor)
        bestCost = agreementCostByNsn.get(nsn)!;
      } else if (poHistory.length > 0) {
        // Most recent PO
        poHistory.sort((a, b) => b.date - a.date);
        bestCost = poHistory[0].cost;
      } else {
        continue;
      }

      axCostMap.set(nsn, bestCost);
    }

    return axNsnSet;
  } catch {
    return new Set();
  }
}

async function loadMdbNsns(): Promise<Set<string>> {
  if (mdbNsnSet) return mdbNsnSet;
  try {
    const KEY = process.env.MASTERDB_API_KEY;
    if (!KEY) return new Set();
    const resp = await fetch(
      "https://masterdb.everreadygroup.com/api/dibs/items/export?has_nsn=1",
      { headers: { "X-Api-Key": KEY }, signal: AbortSignal.timeout(30000) }
    );
    if (!resp.ok) return new Set();
    const text = await resp.text();
    mdbNsnSet = new Set<string>();
    mdbCostMap = new Map<string, number>();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);
        if (item.nsn) {
          mdbNsnSet.add(item.nsn);
          if (item.cost && item.cost > 0) {
            const existing = mdbCostMap.get(item.nsn);
            if (!existing || item.cost < existing) {
              mdbCostMap.set(item.nsn, item.cost);
            }
          }
        }
      } catch {}
    }
    return mdbNsnSet;
  } catch {
    return new Set();
  }
}

async function loadPricing(): Promise<Map<string, { lastPrice: number; avgPrice: number; count: number }>> {
  if (pricingMap) return pricingMap;
  const supabase = createServiceClient();
  const { data: awards } = await supabase
    .from("awards")
    .select("fsc, niin, unit_price")
    .order("award_date", { ascending: false })
    .limit(5000);

  pricingMap = new Map();
  for (const a of awards || []) {
    const nsn = `${a.fsc}-${a.niin}`;
    if (!pricingMap.has(nsn)) {
      pricingMap.set(nsn, { lastPrice: a.unit_price, avgPrice: a.unit_price, count: 1 });
    } else {
      const h = pricingMap.get(nsn)!;
      h.avgPrice = (h.avgPrice * h.count + a.unit_price) / (h.count + 1);
      h.count++;
    }
  }
  return pricingMap;
}

export async function POST() {
  const supabase = createServiceClient();

  // Load all three data sources
  const [axNsns, mdbNsns, pricing] = await Promise.all([
    loadAXNsns(),
    loadMdbNsns(),
    loadPricing(),
  ]);

  // Get all unenriched solicitations
  const { data: solicitations } = await supabase
    .from("dibbs_solicitations")
    .select("id, nsn, nomenclature, quantity")
    .eq("is_sourceable", false);

  if (!solicitations || solicitations.length === 0) {
    return NextResponse.json({ success: true, enriched: 0, message: "No new solicitations to enrich" });
  }

  let sourceableCount = 0;
  let withCostCount = 0;
  const updates: {
    id: number;
    is_sourceable: boolean;
    source: string;
    source_item: string;
    suggested_price: number | null;
    our_cost: number | null;
    margin_pct: number | null;
  }[] = [];

  for (const sol of solicitations) {
    const nsn = sol.nsn;
    let source: string | null = null;

    // AX first (authoritative)
    if (axNsns.has(nsn)) {
      source = "ax";
    } else if (mdbNsns.has(nsn)) {
      source = "masterdb";
    }

    if (source) {
      const history = pricing.get(nsn);
      // Cost waterfall: AX (PO/agreements) → Master DB cost
      const cost = axCostMap?.get(nsn) || mdbCostMap?.get(nsn) || null;

      // Pricing logic:
      // 1. If we have cost data, apply Abe's empirical markup by price bracket
      // 2. If no cost but have award history, use last award + bracket-adjusted increment
      // 3. If neither, no suggestion
      let suggestedPrice: number | null = null;

      if (cost && cost > 0) {
        // Apply Abe's markup based on cost bracket
        let markup: number;
        if (cost < 25) markup = 1.64;
        else if (cost < 100) markup = 1.36;
        else if (cost < 500) markup = 1.21;
        else markup = 1.16;
        suggestedPrice = Math.round(cost * markup * 100) / 100;
        withCostCount++;
      } else if (history) {
        const lastPrice = history.lastPrice;
        let increment: number;
        if (lastPrice < 25) increment = 1.03;
        else if (lastPrice < 100) increment = 1.02;
        else if (lastPrice < 500) increment = 1.015;
        else increment = 1.01;
        suggestedPrice = Math.round(lastPrice * increment * 100) / 100;
      }

      const marginPct =
        suggestedPrice && cost && cost > 0
          ? Math.round(((suggestedPrice - cost) / suggestedPrice) * 100)
          : null;

      updates.push({
        id: sol.id,
        is_sourceable: true,
        source,
        source_item: nsn,
        suggested_price: suggestedPrice,
        our_cost: cost,
        margin_pct: marginPct,
      });
      sourceableCount++;
    }
  }

  // Batch update
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    for (const u of batch) {
      await supabase
        .from("dibbs_solicitations")
        .update({
          is_sourceable: u.is_sourceable,
          source: u.source,
          source_item: u.source_item,
          suggested_price: u.suggested_price,
          our_cost: u.our_cost,
          margin_pct: u.margin_pct,
        })
        .eq("id", u.id);
    }
  }

  return NextResponse.json({
    success: true,
    total_checked: solicitations.length,
    sourceable: sourceableCount,
    with_cost_data: withCostCount,
    ax_matches: updates.filter((u) => u.source === "ax").length,
    masterdb_matches: updates.filter((u) => u.source === "masterdb").length,
  });
}
